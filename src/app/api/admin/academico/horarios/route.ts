import { ruta } from '@/server/http/ruta';
import { consultaHorario, esquemaBloque } from '@/esquemas/academico/horarios';
import * as servicio from '@/server/services/academico/horarios';

/** Horario semanal de la sección vigente en la fecha (por defecto hoy acotado al año). */
export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaHorario }, async ({ consulta }) =>
  servicio.horarioDeSeccion(consulta.seccionId, consulta.fecha),
);

/** Nuevo bloque: la base rechaza choques de sección, docente o aula y vigencias fuera del plan/asignación. */
export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaBloque }, async ({ actor, cuerpo }) => servicio.crearBloque(actor, cuerpo));
