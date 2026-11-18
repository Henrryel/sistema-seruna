import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaReglas, esquemaRegla, type FilaRegla } from '@/esquemas/evaluacion/reglas';
import * as servicio from '@/server/services/evaluacion/reglas';

const PERMISO = 'academico.configurar_cierre_anual';

export const GET = ruta({ permiso: PERMISO, consulta: consultaReglas }, async ({ consulta }) =>
  responderListado<FilaRegla>(consulta, {
    titulo: 'Reglas de evaluación',
    filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Nivel', valor: 'nivel' },
      { titulo: 'Grado', valor: 'grado', formato: 'numero' },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Referencia normativa', valor: 'referencia_normativa', ancho: 40 },
      { titulo: 'Aprobada', valor: (f) => (f.aprobado_en ? new Date(f.aprobado_en) : null), formato: 'fechaHora' },
      { titulo: 'Aprobó', valor: 'aprobado_por' },
      { titulo: 'Cierres que la usan', valor: 'usos', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarReglas({ anioId: consulta.anioId, gradoId: consulta.gradoId, estado: consulta.estado, q: consulta.q }, p),
  }),
);

export const POST = ruta({ permiso: PERMISO, cuerpo: esquemaRegla }, async ({ actor, cuerpo }) => servicio.crearRegla(actor, cuerpo));
