import { ruta } from '@/server/http/ruta';
import { consultaAlumnos } from '@/esquemas/cobros/pagos';
import * as servicio from '@/server/services/cobros/pagos';

/** Búsqueda de alumnos por apellidos, nombres, código o documento (máx. 20). */
export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaAlumnos }, async ({ consulta }) => ({
  alumnos: await servicio.buscarAlumnos(consulta.q),
}));
