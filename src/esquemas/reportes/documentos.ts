import { z } from 'zod';
import type { Permiso } from '@/lib/permisos';
import { consultaListado, fecha, id, idOpcional, textoRequerido, uuid } from '../comunes';

export const ESTADOS_DOCUMENTO = ['preparado', 'emitido', 'fallido', 'anulado'] as const;

/** Cualquier permiso de reportes habilita la pantalla de documentos (cada tipo lo valida la base). */
export const PERMISOS_REPORTES: readonly Permiso[] = [
  'reportes.matriculas',
  'reportes.tesoreria',
  'reportes.academico',
  'reportes.asistencia',
  'reportes.dashboard',
  'reportes.configurar',
];

/** Comunicaciones de documentos institucionales. */
export const PERMISOS_COMUNICACIONES: readonly Permiso[] = ['matriculas.gestionar', 'reportes.configurar'];

/**
 * Solicitud de documento → `preparar_documento_reporte(uuid, plantilla, actor, desde, hasta, matrícula, sección, bimestre)`.
 * La base valida el permiso del tipo, los filtros admitidos, que pertenezcan al año y la idempotencia por UUID.
 */
export const esquemaSolicitudDocumento = z.object({
  solicitudUuid: uuid,
  plantillaId: id,
  desde: fecha,
  hasta: fecha,
  matriculaId: idOpcional,
  seccionId: idOpcional,
  bimestreId: idOpcional,
});

export type DatosSolicitudDocumento = z.infer<typeof esquemaSolicitudDocumento>;

export const esquemaAnulacionDocumento = z.object({ motivo: textoRequerido(500) });

export const consultaDocumentos = consultaListado.extend({
  estado: z.enum(ESTADOS_DOCUMENTO).optional(),
  tipo: z.string().max(60).optional(),
  anioId: idOpcional,
  propios: z.enum(['true', 'false']).optional(),
});

export const consultaMatriculasReporte = z.object({
  anioId: id,
  q: z.string().trim().max(100).optional(),
});

/**
 * Filtros que se muestran en el formulario según el tipo (solo guía de interfaz: la base es la que
 * decide y responde "El tipo de reporte no admite uno de los filtros enviados").
 */
export const FILTROS_TIPO_REPORTE: Record<string, { matricula?: 'opcional' | 'requerido'; seccion?: boolean; bimestre?: 'opcional' | 'requerido' }> = {
  ficha_matricula: { matricula: 'requerido' },
  nomina: { seccion: true },
  estado_cuenta: { matricula: 'requerido' },
  notas: { matricula: 'opcional', seccion: true, bimestre: 'requerido' },
  asistencia_alumnos: { matricula: 'opcional', seccion: true },
  asistencia_docentes: {},
  dashboard: { bimestre: 'opcional' },
};

export interface ParametrosDocumento {
  desde: string;
  hasta: string;
  matricula_id: number | string | null;
  seccion_id: number | string | null;
  bimestre_id: number | string | null;
}

export interface FilaDocumento {
  id: string;
  solicitud_uuid: string;
  plantilla_id: string;
  plantilla_nombre: string;
  plantilla_version: number;
  tipo: string;
  tipo_nombre: string;
  anio: number;
  formato: string;
  parametros: ParametrosDocumento;
  filas: number;
  estado: string;
  solicitado_por: string;
  solicitado_por_login: string | null;
  solicitado_en: string;
  procesado_en: string | null;
  motivo_fallo: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  archivo_id: string | null;
  archivo_bytes: number | null;
  puedeGestionar: boolean;
}

export interface ResumenColaDocumentos {
  preparado: number;
  emitido: number;
  fallido: number;
  anulado: number;
}

export interface ResultadoProcesoDocumento {
  id: string;
  estado: 'emitido' | 'fallido';
  motivo?: string;
}
