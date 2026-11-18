import 'server-only';
import type { NextRequest } from 'next/server';
import { ValidationError } from '@/server/errores';
import { descargar } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import * as registro from '@/server/services/asistencia/registro';
import * as justificaciones from '@/server/services/asistencia/justificaciones';
import type { Actor } from '@/server/auth/actor';
import type { ConsultaListado } from '@/esquemas/comunes';
import { ETIQUETA_ESTADO, type EstadoAsistencia, type FilaAsistenciaAlumno } from '@/esquemas/asistencia/registro';
import { esquemaSolicitudJustificacion } from '@/esquemas/asistencia/justificaciones';
import type { Evidencia } from '@/server/services/asistencia/justificaciones';

// Utilidades de la capa HTTP del módulo (compartidas por las rutas admin y docente).

type Consulta = Pick<ConsultaListado, 'pagina' | 'porPagina' | 'formato' | 'q'>;
const etiqueta = (e: string) => ETIQUETA_ESTADO[e as EstadoAsistencia] ?? e;

/** Asistencia diaria de una sección en una fecha (JSON con la jornada, o Excel/PDF con los mismos filtros). */
export async function responderDiaria(actor: Actor, consulta: Consulta & { seccionId: string; fecha: string }, contexto: registro.Contexto) {
  const jornada = await registro.jornadaDeSeccion(actor, consulta.seccionId, consulta.fecha, contexto);
  const r = await responderListado<FilaAsistenciaAlumno>(consulta, {
    titulo: 'Asistencia diaria',
    nombreArchivo: `asistencia-${consulta.fecha}`,
    filtros: { Sección: jornada?.seccion, Fecha: consulta.fecha.split('-').reverse().join('/') },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Estudiante', valor: 'estudiante', ancho: 36 },
      { titulo: 'Estado', valor: (f) => etiqueta(f.estado) },
      { titulo: 'Entrada', valor: (f) => (f.entrada ? new Date(f.entrada) : null), formato: 'fechaHora' },
      { titulo: 'Salida', valor: (f) => (f.salida ? new Date(f.salida) : null), formato: 'fechaHora' },
      { titulo: 'Justificación', valor: 'justificacion' },
      { titulo: 'Motivo', valor: 'motivo', ancho: 30 },
    ],
    obtener: (p) => registro.listarDiariaSeccion(actor, { seccionId: consulta.seccionId, fecha: consulta.fecha, q: consulta.q }, p, contexto),
  });
  return r instanceof Response ? r : { ...r, jornada };
}

/** Asistencia de una sesión de clase (JSON con datos de la sesión, o Excel/PDF). */
export async function responderSesion(actor: Actor, consulta: Consulta, sesionId: string, contexto: registro.Contexto) {
  const sesion = await registro.obtenerSesion(actor, sesionId, contexto);
  const r = await responderListado<FilaAsistenciaAlumno>(consulta, {
    titulo: `Asistencia de ${sesion.curso}`,
    nombreArchivo: `asistencia-sesion-${sesion.fecha}`,
    filtros: { Sección: sesion.seccion, Fecha: sesion.fecha.split('-').reverse().join('/'), Horario: `${sesion.hora_inicio.slice(0, 5)}–${sesion.hora_fin.slice(0, 5)}`, Docente: sesion.docente },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Estudiante', valor: 'estudiante', ancho: 36 },
      { titulo: 'Estado', valor: (f) => etiqueta(f.estado) },
      { titulo: 'Justificación', valor: 'justificacion' },
      { titulo: 'Motivo', valor: 'motivo', ancho: 30 },
    ],
    obtener: (p) => registro.listarAsistenciaSesion(actor, { sesionId, q: consulta.q }, p, contexto),
  });
  return r instanceof Response ? r : { ...r, sesion };
}

/** Lee una solicitud de justificación (multipart con evidencia opcional, o JSON). */
export async function leerSolicitudJustificacion(req: NextRequest): Promise<{ datos: { asistenciaId: string; motivo: string }; evidencia: Evidencia | null }> {
  const tipo = req.headers.get('content-type') ?? '';
  let crudo: unknown = {};
  let evidencia: Evidencia | null = null;
  if (tipo.includes('multipart/form-data')) {
    const form = await req.formData();
    crudo = { asistenciaId: form.get('asistenciaId'), motivo: form.get('motivo') };
    const archivo = form.get('archivo');
    if (archivo instanceof File && archivo.size > 0) {
      evidencia = { contenido: Buffer.from(await archivo.arrayBuffer()), nombreOriginal: archivo.name || 'evidencia', tipoMime: archivo.type || 'application/octet-stream' };
    }
  } else {
    crudo = await req.json().catch(() => ({}));
  }
  const r = esquemaSolicitudJustificacion.safeParse(crudo);
  if (!r.success) {
    const primero = r.error.issues[0];
    throw new ValidationError(primero ? `${primero.path.join('.')}: ${primero.message}` : 'Datos inválidos', { campos: r.error.flatten().fieldErrors });
  }
  return { datos: r.data, evidencia };
}

export async function descargarEvidencia(actor: Actor, justificacionId: string) {
  const a = await justificaciones.evidencia(actor, justificacionId);
  return descargar(a.contenido, a.nombre_original, a.tipo_mime);
}
