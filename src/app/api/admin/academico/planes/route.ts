import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaPlanes, esquemaPlan, type FilaPlan } from '@/esquemas/academico/planes';
import * as servicio from '@/server/services/academico/planes';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaPlanes }, async ({ consulta }) =>
  responderListado<FilaPlan>(consulta, {
    titulo: 'Planes de estudio',
    filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Grado', valor: 'grado' },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Publicado', valor: 'publicado_en', formato: 'fechaHora' },
      { titulo: 'Asignaturas', valor: 'asignaturas', formato: 'numero' },
      { titulo: 'Competencias', valor: 'competencias', formato: 'numero' },
      { titulo: 'Secciones', valor: 'secciones', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarPlanes({ q: consulta.q, anioId: consulta.anioId, gradoId: consulta.gradoId, estado: consulta.estado }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaPlan }, async ({ actor, cuerpo }) => servicio.crearPlan(actor, cuerpo));
