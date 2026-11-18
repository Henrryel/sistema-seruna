import { ruta } from '@/server/http/ruta';
import { esquemaGenerarLectivos } from '@/esquemas/academico/calendario';
import * as servicio from '@/server/services/academico/calendario';

/** Registra lunes a viernes del rango como lectivos sin pisar los días ya registrados. */
export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaGenerarLectivos }, async ({ actor, cuerpo }) =>
  servicio.generarLectivos(actor, cuerpo),
);
