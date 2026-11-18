import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCierresAnuales, esquemaGenerarCierres, type FilaCierreAnual } from '@/esquemas/evaluacion/cierre-anual';
import * as servicio from '@/server/services/evaluacion/cierre-anual';

export const GET = ruta({ permiso: 'academico.cerrar_anio', consulta: consultaCierresAnuales }, async ({ consulta }) =>
  responderListado<FilaCierreAnual>(consulta, {
    titulo: 'Cierre anual',
    filtros: { Estado: consulta.estado, Situación: consulta.situacion, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Estudiante', valor: 'alumno', ancho: 32 },
      { titulo: 'Grado', valor: (f) => `${f.grado}.º ${f.nivel}` },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Etapa', valor: 'etapa' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Situación', valor: 'situacion' },
      { titulo: 'Competencias', valor: 'resultados', formato: 'numero' },
      { titulo: 'Pendientes', valor: 'pendientes', formato: 'numero' },
      { titulo: 'Aprobado', valor: (f) => (f.aprobado_en ? new Date(f.aprobado_en) : null), formato: 'fechaHora' },
    ],
    obtener: (p) =>
      servicio.listarCierresAnuales({ anioId: consulta.anioId, seccionId: consulta.seccionId, estado: consulta.estado, situacion: consulta.situacion, q: consulta.q }, p),
  }),
);

/** Genera los borradores ordinarios (versión 1) del año o de una sección. */
export const POST = ruta({ permiso: 'academico.cerrar_anio', cuerpo: esquemaGenerarCierres }, async ({ actor, cuerpo }) => servicio.generarBorradores(actor, cuerpo));
