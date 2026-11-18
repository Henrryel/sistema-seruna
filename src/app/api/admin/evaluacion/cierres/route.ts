import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCierres, esquemaAbrirCierres, type FilaCierre } from '@/esquemas/evaluacion/cierres';
import * as servicio from '@/server/services/evaluacion/cierres';

export const GET = ruta({ permiso: 'academico.publicar', consulta: consultaCierres }, async ({ consulta }) =>
  responderListado<FilaCierre>(consulta, {
    titulo: 'Cierres de bimestre',
    filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Bimestre', valor: (f) => `${f.bimestre}.º` },
      { titulo: 'Nivel', valor: 'nivel' },
      { titulo: 'Grado', valor: 'grado', formato: 'numero' },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Avance %', valor: 'avance', formato: 'numero' },
      { titulo: 'Notas esperadas', valor: 'esperadas', formato: 'numero' },
      { titulo: 'Sin conclusión', valor: 'sin_conclusion', formato: 'numero' },
      { titulo: 'Cerrado', valor: (f) => (f.cerrado_en ? new Date(f.cerrado_en) : null), formato: 'fechaHora' },
      { titulo: 'Publicado', valor: (f) => (f.publicado_en ? new Date(f.publicado_en) : null), formato: 'fechaHora' },
      { titulo: 'Responsable', valor: 'responsable' },
    ],
    obtener: (p) => servicio.listarCierres({ anioId: consulta.anioId, bimestreId: consulta.bimestreId, estado: consulta.estado, q: consulta.q }, p),
  }),
);

/** Abre el registro de notas (cierres en borrador) para varias secciones a la vez. */
export const POST = ruta({ permiso: 'academico.publicar', cuerpo: esquemaAbrirCierres }, async ({ actor, cuerpo }) => servicio.abrirRegistro(actor, cuerpo));
