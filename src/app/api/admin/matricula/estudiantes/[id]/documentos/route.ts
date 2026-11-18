import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaDocumentoIdentidad } from '@/esquemas/matricula/comunes';
import * as servicio from '@/server/services/matricula/estudiantes';

/** Documento de identidad del estudiante. */
export const POST = ruta(
  { permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaDocumentoIdentidad },
  async ({ actor, parametros, cuerpo }) => servicio.agregarDocumentoIdentidad(actor, { estudianteId: parametros.id }, cuerpo),
);
