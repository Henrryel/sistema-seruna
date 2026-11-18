import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { idOpcional } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/secciones';

/** Niveles y grados sembrados (solo lectura) con totales de secciones del año. */
export const GET = ruta({ permiso: 'academico.configurar', consulta: z.object({ anioId: idOpcional }) }, async ({ consulta }) => ({
  grados: await servicio.listarGrados(consulta.anioId),
}));
