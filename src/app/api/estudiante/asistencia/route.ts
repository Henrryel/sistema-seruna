import { ruta } from '@/server/http/ruta';
import { consultaResumen } from '@/esquemas/asistencia/registro';
import * as servicio from '@/server/services/asistencia/registro';

/** Resumen y detalle de la asistencia PROPIA del alumno (alcance: estudianteDelActor). */
export const GET = ruta({ portal: 'estudiante', consulta: consultaResumen }, async ({ actor, consulta }) => servicio.resumenPropioAlumno(actor, consulta));
