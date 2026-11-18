import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaPublicacionDocumento } from '@/esquemas/matricula/documentos';
import * as servicio from '@/server/services/matricula/documentos';

export const POST = ruta(
  { permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaPublicacionDocumento },
  async ({ actor, parametros, cuerpo }) => servicio.publicarDocumentoInstitucional(actor, parametros.id, cuerpo.vigenteDesde),
);
