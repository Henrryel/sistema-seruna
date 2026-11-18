import { ruta } from '@/server/http/ruta';
import { consultaResumenHijo } from '@/esquemas/asistencia/registro';
import * as servicio from '@/server/services/asistencia/registro';

/** Asistencia del hijo (vínculo vigente con acceso académico; lo verifica el servicio). */
export const GET = ruta({ portal: 'padre', consulta: consultaResumenHijo }, async ({ actor, consulta }) =>
  servicio.resumenHijo(actor, consulta.estudianteId, { desde: consulta.desde, hasta: consulta.hasta }),
);
