import { ruta } from '@/server/http/ruta';
import { PERMISOS_COMUNICACIONES } from '@/esquemas/reportes/documentos';
import { documentosInstitucionales } from '@/server/services/reportes/comunicaciones';

/** Documentos institucionales (reglamento, contrato, condiciones económicas) por año y versión. */
export const GET = ruta({ permiso: PERMISOS_COMUNICACIONES }, async () => ({ documentos: await documentosInstitucionales() }));
