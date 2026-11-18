import { ruta } from '@/server/http/ruta';
import { consultaCuenta } from '@/esquemas/cobros/pagos';
import * as servicio from '@/server/services/cobros/portal';

/** Estado de cuenta del alumno autenticado (solo su registro). */
export const GET = ruta({ portal: 'estudiante', consulta: consultaCuenta }, async ({ actor, consulta }) =>
  servicio.estadoCuentaEstudiante(actor, consulta.matriculaId),
);
