import { ruta } from '@/server/http/ruta';
import { consultaPersonas } from '@/esquemas/planilla/contratos';
import * as servicio from '@/server/services/planilla/contratos';

/** Personas SIN perfil docente (alta de docente a partir de una persona existente). */
export const GET = ruta(
  { permiso: 'planilla.contratos', consulta: consultaPersonas },
  async ({ consulta }) => ({
    personas: await servicio.buscarPersonas(consulta.q),
  }),
);
