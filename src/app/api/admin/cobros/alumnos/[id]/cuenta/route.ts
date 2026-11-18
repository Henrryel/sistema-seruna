import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { consultaCuenta } from '@/esquemas/cobros/pagos';
import * as servicio from '@/server/services/cobros/pagos';

/** Matrículas, cuotas con saldo y apoderados del alumno para registrar un cobro. */
export const GET = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, consulta: consultaCuenta }, async ({ parametros, consulta }) =>
  servicio.cuentaParaCobro(parametros.id, consulta.matriculaId),
);
