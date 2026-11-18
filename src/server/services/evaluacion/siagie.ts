import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as ctx from '@/server/repositories/evaluacion/contexto';
import * as repo from '@/server/repositories/evaluacion/siagie';
import { escribirNotasSiagie, leerHojas } from './siagie-excel';
import type { Actor } from '@/server/auth/actor';
import type { ContenidoExportacion, DetallePlantilla, ResultadoGeneracionSiagie } from '@/esquemas/evaluacion/siagie';

// Exportación SIAGIE: plantilla oficial por sección/bimestre → mapeos → `preparar_exportacion_siagie` (la base
// valida bimestre publicado, mapeos y códigos SIAGIE y arma el contenido) → Excel generado con ExcelJS sobre
// la misma plantilla (huella SHA-256 verificada) → aceptada/rechazada con observación.

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const listarPlantillas = repo.listarPlantillas;

async function exigirPlantilla(id: string) {
  const p = await repo.obtenerPlantilla(id);
  if (!p) throw new NotFoundError('La plantilla SIAGIE no existe');
  return p;
}

export async function subirPlantilla(actor: Actor, d: { seccionId: string; bimestreId: string }, archivo: { contenido: Buffer; nombreOriginal: string; tipoMime: string }) {
  if (!/\.xlsx$/i.test(archivo.nombreOriginal)) throw new ValidationError('La plantilla debe ser un archivo .xlsx');
  let hojas: string[];
  try {
    hojas = await leerHojas(archivo.contenido);
  } catch {
    throw new ValidationError('No se pudo leer la plantilla: verifique que sea un Excel .xlsx válido');
  }
  const seccion = await ctx.obtenerSeccion(d.seccionId);
  if (!seccion) throw new NotFoundError('La sección no existe');
  return transaccion(async () => {
    const a = await guardarArchivo({ ...archivo, tipoMime: MIME_XLSX });
    const r = await repo.crearPlantilla({ archivoId: a.id, seccionId: seccion.id, bimestreId: d.bimestreId, anioId: seccion.anio_id, gradoId: seccion.grado_id });
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'plantillas_siagie', registroId: r.id, motivo: archivo.nombreOriginal, resultado: 'ok' });
    return { ...r, hojas };
  });
}

export async function detallePlantilla(id: string): Promise<DetallePlantilla> {
  const p = await exigirPlantilla(id);
  const bimestre = await ctx.obtenerBimestre(p.bimestre_id);
  const planId = bimestre ? ((await ctx.planDeSeccionEn(p.seccion_id, bimestre.fin)) ?? (await ctx.planDeSeccionEn(p.seccion_id, bimestre.inicio))) : null;
  const [mapeos, exportaciones, otras, competencias] = await Promise.all([
    repo.mapeosDe(id),
    repo.exportacionesDe(id),
    repo.otrasPlantillas(id, p.anio_id, p.grado_id),
    planId ? ctx.competenciasDePlan(planId) : Promise.resolve([]),
  ]);
  let hojas: string[] = [];
  try {
    hojas = await leerHojas((await leerArchivo(p.archivo_id)).contenido);
  } catch {
    hojas = [];
  }
  const mapeadas = new Set(mapeos.map((m) => m.competencia_id));
  const { anio_id: _a, grado_id: _g, ...fila } = p;
  return {
    ...fila,
    hojas,
    mapeosDetalle: mapeos,
    competencias: competencias.map((k) => ({ id: k.id, codigo: k.codigo, nombre: k.nombre, reportable_siagie: k.reportable_siagie, mapeada: mapeadas.has(k.id) })),
    exportacionesDetalle: exportaciones,
    otrasPlantillas: otras.map((o) => ({ id: o.id, etiqueta: `${o.grado}.º ${o.seccion} · ${o.bimestre}.º bim. · v${o.version}` })),
  };
}

export async function agregarMapeo(actor: Actor, plantillaId: string, d: { competenciaId: string; hoja: string; codigoExcel: string; columnaNl: number }) {
  await exigirPlantilla(plantillaId);
  return transaccion(async () => {
    const r = await repo.insertarMapeo(plantillaId, d);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'mapeos_siagie', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function quitarMapeo(actor: Actor, plantillaId: string, mapeoId: string) {
  return transaccion(async () => {
    const r = await repo.eliminarMapeo(plantillaId, mapeoId);
    if (!r) throw new NotFoundError('El mapeo no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'mapeos_siagie', registroId: mapeoId, resultado: 'ok' });
    return r;
  });
}

export async function copiarMapeos(actor: Actor, plantillaId: string, desdeId: string) {
  await exigirPlantilla(plantillaId);
  await exigirPlantilla(desdeId);
  return transaccion(async () => {
    const r = await repo.copiarMapeos(desdeId, plantillaId);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'copiar_mapeos', entidad: 'plantillas_siagie', registroId: plantillaId, motivo: `desde ${desdeId}: ${r.length}`, resultado: 'ok' });
    return { copiados: r.length };
  });
}

/** Prepara la exportación con la función de la base (valida y arma el contenido). */
export async function prepararExportacion(actor: Actor, plantillaId: string) {
  const p = await exigirPlantilla(plantillaId);
  // Sin cierre la función fallaría con un "registro no encontrado" genérico: se explica el motivo.
  if (!(await ctx.cierreDeSeccion(p.seccion_id, p.bimestre_id))) {
    throw new ConflictError('La sección aún no tiene registro de notas en ese bimestre: publíquelo antes de preparar el Excel SIAGIE');
  }
  return transaccion(async () => {
    const r = await repo.prepararExportacion(plantillaId, actor.usuarioId);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'preparar', entidad: 'exportaciones_siagie', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

/** Escribe las notas preparadas en la plantilla oficial, guarda el Excel y marca la exportación como generada. */
export async function generarExcel(actor: Actor, exportacionId: string): Promise<ResultadoGeneracionSiagie> {
  const exp = await repo.obtenerExportacion(exportacionId);
  if (!exp) throw new NotFoundError('La exportación no existe');
  if (exp.estado !== 'preparada') throw new ConflictError('Solo una exportación preparada puede generarse');
  const plantilla = await exigirPlantilla(exp.plantilla_id);
  const original = await leerArchivo(plantilla.archivo_id);
  const contenido = exp.contenido as unknown as ContenidoExportacion;
  if (Buffer.from(original.sha256).toString('hex') !== contenido.sha256) {
    throw new ConflictError('El archivo de la plantilla no coincide con el preparado (huella SHA-256 distinta)');
  }
  const salida = await escribirNotasSiagie(original.contenido, contenido);
  return transaccion(async () => {
    const a = await guardarArchivo({
      contenido: salida.contenido,
      nombreOriginal: `siagie-${plantilla.grado}${plantilla.seccion}-bim${plantilla.bimestre}-exp${exportacionId}.xlsx`,
      tipoMime: MIME_XLSX,
    });
    const observacion = salida.advertencias.length ? `Advertencias: ${salida.advertencias.join(' | ')}`.slice(0, 2000) : null;
    const r = await repo.marcarGenerada(exportacionId, a.id, observacion);
    if (!r) throw new ConflictError('Solo una exportación preparada puede generarse');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'generar', entidad: 'exportaciones_siagie', registroId: exportacionId, motivo: `${salida.escritas} nota(s)`, resultado: 'ok' });
    return { exportacionId, archivoId: a.id, escritas: salida.escritas, advertencias: salida.advertencias };
  });
}

export async function resolverExportacion(actor: Actor, id: string, d: { estado: 'aceptada' | 'rechazada'; observacion: string | null }) {
  const exp = await repo.obtenerExportacion(id);
  if (!exp) throw new NotFoundError('La exportación no existe');
  if (exp.estado === 'aceptada' || exp.estado === 'rechazada') throw new ConflictError('La exportación ya fue resuelta');
  if (d.estado === 'aceptada' && exp.estado !== 'generada') throw new ConflictError('Genere el Excel antes de marcarlo como aceptado');
  return transaccion(async () => {
    const r = await repo.resolverExportacion(id, d.estado, d.observacion);
    if (!r) throw new NotFoundError('La exportación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: d.estado === 'aceptada' ? 'aceptar' : 'rechazar', entidad: 'exportaciones_siagie', registroId: id, motivo: d.observacion, resultado: 'ok' });
    return r;
  });
}

export async function archivoPlantilla(id: string) {
  const p = await exigirPlantilla(id);
  return leerArchivo(p.archivo_id);
}

export async function archivoExportacion(id: string) {
  const exp = await repo.obtenerExportacion(id);
  if (!exp) throw new NotFoundError('La exportación no existe');
  if (!exp.resultado_archivo_id) throw new NotFoundError('La exportación aún no tiene un Excel generado');
  return leerArchivo(exp.resultado_archivo_id);
}
