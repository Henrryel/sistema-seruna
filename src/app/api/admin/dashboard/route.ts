import { ruta } from '@/server/http/ruta';
import { consultaDashboard } from '@/esquemas/dashboard/dashboard';
import { PERMISOS_DASHBOARD, consultarDashboard } from '@/server/services/dashboard/admin';

/** Indicadores institucionales (indicadores_dashboard + desgloses), solo con los bloques permitidos al actor. */
export const GET = ruta({ permiso: PERMISOS_DASHBOARD, consulta: consultaDashboard }, async ({ actor, consulta }) =>
  consultarDashboard(actor, consulta),
);
