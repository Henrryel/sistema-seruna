import { ruta } from '@/server/http/ruta';
import { PERMISOS_REPORTES } from '@/esquemas/reportes/documentos';
import { resumenCola } from '@/server/services/reportes/documentos';

/** Conteo por estado de los documentos visibles (para el sondeo de la cola en la pantalla). */
export const GET = ruta({ permiso: PERMISOS_REPORTES }, async ({ actor }) => resumenCola(actor));
