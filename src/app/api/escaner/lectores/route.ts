import { ruta } from '@/server/http/ruta';
import * as servicio from '@/server/services/asistencia/configuracion';

/** Lectores activos para el selector del escáner. */
export const GET = ruta({ permiso: 'asistencia.marcar' }, async () => ({ lectores: await servicio.lectoresActivos() }));
