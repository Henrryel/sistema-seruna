import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaLotes, esquemaLote, type FilaLote } from '@/esquemas/importacion/lotes';
import { archivosDe, campoJson, leerFormulario, validarDatos } from '@/server/services/reportes/entrada';
import * as servicio from '@/server/services/importacion/lotes';

const PERMISO = 'datos.conciliar_historico' as const;

export const GET = ruta({ permiso: PERMISO, consulta: consultaLotes }, async ({ consulta }) =>
  responderListado<FilaLote>(consulta, {
    titulo: 'Lotes de importación histórica',
    filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Lote', valor: 'id' },
      { titulo: 'Sistema', valor: 'sistema' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Filas', valor: 'cargadas', formato: 'numero' },
      { titulo: 'Pendientes', valor: 'pendientes', formato: 'numero' },
      { titulo: 'Creado', valor: 'creado_en', formato: 'fechaHora' },
      { titulo: 'Sellado', valor: 'sellado_en', formato: 'fechaHora' },
      { titulo: 'Cerrado', valor: 'cerrado_en', formato: 'fechaHora' },
      { titulo: 'SHA-256', valor: 'sha256', ancho: 66 },
    ],
    obtener: (p) => servicio.listarLotes({ q: consulta.q, estado: consulta.estado }, p),
  }),
);

/**
 * Crea el lote y carga sus filas. multipart/form-data: `sistema`, `conteos` (JSON {entidad: n}),
 * `descriptores` (JSON [{entidad, columnaClave}] en el orden de los archivos) y `archivos` (JSON o CSV).
 */
export const POST = ruta({ permiso: PERMISO }, async ({ req, actor }) => {
  const form = await leerFormulario(req);
  const datos = validarDatos(esquemaLote, {
    sistema: form.get('sistema'),
    conteos: campoJson(form, 'conteos'),
    archivos: campoJson(form, 'descriptores'),
  });
  return servicio.crearLote(actor, datos, await archivosDe(form));
});
