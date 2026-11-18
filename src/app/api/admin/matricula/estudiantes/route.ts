import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaEstudiantes, esquemaEstudianteNuevo, type FilaEstudiante } from '@/esquemas/matricula/estudiantes';
import * as servicio from '@/server/services/matricula/estudiantes';

export const GET = ruta({ permiso: ['matriculas.gestionar', 'expediente.gestionar'], consulta: consultaEstudiantes }, async ({ consulta }) =>
  responderListado<FilaEstudiante>(consulta, {
    titulo: 'Estudiantes',
    filtros: { Activo: consulta.activo === 'true' ? 'Sí' : consulta.activo === 'false' ? 'No' : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Apellidos', valor: 'apellidos', ancho: 20 },
      { titulo: 'Nombres', valor: 'nombres', ancho: 20 },
      { titulo: 'Documento', valor: 'documento' },
      { titulo: 'Código SIAGIE', valor: 'codigo_siagie' },
      { titulo: 'Última matrícula', valor: 'ultima_matricula', ancho: 18 },
      { titulo: 'Estado matrícula', valor: 'estado_matricula' },
      { titulo: 'Activo', valor: 'activo', formato: 'booleano' },
    ],
    obtener: (p) => servicio.listarEstudiantes({ q: consulta.q, activo: consulta.activo }, p),
  }),
);

export const POST = ruta({ permiso: 'matriculas.gestionar', cuerpo: esquemaEstudianteNuevo }, async ({ actor, cuerpo }) =>
  servicio.crearEstudiante(actor, cuerpo),
);
