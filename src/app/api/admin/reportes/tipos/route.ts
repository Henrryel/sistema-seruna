import { ruta } from '@/server/http/ruta';
import { PERMISOS_REPORTES } from '@/esquemas/reportes/documentos';
import { tiposReporte } from '@/server/services/reportes/plantillas';

/** Tipos de reporte (tipos_reporte) con el permiso que exige cada uno y si el actor lo tiene. */
export const GET = ruta({ permiso: PERMISOS_REPORTES }, async ({ actor }) => ({
  tipos: (await tiposReporte()).map((t) => ({ ...t, permitido: (actor.permisos as string[]).includes(t.permiso) })),
}));
