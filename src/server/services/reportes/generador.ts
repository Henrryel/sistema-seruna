import 'server-only';
import type { FormatoColumna, ColumnaExportacion } from '@/server/http/listado';
import { generarExcelListado } from '@/server/exportacion/excel';
import { textoCelda } from '@/server/exportacion/formato';
import { generarPdfResumen, generarPdfTabla, type LogoPdf } from '@/server/pdf/reportes/documento';
import { formatoFecha, leerRangoFechas } from '@/lib/formato';

// Genera el archivo (PDF o XLSX) de una solicitud a partir de sus datos CONGELADOS (`datos.filas`).
// La plantilla puede ajustar la salida con su `configuracion` (objeto JSON):
//   { "titulo": "…", "subtitulo": "…", "horizontal": true,
//     "columnas": ["apellidos", {"clave": "saldo", "titulo": "Saldo", "formato": "moneda"}],
//     "excluir": ["estudiante_id"], "incluirIds": false }

export const MIME_FORMATO: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const TITULOS: Record<string, string> = {
  matricula_id: 'Matrícula',
  anio_id: 'Año',
  grado_id: 'Grado (id)',
  seccion_id: 'Sección (id)',
  estudiante_id: 'Estudiante (id)',
  docente_id: 'Docente (id)',
  estado: 'Estado',
  confirmada_en: 'Confirmada',
  tipo_ingreso: 'Tipo de ingreso',
  codigo: 'Código',
  codigo_siagie: 'Código SIAGIE',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  nivel: 'Nivel',
  grado: 'Grado',
  seccion: 'Sección',
  vigencia: 'Vigencia',
  bimestre: 'Bimestre',
  area: 'Área',
  competencia: 'Competencia',
  nivel_logro: 'Nivel de logro',
  conclusion: 'Conclusión descriptiva',
  publicado_en: 'Publicado',
  concepto: 'Concepto',
  vence_en: 'Vence',
  importe: 'Importe',
  ajustes: 'Ajustes',
  abonado: 'Abonado',
  saldo: 'Saldo',
  fecha: 'Fecha',
  entrada: 'Entrada',
  salida: 'Salida',
};

const ETIQUETAS_DASHBOARD: Record<string, string> = {
  activas: 'Matrículas activas',
  cupo: 'Cupo total',
  vacantes_totales: 'Vacantes totales',
  vacantes_regulares: 'Vacantes regulares',
  vacantes_reservadas: 'Vacantes reservadas',
  cobrado_bruto_aplicado: 'Cobrado bruto aplicado',
  devuelto: 'Devuelto',
  revertido: 'Revertido',
  cobrado_neto_aplicado: 'Cobrado neto aplicado',
  saldo_pendiente: 'Saldo pendiente',
  saldo_vencido: 'Saldo vencido',
  matriculas_con_mora: 'Matrículas con mora',
  esperadas: 'Esperadas',
  resueltas: 'Resueltas',
  publicadas: 'Publicadas',
  avance_pct: 'Avance (%)',
  presentes: 'Presentes',
  tardanzas: 'Tardanzas',
  ausencias: 'Ausencias',
  justificadas: 'Justificadas',
  pendientes: 'Pendientes',
};

const SECCIONES_DASHBOARD: [string, string][] = [
  ['matricula', 'Matrícula'],
  ['pagos', 'Pagos'],
  ['notas', 'Avance de notas del bimestre'],
  ['asistencia.alumnos', 'Asistencia de alumnos'],
  ['asistencia.docentes', 'Asistencia de docentes'],
];

const FORMATOS_VALIDOS: FormatoColumna[] = ['texto', 'moneda', 'fecha', 'fechaHora', 'numero', 'booleano'];
const ES_MONEDA = /(importe|saldo|abonado|ajustes|cobrado|devuelto|revertido|monto|neto|pension)/i;
const ES_IDENTIFICADOR = /^(id|.*_id|codigo|codigo_siagie|numero|grado|bimestre)$/;
const RANGO = /^[[(][^,]*,[^\])]*[\])]$/;

export interface ColumnaDocumento {
  clave: string;
  titulo: string;
  formato: FormatoColumna;
}

type Fila = Record<string, unknown>;

export function tituloClave(clave: string): string {
  const t = TITULOS[clave];
  if (t) return t;
  const s = clave.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inferirFormato(clave: string, filas: Fila[]): FormatoColumna {
  const muestra = filas.map((f) => f[clave]).find((v) => v !== null && v !== undefined && v !== '');
  if (muestra === undefined) return 'texto';
  if (typeof muestra === 'boolean') return 'booleano';
  if (ES_IDENTIFICADOR.test(clave)) return 'texto';
  if (typeof muestra === 'number' || (typeof muestra === 'string' && /^-?\d+(\.\d+)?$/.test(muestra))) {
    return ES_MONEDA.test(clave) ? 'moneda' : 'numero';
  }
  if (typeof muestra === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(muestra)) return 'fecha';
  if (typeof muestra === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(muestra)) return 'fechaHora';
  return 'texto';
}

/** Columnas: las de la configuración o todas las claves (en orden de aparición). */
export function columnasDocumento(filas: Fila[], configuracion: Record<string, unknown>, destino: 'pdf' | 'xlsx'): ColumnaDocumento[] {
  const declaradas = Array.isArray(configuracion.columnas) ? (configuracion.columnas as unknown[]) : null;
  if (declaradas?.length) {
    return declaradas.flatMap((c): ColumnaDocumento[] => {
      if (typeof c === 'string') return [{ clave: c, titulo: tituloClave(c), formato: inferirFormato(c, filas) }];
      if (c && typeof c === 'object' && typeof (c as { clave?: unknown }).clave === 'string') {
        const x = c as { clave: string; titulo?: unknown; formato?: unknown };
        const formato = FORMATOS_VALIDOS.includes(x.formato as FormatoColumna) ? (x.formato as FormatoColumna) : inferirFormato(x.clave, filas);
        return [{ clave: x.clave, titulo: typeof x.titulo === 'string' ? x.titulo : tituloClave(x.clave), formato }];
      }
      return [];
    });
  }
  const excluir = new Set(Array.isArray(configuracion.excluir) ? (configuracion.excluir as unknown[]).map(String) : []);
  // En PDF se omiten por defecto los identificadores internos (*_id); en Excel se conservan.
  const incluirIds = configuracion.incluirIds === true || destino === 'xlsx';
  const claves: string[] = [];
  for (const f of filas) for (const k of Object.keys(f)) if (!claves.includes(k)) claves.push(k);
  return claves
    .filter((k) => !excluir.has(k) && (incluirIds || !(k === 'id' || k.endsWith('_id'))))
    .map((k) => ({ clave: k, titulo: tituloClave(k), formato: inferirFormato(k, filas) }));
}

/** Valor normalizado para exportar (rangos legibles, objetos como JSON). */
export function valorExportable(v: unknown): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && RANGO.test(v)) {
    const r = leerRangoFechas(v);
    if (r.inicio || r.fin) return `${r.inicio ? formatoFecha(r.inicio) : '…'} – ${r.fin ? formatoFecha(r.fin) : 'vigente'}`;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return v as string | number | boolean;
}

function aplanar(prefijo: string, valor: unknown): [string, unknown][] {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return Object.entries(valor as Record<string, unknown>).flatMap(([k, v]) => aplanar(prefijo ? `${prefijo}.${k}` : k, v));
  }
  return [[prefijo, valor]];
}

/** Secciones del resumen de indicadores (`datos.filas[0]` = jsonb de indicadores_dashboard). */
export function seccionesDashboard(indicadores: Fila): { titulo: string; filas: [string, string][] }[] {
  return SECCIONES_DASHBOARD.flatMap(([ruta, titulo]) => {
    const valor = ruta.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Fila)[k] : undefined), indicadores);
    if (!valor || typeof valor !== 'object') return [];
    const filas = aplanar('', valor).map(([k, v]): [string, string] => {
      const formato: FormatoColumna = ES_MONEDA.test(k) && k !== 'matriculas_con_mora' ? 'moneda' : 'numero';
      return [ETIQUETAS_DASHBOARD[k] ?? tituloClave(k), v === null || v === undefined ? '—' : textoCelda(v, formato)];
    });
    return [{ titulo, filas }];
  });
}

export interface EntradaGeneracion {
  id: string;
  tipo: string;
  formato: string;
  titulo: string;
  subtitulo: string;
  datos: unknown;
  configuracion: Record<string, unknown>;
  logo?: LogoPdf | null;
}

function filasDe(datos: unknown): Fila[] {
  const filas = datos && typeof datos === 'object' ? (datos as { filas?: unknown }).filas : undefined;
  return Array.isArray(filas) ? filas.filter((f): f is Fila => Boolean(f) && typeof f === 'object' && !Array.isArray(f)) : [];
}

function nombreArchivo(titulo: string, id: string, formato: string) {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'documento'}-${id}.${formato}`;
}

/** Construye el contenido del archivo. Lanza error si el formato no es pdf/xlsx. */
export async function generarArchivoDocumento(e: EntradaGeneracion): Promise<{ contenido: Buffer; nombre: string; mime: string }> {
  const mime = MIME_FORMATO[e.formato];
  if (!mime) throw new Error(`Formato de documento no soportado: ${e.formato}`);
  const titulo = typeof e.configuracion.titulo === 'string' && e.configuracion.titulo.trim() ? e.configuracion.titulo : e.titulo;
  const subtitulo = [typeof e.configuracion.subtitulo === 'string' ? e.configuracion.subtitulo : '', e.subtitulo].filter(Boolean).join(' — ');
  const filas = filasDe(e.datos);
  let contenido: Buffer;

  if (e.tipo === 'dashboard') {
    const secciones = filas[0] ? seccionesDashboard(filas[0]) : [];
    if (e.formato === 'pdf') {
      contenido = await generarPdfResumen({ titulo, subtitulo, secciones, logo: e.logo });
    } else {
      const lineas = secciones.flatMap((s) => s.filas.map(([indicador, valor]) => ({ seccion: s.titulo, indicador, valor })));
      contenido = await generarExcelListado({
        titulo,
        filtros: subtitulo ? { Parámetros: subtitulo } : undefined,
        columnas: [
          { titulo: 'Sección', valor: 'seccion', ancho: 30 },
          { titulo: 'Indicador', valor: 'indicador', ancho: 32 },
          { titulo: 'Valor', valor: 'valor', ancho: 20 },
        ],
        filas: lineas,
      });
    }
  } else {
    const columnas = columnasDocumento(filas, e.configuracion, e.formato === 'pdf' ? 'pdf' : 'xlsx');
    if (e.formato === 'pdf') {
      contenido = await generarPdfTabla({
        titulo,
        subtitulo: [subtitulo, `${filas.length} registro(s)`].filter(Boolean).join(' — '),
        columnas: columnas.map((c) => ({ titulo: c.titulo, peso: c.clave === 'conclusion' || c.clave === 'competencia' ? 2 : 1 })),
        filas: filas.map((f) => columnas.map((c) => textoCelda(valorExportable(f[c.clave]), c.formato))),
        horizontal: typeof e.configuracion.horizontal === 'boolean' ? e.configuracion.horizontal : undefined,
        logo: e.logo,
      });
    } else {
      const columnasExcel: ColumnaExportacion<Fila>[] = columnas.map((c) => ({
        titulo: c.titulo,
        formato: c.formato,
        valor: (f: Fila) => valorExportable(f[c.clave]),
      }));
      contenido = await generarExcelListado({ titulo, columnas: columnasExcel, filas, filtros: subtitulo ? { Parámetros: subtitulo } : undefined });
    }
  }
  return { contenido, nombre: nombreArchivo(titulo, e.id, e.formato), mime };
}
