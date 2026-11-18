import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaSecciones, esquemaSeccion, type FilaSeccion } from '@/esquemas/academico/secciones';
import * as servicio from '@/server/services/academico/secciones';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaSecciones }, async ({ consulta }) =>
  responderListado<FilaSeccion>(consulta, {
    titulo: 'Secciones',
    filtros: { Activa: consulta.activa === undefined ? undefined : consulta.activa === 'true' ? 'Sí' : 'No', Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Grado', valor: 'grado' },
      { titulo: 'Sección', valor: 'nombre' },
      { titulo: 'Turno', valor: 'turno' },
      { titulo: 'Cupo', valor: 'cupo', formato: 'numero' },
      { titulo: 'Reserva', valor: 'reserva', formato: 'numero' },
      { titulo: 'Ocupadas', valor: 'ocupadas', formato: 'numero' },
      { titulo: 'Plan vigente', valor: 'plan_vigente' },
      { titulo: 'Activa', valor: 'activa', formato: 'booleano' },
    ],
    obtener: (p) => servicio.listarSecciones({ q: consulta.q, anioId: consulta.anioId, gradoId: consulta.gradoId, activa: consulta.activa }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaSeccion }, async ({ actor, cuerpo }) => servicio.crearSeccion(actor, cuerpo));
