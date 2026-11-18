import { ruta } from '@/server/http/ruta';
import { consultaInicioPadre } from '@/esquemas/dashboard/dashboard';
import { inicioPadre } from '@/server/services/dashboard/inicio';

/** Resumen del hijo (vínculo vigente; académico/económico según los accesos del vínculo). */
export const GET = ruta({ portal: 'padre', consulta: consultaInicioPadre }, async ({ actor, consulta }) => inicioPadre(actor, consulta.estudianteId));
