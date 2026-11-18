import { ruta } from '@/server/http/ruta';
import { consultaOpcionesContrato } from '@/esquemas/planilla/contratos';
import { PERMISOS_OPCIONES_CONTRATO } from '@/esquemas/planilla/permisos';
import * as servicio from '@/server/services/planilla/contratos';

/** Contratos para selects: por modalidad, vigentes en una fecha o que se cruzan con un mes. */
export const GET = ruta(
  { permiso: PERMISOS_OPCIONES_CONTRATO, consulta: consultaOpcionesContrato },
  async ({ consulta }) => ({
    opciones: await servicio.opcionesContratos(consulta),
  }),
);
