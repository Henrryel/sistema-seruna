import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEstudianteEdicion } from '@/esquemas/matricula/estudiantes';
import * as servicio from '@/server/services/matricula/estudiantes';

export const GET = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ parametros }) => servicio.fichaEstudiante(parametros.id));

export const PUT = ruta(
  { permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaEstudianteEdicion },
  async ({ actor, parametros, cuerpo }) => servicio.actualizarEstudiante(actor, parametros.id, cuerpo),
);
