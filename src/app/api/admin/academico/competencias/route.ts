import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCompetencias, esquemaCompetencia, type FilaCompetencia } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaCompetencias }, async ({ consulta }) =>
  responderListado<FilaCompetencia>(consulta, {
    titulo: 'Competencias',
    filtros: { 'Reportable SIAGIE': consulta.reportable === undefined ? undefined : consulta.reportable === 'true' ? 'Sí' : 'No', Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Nombre', valor: 'nombre', ancho: 50 },
      { titulo: 'Área', valor: 'area' },
      { titulo: 'SIAGIE', valor: 'reportable_siagie', formato: 'booleano' },
      { titulo: 'Capacidades', valor: 'capacidades', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarCompetencias({ q: consulta.q, areaId: consulta.areaId, reportable: consulta.reportable }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaCompetencia }, async ({ actor, cuerpo }) => servicio.crearCompetencia(actor, cuerpo));
