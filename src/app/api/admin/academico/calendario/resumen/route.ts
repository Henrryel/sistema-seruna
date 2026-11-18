import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { id } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/calendario';

export const GET = ruta({ permiso: 'academico.configurar', consulta: z.object({ anioId: id }) }, async ({ consulta }) => servicio.resumen(consulta.anioId));
