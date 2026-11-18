import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/reportes/plantillas';

/** Publica la plantilla: desde ese momento es inmutable (trigger proteger_plantilla_publicada). */
export const POST = ruta({ permiso: 'reportes.configurar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.publicarPlantilla(actor, parametros.id),
);
