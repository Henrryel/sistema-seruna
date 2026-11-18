import { ruta } from '@/server/http/ruta';
import { consultaPersonasCredencial } from '@/esquemas/asistencia/credenciales';
import * as servicio from '@/server/services/asistencia/credenciales';

/** Búsqueda de alumnos y docentes activos para emitir credenciales individuales. */
export const GET = ruta({ permiso: 'asistencia.configurar', portal: 'admin', consulta: consultaPersonasCredencial }, async ({ consulta }) => ({
  personas: await servicio.buscarPersonas(consulta.q, consulta.perfil),
}));
