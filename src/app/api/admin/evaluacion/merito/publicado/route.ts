import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { idOpcional } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/merito';

/** Vista `orden_merito_publicado`: última versión publicada por año, grado y alcance. */
export const GET = ruta({ permiso: 'academico.publicar_merito', consulta: z.object({ anioId: idOpcional, gradoId: idOpcional }) }, async ({ consulta }) => ({
  puestos: (await servicio.meritoPublicado(consulta)).map((p) => ({ ...p, publicado_en: p.publicado_en ? p.publicado_en.toISOString() : null })),
}));
