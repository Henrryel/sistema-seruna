import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaSesiones, esquemaSesion, type FilaSesion } from '@/esquemas/academico/horarios';
import * as servicio from '@/server/services/academico/horarios';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaSesiones }, async ({ consulta }) =>
  responderListado<FilaSesion>(consulta, {
    titulo: 'Sesiones de clase',
    filtros: { Estado: consulta.estado, Desde: consulta.desde, Hasta: consulta.hasta, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Fecha', valor: 'fecha', formato: 'fecha' },
      { titulo: 'Inicio', valor: (f) => f.hora_inicio.slice(0, 5) },
      { titulo: 'Fin', valor: (f) => f.hora_fin.slice(0, 5) },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Asignatura', valor: 'asignatura' },
      { titulo: 'Docente', valor: 'docente' },
      { titulo: 'Aula', valor: 'aula' },
      { titulo: 'Estado', valor: 'estado' },
    ],
    obtener: (p) =>
      servicio.listarSesiones(
        { q: consulta.q, anioId: consulta.anioId, seccionId: consulta.seccionId, cursoId: consulta.cursoId, estado: consulta.estado, desde: consulta.desde, hasta: consulta.hasta },
        p,
      ),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaSesion }, async ({ actor, cuerpo }) => servicio.crearSesion(actor, cuerpo));
