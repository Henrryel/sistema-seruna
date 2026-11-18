import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaPendientes, esquemaRecuperacion, type FilaPendienteRecuperacion } from '@/esquemas/evaluacion/recuperacion';
import * as servicio from '@/server/services/evaluacion/recuperacion';

export const GET = ruta({ permiso: 'academico.recuperacion', consulta: consultaPendientes }, async ({ consulta }) =>
  responderListado<FilaPendienteRecuperacion>(consulta, {
    titulo: 'Competencias pendientes de recuperación',
    filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Estudiante', valor: 'alumno', ancho: 32 },
      { titulo: 'Grado', valor: (f) => `${f.grado}.º ${f.nivel}` },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Área', valor: 'area' },
      { titulo: 'Competencia', valor: 'competencia', ancho: 40 },
      { titulo: 'Nivel anual', valor: 'nivel_original' },
      { titulo: 'Último intento', valor: (f) => f.evaluaciones.at(-1)?.nivel_logro ?? '' },
      { titulo: 'Estado', valor: (f) => f.evaluaciones.at(-1)?.estado ?? 'sin evaluación' },
    ],
    obtener: (p) => servicio.listarPendientes({ anioId: consulta.anioId, seccionId: consulta.seccionId, estado: consulta.estado, q: consulta.q }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.recuperacion', cuerpo: esquemaRecuperacion }, async ({ actor, cuerpo }) => servicio.registrarEvaluacion(actor, cuerpo));
