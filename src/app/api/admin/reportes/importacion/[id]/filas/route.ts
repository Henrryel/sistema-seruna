import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { parametrosId } from '@/esquemas/comunes';
import { consultaFilasLote, esquemaCargaAdicional, type FilaImportacionVista } from '@/esquemas/importacion/lotes';
import { archivosDe, campoJson, leerFormulario, validarDatos } from '@/server/services/reportes/entrada';
import * as servicio from '@/server/services/importacion/lotes';

const PERMISO = 'datos.conciliar_historico' as const;

export const GET = ruta({ permiso: PERMISO, parametros: parametrosId, consulta: consultaFilasLote }, async ({ parametros, consulta }) =>
  responderListado<FilaImportacionVista>(consulta, {
    titulo: `Filas del lote ${parametros.id}`,
    filtros: { Entidad: consulta.entidad, Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Entidad', valor: 'entidad' },
      { titulo: 'Clave de origen', valor: 'clave_origen' },
      { titulo: 'Datos', valor: (f) => JSON.stringify(f.datos), ancho: 80 },
      { titulo: 'Acción', valor: (f) => f.accion ?? 'pendiente' },
      { titulo: 'Destino', valor: (f) => f.destino_id ?? '' },
      { titulo: 'Motivo', valor: (f) => f.motivo ?? '' },
      { titulo: 'Revisada', valor: 'revisada_en', formato: 'fechaHora' },
    ],
    obtener: (p) => servicio.listarFilas(parametros.id, { q: consulta.q, entidad: consulta.entidad, estado: consulta.estado }, p),
  }),
);

/** Carga archivos adicionales mientras el lote está en 'carga' (`descriptores` + `archivos`). */
export const POST = ruta({ permiso: PERMISO, parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const form = await leerFormulario(req);
  const datos = validarDatos(esquemaCargaAdicional, { archivos: campoJson(form, 'descriptores') });
  return servicio.cargarArchivos(actor, parametros.id, datos.archivos, await archivosDe(form));
});
