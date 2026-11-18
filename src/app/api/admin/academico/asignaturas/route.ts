import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaAsignaturas, esquemaAsignatura, type FilaAsignatura } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaAsignaturas }, async ({ consulta }) =>
  responderListado<FilaAsignatura>(consulta, {
    titulo: 'Asignaturas',
    filtros: { Taller: consulta.esTaller === undefined ? undefined : consulta.esTaller === 'true' ? 'Sí' : 'No', Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Nombre', valor: 'nombre' },
      { titulo: 'Área', valor: 'area' },
      { titulo: 'Taller', valor: 'es_taller', formato: 'booleano' },
      { titulo: 'Planes', valor: 'planes', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarAsignaturas({ q: consulta.q, areaId: consulta.areaId, esTaller: consulta.esTaller }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaAsignatura }, async ({ actor, cuerpo }) => servicio.crearAsignatura(actor, cuerpo));
