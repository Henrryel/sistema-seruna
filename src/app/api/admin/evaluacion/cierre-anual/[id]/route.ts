import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/cierre-anual';

export const GET = ruta({ permiso: 'academico.cerrar_anio', parametros: parametrosId }, async ({ parametros }) => servicio.detalleCierreAnual(parametros.id));

/** Descarta un borrador (la base impide borrar un cierre aprobado). */
export const DELETE = ruta({ permiso: 'academico.cerrar_anio', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.descartarBorrador(actor, parametros.id),
);
