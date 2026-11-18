import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaLibretas, type FilaLibreta } from '@/esquemas/evaluacion/notas';
import * as servicio from '@/server/services/evaluacion/notas';

export const GET = ruta({ permiso: ['reportes.academico', 'academico.publicar'], consulta: consultaLibretas }, async ({ consulta }) =>
  responderListado<FilaLibreta>(consulta, {
    titulo: 'Libretas de notas',
    filtros: { Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Estudiante', valor: 'alumno', ancho: 32 },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Matrícula', valor: 'estado' },
      { titulo: 'Bimestres publicados', valor: 'bimestres_publicados', formato: 'numero' },
      { titulo: 'Situación final', valor: 'situacion' },
    ],
    obtener: (p) => servicio.listarLibretas({ anioId: consulta.anioId, seccionId: consulta.seccionId, q: consulta.q }, p),
  }),
);
