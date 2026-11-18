import 'server-only';
import { aErrorDominio, ErrorDominio } from '@/server/errores';

// Mensajes en español para restricciones de la base de este módulo. NO valida nada: la base rechaza
// (EXCLUDE/UNIQUE/CHECK) y aquí solo se reemplaza el mensaje genérico por uno más claro.

const MENSAJES: Record<string, string> = {
  calendario_escolar_pkey: 'Ese día ya está registrado en el calendario',
  aulas_codigo_key: 'Ya existe un aula con ese código',
  aulas_capacidad_check: 'La capacidad del aula debe ser mayor que cero',
  secciones_check: 'La reserva debe estar entre 0 y el cupo de la sección',
  secciones_cupo_check: 'El cupo debe ser mayor que cero',
  secciones_nombre_check: 'El nombre de la sección debe estar en mayúsculas',
  areas_curriculares_codigo_key: 'Ya existe un área curricular con ese código',
  asignaturas_codigo_key: 'Ya existe una asignatura con ese código',
  competencias_codigo_version_key: 'Ya existe una competencia con ese código y versión',
  competencias_version_check: 'La versión debe ser mayor que cero',
  capacidades_competencia_id_codigo_key: 'La competencia ya tiene una capacidad con ese código',
  planes_estudio_anio_id_grado_id_version_key: 'Ya existe esa versión del plan para el año y grado',
  planes_estudio_version_check: 'La versión debe ser mayor que cero',
  plan_asignaturas_pkey: 'La asignatura ya está en el plan',
  plan_competencias_pkey: 'La competencia ya está en el plan',
  seccion_planes_estudio_seccion_id_vigencia_excl: 'La sección ya tiene un plan de estudios en ese período',
  seccion_planes_estudio_seccion_id_anio_id_grado_id_fkey: 'La sección no corresponde al año y grado del plan',
  seccion_planes_estudio_plan_id_anio_id_grado_id_fkey: 'La sección no corresponde al año y grado del plan',
  cursos_seccion_seccion_plan_id_asignatura_id_key: 'La sección ya tiene ese curso',
  asignaciones_docentes_curso_id_docente_id_vigencia_excl: 'El docente ya está asignado a este curso en ese período',
  asignaciones_docentes_docente_id_fkey: 'El docente no existe',
  bloques_horario_seccion_id_dia_iso_vigencia_franja_excl: 'Choque de horario: la sección ya tiene otra clase ese día en ese horario',
  bloques_horario_docente_id_dia_iso_vigencia_franja_excl: 'Choque de horario: el docente ya tiene otra clase ese día en ese horario',
  bloques_horario_aula_id_dia_iso_vigencia_franja_excl: 'Choque de horario: el aula ya está ocupada ese día en ese horario',
  bloques_horario_check: 'La hora de fin debe ser posterior a la de inicio (en minutos exactos)',
  bloques_horario_asignacion_id_curso_id_docente_id_fkey: 'La asignación docente no corresponde al curso',
  sesiones_clase_seccion_id_franja_excl: 'Choque de horario: la sección ya tiene otra sesión en ese horario',
  sesiones_clase_docente_id_franja_excl: 'Choque de horario: el docente ya tiene otra sesión en ese horario',
  sesiones_clase_aula_id_franja_excl: 'Choque de horario: el aula ya está ocupada en ese horario',
  sesiones_clase_check: 'La hora de fin debe ser posterior a la de inicio',
  sesiones_clase_bloque_id_curso_id_fkey: 'El bloque no corresponde al curso de la asignación',
};

/** Ejecuta `fn` y, si la base rechaza por una restricción conocida, relanza con un mensaje claro. */
export async function conMensajes<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const pg = typeof e === 'object' && e !== null ? (e as { constraint?: unknown; code?: unknown; message?: unknown }) : {};
    // Rangos invertidos (daterange/int4range/tsrange, incluidas columnas generadas): SQLSTATE 22000.
    if (pg.code === '22000' && typeof pg.message === 'string' && /rango|range/i.test(pg.message)) {
      throw new ErrorDominio('Validation', 'El fin debe ser posterior al inicio', { codigoDb: '22000', causa: e });
    }
    const mensaje = typeof pg.constraint === 'string' ? MENSAJES[pg.constraint] : undefined;
    if (!mensaje) throw e;
    const base = aErrorDominio(e);
    throw new ErrorDominio(base.tipo, mensaje, { codigoDb: base.codigoDb, detalles: base.detalles, causa: e });
  }
}
