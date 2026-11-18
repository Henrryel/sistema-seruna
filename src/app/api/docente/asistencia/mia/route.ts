import { ruta } from '@/server/http/ruta';
import { consultaResumen } from '@/esquemas/asistencia/registro';
import * as servicio from '@/server/services/asistencia/registro';

/** Asistencia propia del docente y sus justificaciones. */
export const GET = ruta({ portal: 'docente', consulta: consultaResumen }, async ({ actor, consulta }) => servicio.resumenPropioDocente(actor, consulta));
