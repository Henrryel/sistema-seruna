import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaAsignaciones, esquemaAsignacion, NOMBRE_FUNCION, type FilaAsignacion } from '@/esquemas/academico/asignaciones';
import * as servicio from '@/server/services/academico/asignaciones';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaAsignaciones }, async ({ consulta }) =>
  responderListado<FilaAsignacion>(consulta, {
    titulo: 'Asignaciones docentes',
    filtros: { Función: consulta.funcion ? NOMBRE_FUNCION[consulta.funcion] : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Asignatura', valor: 'asignatura' },
      { titulo: 'Docente', valor: 'docente' },
      { titulo: 'Código', valor: 'docente_codigo' },
      { titulo: 'Función', valor: (f) => NOMBRE_FUNCION[f.funcion] ?? f.funcion },
      { titulo: 'Desde', valor: 'inicio', formato: 'fecha' },
      { titulo: 'Hasta', valor: 'fin', formato: 'fecha' },
      { titulo: 'Vigente', valor: 'vigente', formato: 'booleano' },
    ],
    obtener: (p) =>
      servicio.listarAsignaciones(
        { q: consulta.q, anioId: consulta.anioId, seccionId: consulta.seccionId, cursoId: consulta.cursoId, docenteId: consulta.docenteId, funcion: consulta.funcion },
        p,
      ),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaAsignacion }, async ({ actor, cuerpo }) => servicio.crearAsignacion(actor, cuerpo));
