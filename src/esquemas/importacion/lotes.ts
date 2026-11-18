import { z } from 'zod';
import { consultaListado, idOpcional, textoRequerido } from '../comunes';

/** Entidades del sistema anterior admitidas por `filas_importacion_entidad_check` (guía de interfaz). */
export const ENTIDADES_IMPORTACION = [
  'estudiantes',
  'profesores',
  'cursos',
  'estudiantes_cursos',
  'notas_bimestre',
  'entradas_notas',
  'reportes_notas',
  'materias_reportes_notas',
  'puntuaciones_notas',
  'valores_puntuaciones_notas',
  'registros_asistencia',
  'comentarios_estudiantes',
] as const;

export const NOMBRE_ENTIDAD: Record<string, string> = {
  estudiantes: 'Estudiantes',
  profesores: 'Profesores',
  cursos: 'Cursos',
  estudiantes_cursos: 'Estudiantes por curso',
  notas_bimestre: 'Notas por bimestre',
  entradas_notas: 'Entradas de notas',
  reportes_notas: 'Reportes de notas',
  materias_reportes_notas: 'Materias de reportes',
  puntuaciones_notas: 'Puntuaciones',
  valores_puntuaciones_notas: 'Valores de puntuaciones',
  registros_asistencia: 'Registros de asistencia',
  comentarios_estudiantes: 'Comentarios',
};

/** Entidades que admiten crear/vincular (el resto se archiva o excluye: lo decide la base). */
export const ENTIDADES_CONCILIABLES = ['estudiantes', 'profesores', 'cursos', 'estudiantes_cursos'] as const;

export const ESTADOS_LOTE = ['carga', 'revision', 'cerrado'] as const;
export const ACCIONES_CONCILIACION = ['crear', 'vincular', 'archivar', 'excluir'] as const;

export const NOMBRE_ACCION: Record<string, string> = {
  crear: 'Crear perfil',
  vincular: 'Vincular a existente',
  archivar: 'Archivar (histórico)',
  excluir: 'Excluir',
};

const textoOpcionalVacio = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : undefined));

/** Descriptor de cada archivo subido (en el mismo orden que los archivos del formulario). */
export const esquemaArchivoLote = z.object({
  entidad: textoRequerido(60),
  columnaClave: z.string().trim().min(1, 'Indique la columna clave').max(100).default('id'),
});

export type DescriptorArchivoLote = z.infer<typeof esquemaArchivoLote>;

/** Conteos esperados (manifiesto): la base los compara con las filas cargadas al sellar el lote. */
const conteos = z.record(z.string(), z.coerce.number().int().min(0, 'El conteo no puede ser negativo'));

export const esquemaLote = z.object({
  /** La base exige minúsculas y sin espacios alrededor: se normaliza aquí para comodidad del usuario. */
  sistema: textoRequerido(60).transform((v) => v.toLowerCase()),
  conteos,
  archivos: z.array(esquemaArchivoLote).min(1, 'Adjunte al menos un archivo'),
});

export type DatosLote = z.infer<typeof esquemaLote>;

export const esquemaCargaAdicional = z.object({
  archivos: z.array(esquemaArchivoLote).min(1, 'Adjunte al menos un archivo'),
});

export const esquemaConciliacion = z.object({
  entidad: textoRequerido(60),
  claveOrigen: z.string().min(1).max(500),
  accion: z.enum(ACCIONES_CONCILIACION),
  motivo: textoRequerido(500),
  destinoId: idOpcional,
  codigo: textoOpcionalVacio(40),
  personaExistenteId: idOpcional,
});

export type DatosConciliacion = z.infer<typeof esquemaConciliacion>;

/** Conciliación masiva de las filas PENDIENTES de una entidad (solo archivar/excluir). */
export const esquemaConciliacionMasiva = z.object({
  entidad: textoRequerido(60),
  accion: z.enum(['archivar', 'excluir']),
  motivo: textoRequerido(500),
});

export const consultaLotes = consultaListado.extend({
  estado: z.enum(ESTADOS_LOTE).optional(),
});

export const consultaFilasLote = consultaListado.extend({
  entidad: z.string().max(60).optional(),
  estado: z.enum(['pendiente', 'conciliada', ...ACCIONES_CONCILIACION]).optional(),
});

export const consultaArchivoHistorico = consultaListado.extend({
  sistema: z.string().max(60).optional(),
  entidad: z.string().max(60).optional(),
  loteId: idOpcional,
});

export interface FilaLote {
  id: string;
  sistema: string;
  sha256: string;
  conteos_esperados: Record<string, number>;
  creado_por_login: string | null;
  creado_en: string;
  estado: string;
  sellado_en: string | null;
  cerrado_en: string | null;
  cargadas: number;
  pendientes: number;
}

export interface FilaResumenImportacion {
  entidad: string;
  cargadas: number;
  creadas: number;
  vinculadas: number;
  archivadas: number;
  excluidas: number;
  pendientes: number;
}

export interface DetalleLote extends FilaLote {
  resumen: FilaResumenImportacion[];
}

export interface FilaImportacionVista {
  entidad: string;
  clave_origen: string;
  datos: Record<string, unknown>;
  accion: string | null;
  destino_id: string | null;
  motivo: string | null;
  revisada_en: string | null;
  revisada_por_login: string | null;
}

export interface FilaArchivoHistorico {
  sistema: string;
  sha256: string;
  lote_id: string;
  entidad: string;
  clave_origen: string;
  datos: Record<string, unknown>;
  motivo: string;
  revisada_en: string;
}
