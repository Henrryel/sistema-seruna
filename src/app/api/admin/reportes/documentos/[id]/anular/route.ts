import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { PERMISOS_REPORTES, esquemaAnulacionDocumento } from '@/esquemas/reportes/documentos';
import { anularDocumento } from '@/server/services/reportes/documentos';

/** Anula un documento emitido con motivo (la base solo admite emitido → anulado). */
export const POST = ruta(
  { permiso: PERMISOS_REPORTES, parametros: parametrosId, cuerpo: esquemaAnulacionDocumento },
  async ({ actor, parametros, cuerpo }) => anularDocumento(actor, parametros.id, cuerpo.motivo),
);
