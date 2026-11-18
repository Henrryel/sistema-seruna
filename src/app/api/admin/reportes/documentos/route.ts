import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { PERMISOS_REPORTES, consultaDocumentos, esquemaSolicitudDocumento, type FilaDocumento } from '@/esquemas/reportes/documentos';
import * as servicio from '@/server/services/reportes/documentos';

/** Documentos visibles: los solicitados por el actor y los de tipos cuyo permiso tiene. */
export const GET = ruta({ permiso: PERMISOS_REPORTES, consulta: consultaDocumentos }, async ({ actor, consulta }) =>
  responderListado<FilaDocumento>(consulta, {
    titulo: 'Documentos solicitados',
    filtros: { Estado: consulta.estado, Tipo: consulta.tipo, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'N.º', valor: 'id' },
      { titulo: 'Tipo', valor: 'tipo_nombre' },
      { titulo: 'Plantilla', valor: (f) => `${f.plantilla_nombre} v${f.plantilla_version}` },
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Formato', valor: (f) => f.formato.toUpperCase() },
      { titulo: 'Desde', valor: (f) => f.parametros.desde, formato: 'fecha' },
      { titulo: 'Hasta', valor: (f) => f.parametros.hasta, formato: 'fecha' },
      { titulo: 'Filas', valor: 'filas', formato: 'numero' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Solicitado por', valor: 'solicitado_por_login' },
      { titulo: 'Solicitado', valor: 'solicitado_en', formato: 'fechaHora' },
      { titulo: 'Observación', valor: (f) => f.motivo_fallo ?? f.motivo_anulacion ?? '' },
    ],
    obtener: (p) =>
      servicio.listarDocumentos(
        actor,
        { q: consulta.q, estado: consulta.estado, tipo: consulta.tipo, anioId: consulta.anioId, propios: consulta.propios === 'true' },
        p,
      ),
  }),
);

/** Solicita un documento: la base valida permiso, filtros e idempotencia y congela los datos. */
export const POST = ruta({ permiso: PERMISOS_REPORTES, cuerpo: esquemaSolicitudDocumento }, async ({ actor, cuerpo }) =>
  servicio.solicitarDocumento(actor, cuerpo),
);
