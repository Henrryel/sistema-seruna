import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import * as servicio from '@/server/services/matricula/estudiantes';

const consulta = z.object({ q: z.string().trim().min(2, 'Escriba al menos 2 caracteres').max(80) });

/** Búsqueda de personas existentes (por nombre o documento) para vincularlas como alumno o apoderado. */
export const GET = ruta({ permiso: 'matriculas.gestionar', consulta }, async ({ consulta }) => ({
  personas: await servicio.buscarPersonas(consulta.q),
}));
