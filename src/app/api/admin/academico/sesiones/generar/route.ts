import { ruta } from '@/server/http/ruta';
import { esquemaGenerarSesiones } from '@/esquemas/academico/horarios';
import * as servicio from '@/server/services/academico/horarios';

/** Genera sesiones programadas desde los bloques de la sección (omite días no lectivos y ya generadas). */
export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaGenerarSesiones }, async ({ actor, cuerpo }) => servicio.generarSesiones(actor, cuerpo));
