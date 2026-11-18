import 'server-only';
import { transaccion } from '@/server/db';
import { ErrorDominio, traducirErrorDb } from '@/server/errores';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import * as repo from '@/server/repositories/reportes/documentos';
import { formatoFecha } from '@/lib/formato';
import type { LogoPdf } from '@/server/pdf/reportes/documento';
import type { ParametrosDocumento, ResultadoProcesoDocumento } from '@/esquemas/reportes/documentos';
import { generarArchivoDocumento } from './generador';

// Worker de la cola `documentos_emitidos`: toma solicitudes 'preparado' con FOR UPDATE SKIP LOCKED (varias
// instancias no se pisan), genera el archivo con los datos CONGELADOS y marca 'emitido' o 'fallido'.
// Las transiciones válidas y el MIME/bytes del archivo emitido los verifica el trigger de la base.

/** Usuario técnico configurado como procesador (si no, figura el solicitante). */
export function usuarioWorker(): string | undefined {
  const v = process.env.WORKER_USUARIO_ID?.trim();
  return v && /^[1-9]\d{0,18}$/.test(v) ? v : undefined;
}

function motivoFallo(e: unknown): string {
  const dominio = e instanceof ErrorDominio ? e : traducirErrorDb(e);
  const texto = dominio ? dominio.message : e instanceof Error ? `Error al generar el archivo: ${e.message}` : 'Error al generar el archivo';
  return texto.slice(0, 500);
}

async function logoPlantilla(archivoId: string | null): Promise<LogoPdf | null> {
  if (!archivoId) return null;
  try {
    const a = await leerArchivo(archivoId);
    if (a.tipo_mime === 'image/png') return { data: a.contenido, format: 'png' };
    if (a.tipo_mime === 'image/jpeg') return { data: a.contenido, format: 'jpg' };
  } catch {
    // Un archivo de plantilla ausente no impide emitir el documento.
  }
  return null;
}

async function subtitulo(doc: repo.DocumentoCompleto): Promise<string> {
  const p = (doc.parametros ?? {}) as Partial<ParametrosDocumento>;
  const f = await repo.describirFiltros({
    matriculaId: p.matricula_id == null ? null : String(p.matricula_id),
    seccionId: p.seccion_id == null ? null : String(p.seccion_id),
    bimestreId: p.bimestre_id == null ? null : String(p.bimestre_id),
  });
  return [
    `Año ${doc.anio}`,
    p.desde && p.hasta ? `Del ${formatoFecha(p.desde)} al ${formatoFecha(p.hasta)}` : '',
    f.bimestre ? `${f.bimestre}.º bimestre` : '',
    f.seccion ? `Sección ${f.seccion}` : '',
    f.estudiante ? `Estudiante: ${f.estudiante}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Procesa UNA solicitud preparada (la más antigua libre). Devuelve null si la cola está vacía. */
export async function procesarSiguiente(opciones: { procesadoPor?: string; soloIds?: string[] } = {}): Promise<ResultadoProcesoDocumento | null> {
  return transaccion(async () => {
    const id = await repo.tomarSiguientePreparado(opciones.soloIds);
    if (!id) return null;
    const doc = await repo.obtenerDocumento(id);
    if (!doc) return null;
    const procesadoPor = opciones.procesadoPor ?? usuarioWorker() ?? doc.solicitado_por;
    try {
      // SAVEPOINT: si la emisión falla (generación, almacenamiento o trigger) se marca 'fallido'.
      return await transaccion(async () => {
        const archivo = await generarArchivoDocumento({
          id: doc.id,
          tipo: doc.tipo,
          formato: doc.formato,
          titulo: `${doc.plantilla_nombre}`,
          subtitulo: await subtitulo(doc),
          datos: doc.datos,
          configuracion: (doc.configuracion ?? {}) as Record<string, unknown>,
          logo: doc.formato === 'pdf' ? await logoPlantilla(doc.plantilla_archivo_id) : null,
        });
        const guardado = await guardarArchivo({ contenido: archivo.contenido, nombreOriginal: archivo.nombre, tipoMime: archivo.mime });
        await repo.marcarEmitido(doc.id, guardado.id, procesadoPor);
        return { id: doc.id, estado: 'emitido' as const };
      });
    } catch (e) {
      const motivo = motivoFallo(e);
      await repo.marcarFallido(doc.id, procesadoPor, motivo);
      return { id: doc.id, estado: 'fallido' as const, motivo };
    }
  });
}

/** Procesa hasta `limite` solicitudes. Se detiene ante un error inesperado (se reintenta en el próximo ciclo). */
export async function procesarCola(opciones: { limite?: number; procesadoPor?: string; soloIds?: string[] } = {}): Promise<ResultadoProcesoDocumento[]> {
  const resultados: ResultadoProcesoDocumento[] = [];
  const limite = Math.max(1, Math.min(opciones.limite ?? 10, 100));
  for (let i = 0; i < limite; i++) {
    let r: ResultadoProcesoDocumento | null;
    try {
      r = await procesarSiguiente(opciones);
    } catch (e) {
      console.error('[seruna] no se pudo procesar la cola de documentos', e);
      break;
    }
    if (!r) break;
    resultados.push(r);
  }
  return resultados;
}

const global_ = globalThis as unknown as { __serunaWorkerReportes?: ReturnType<typeof setInterval> };

/** Arranca el ciclo del worker dentro del servidor (una sola vez por proceso, sin solaparse). */
export function iniciarWorkerReportes(): void {
  if (global_.__serunaWorkerReportes) return;
  const intervalo = Math.max(2_000, Number(process.env.WORKER_REPORTES_INTERVALO_MS ?? 10_000) || 10_000);
  let ocupado = false;
  const ciclo = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      const r = await procesarCola({ limite: 20 });
      if (r.length) console.info(`[seruna] worker de reportes: ${r.length} documento(s) procesado(s)`);
    } catch (e) {
      console.error('[seruna] worker de reportes', e);
    } finally {
      ocupado = false;
    }
  };
  const t = setInterval(() => void ciclo(), intervalo);
  t.unref?.();
  global_.__serunaWorkerReportes = t;
  console.info(`[seruna] worker de reportes activo (cada ${intervalo / 1000} s)`);
}
