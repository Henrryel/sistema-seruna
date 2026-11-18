import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { fechaOpcional } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/portales';

/** Cursos del docente (alcance: solo sus asignaciones). */
export const GET = ruta({ portal: 'docente', consulta: z.object({ fecha: fechaOpcional }) }, async ({ actor, consulta }) => servicio.misCursos(actor, consulta.fecha));
