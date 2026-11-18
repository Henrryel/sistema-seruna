import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaArchivoHistorico, type FilaArchivoHistorico } from '@/esquemas/importacion/lotes';
import * as servicio from '@/server/services/importacion/lotes';

/** Visor del archivo histórico (vista archivo_historico: filas archivadas con su sustento). */
export const GET = ruta({ permiso: 'datos.conciliar_historico', consulta: consultaArchivoHistorico }, async ({ consulta }) =>
  responderListado<FilaArchivoHistorico>(consulta, {
    titulo: 'Archivo histórico',
    filtros: { Sistema: consulta.sistema, Entidad: consulta.entidad, Lote: consulta.loteId, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Sistema', valor: 'sistema' },
      { titulo: 'Lote', valor: 'lote_id' },
      { titulo: 'Entidad', valor: 'entidad' },
      { titulo: 'Clave de origen', valor: 'clave_origen' },
      { titulo: 'Datos', valor: (f) => JSON.stringify(f.datos), ancho: 80 },
      { titulo: 'Sustento', valor: 'motivo' },
      { titulo: 'Revisada', valor: 'revisada_en', formato: 'fechaHora' },
    ],
    obtener: (p) => servicio.listarArchivoHistorico({ q: consulta.q, sistema: consulta.sistema, entidad: consulta.entidad, loteId: consulta.loteId }, p),
  }),
);
