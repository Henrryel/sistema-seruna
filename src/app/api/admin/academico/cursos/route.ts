import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCursos, type FilaCurso } from '@/esquemas/academico/asignaciones';
import * as servicio from '@/server/services/academico/asignaciones';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaCursos }, async ({ consulta }) =>
  responderListado<FilaCurso>(consulta, {
    titulo: 'Cursos por sección',
    filtros: { 'Sin docente': consulta.sinDocente === 'true' ? 'Sí' : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Asignatura', valor: 'asignatura' },
      { titulo: 'Plan', valor: (f) => `v${f.plan_version}` },
      { titulo: 'Docentes vigentes', valor: 'docentes', ancho: 40 },
      { titulo: 'Activo', valor: 'activo', formato: 'booleano' },
    ],
    obtener: (p) =>
      servicio.listarCursos({ q: consulta.q, anioId: consulta.anioId, gradoId: consulta.gradoId, seccionId: consulta.seccionId, sinDocente: consulta.sinDocente }, p),
  }),
);
