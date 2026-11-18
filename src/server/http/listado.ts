import 'server-only';
import type { ConsultaListado, RespuestaListado } from '@/esquemas/comunes';
import { generarExcelListado } from '@/server/exportacion/excel';
import { generarPdfListado } from '@/server/exportacion/pdf-listado';
import { descargar } from './ruta';

export interface Paginacion {
  limite: number;
  desplazamiento: number;
}

/** Máximo de filas en una exportación síncrona (los reportes pesados van a la cola de documentos). */
export const MAX_FILAS_EXPORTACION = 10_000;

export type FormatoColumna = 'texto' | 'moneda' | 'fecha' | 'fechaHora' | 'numero' | 'booleano';

export interface ColumnaExportacion<F> {
  titulo: string;
  /** Valor a exportar: clave de la fila o función. */
  valor: keyof F | ((fila: F) => string | number | boolean | Date | null | undefined);
  formato?: FormatoColumna;
  ancho?: number;
}

/** Aplica LIMIT/OFFSET si hay paginación (null = exportación: todas las filas hasta el máximo). */
export function aplicarPaginacion<QB extends { limit(n: number): QB; offset(n: number): QB }>(qb: QB, p: Paginacion | null): QB {
  if (!p) return qb.limit(MAX_FILAS_EXPORTACION);
  return qb.limit(p.limite).offset(p.desplazamiento);
}

export function valorColumna<F>(fila: F, c: ColumnaExportacion<F>) {
  return typeof c.valor === 'function' ? c.valor(fila) : (fila[c.valor] as unknown as string | number | boolean | Date | null | undefined);
}

/**
 * Responde un listado en JSON paginado o lo exporta a Excel/PDF con LOS MISMOS filtros
 * (parámetro `formato` de la consulta).
 */
export async function responderListado<F>(
  consulta: Pick<ConsultaListado, 'pagina' | 'porPagina' | 'formato'>,
  opciones: {
    titulo: string;
    columnas: ColumnaExportacion<F>[];
    obtener: (p: Paginacion | null) => Promise<{ filas: F[]; total: number }>;
    /** Descripción legible de los filtros aplicados (aparece en el encabezado del archivo). */
    filtros?: Record<string, string | null | undefined>;
    nombreArchivo?: string;
    horizontal?: boolean;
  },
): Promise<RespuestaListado<F> | Response> {
  if (consulta.formato === 'json') {
    const { filas, total } = await opciones.obtener({
      limite: consulta.porPagina,
      desplazamiento: (consulta.pagina - 1) * consulta.porPagina,
    });
    return { filas, total, pagina: consulta.pagina, porPagina: consulta.porPagina };
  }
  const { filas } = await opciones.obtener(null);
  const base = (opciones.nombreArchivo ?? opciones.titulo).toLowerCase().replace(/\s+/g, '-');
  const filtros = Object.fromEntries(
    Object.entries(opciones.filtros ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''),
  );
  if (consulta.formato === 'xlsx') {
    const buffer = await generarExcelListado({ titulo: opciones.titulo, columnas: opciones.columnas, filas, filtros });
    return descargar(buffer, `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  const buffer = await generarPdfListado({
    titulo: opciones.titulo,
    columnas: opciones.columnas,
    filas,
    filtros,
    horizontal: opciones.horizontal ?? opciones.columnas.length > 6,
  });
  return descargar(buffer, `${base}.pdf`, 'application/pdf');
}
