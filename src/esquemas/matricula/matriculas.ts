import { z } from 'zod';
import { consultaListado, fecha, fechaOpcional, id, idOpcional, textoOpcional, textoRequerido } from '../comunes';
import { ESTADOS_MATRICULA, METODOS_ACEPTACION, TIPOS_DOCUMENTO_RESPONSABLE, TIPOS_INGRESO, TIPOS_VACANTE } from './comunes';

export const esquemaSolicitud = z.object({
  estudianteId: id,
  anioId: id,
  gradoId: id,
  tipoIngreso: z.enum(TIPOS_INGRESO),
  referenciaSiagie: textoOpcional(50),
});
export type DatosSolicitud = z.infer<typeof esquemaSolicitud>;

export const esquemaConfirmacion = z.object({
  seccionId: id,
  /** Inicio de la ubicación en la sección (hasta el fin del año). */
  fecha,
  tipoVacante: z.enum(TIPOS_VACANTE).default('regular'),
  motivo: textoOpcional(300),
});
export type DatosConfirmacion = z.infer<typeof esquemaConfirmacion>;

export const esquemaCambioSeccion = z.object({
  seccionId: id,
  /** Primer día en la nueva sección (la anterior se cierra el día previo). */
  fecha,
  tipoVacante: z.enum(TIPOS_VACANTE).default('regular'),
  motivo: textoRequerido(300),
  detalle: textoOpcional(500),
});
export type DatosCambioSeccion = z.infer<typeof esquemaCambioSeccion>;

/** Retiro o traslado (multipart: admite `evidencia`). */
export const esquemaRetiro = z.object({
  tipo: z.enum(['retiro', 'traslado']),
  /** Primer día en que el estudiante deja de figurar en la sección. */
  fecha,
  motivo: textoRequerido(300),
  detalle: textoOpcional(500),
});
export type DatosRetiro = z.infer<typeof esquemaRetiro>;

export const esquemaReincorporacion = z.object({
  seccionId: id,
  fecha,
  tipoVacante: z.enum(TIPOS_VACANTE).default('regular'),
  motivo: textoRequerido(300),
});
export type DatosReincorporacion = z.infer<typeof esquemaReincorporacion>;

export const esquemaAnulacion = z.object({ fecha, motivo: textoRequerido(300) });
export type DatosAnulacion = z.infer<typeof esquemaAnulacion>;

export const esquemaResponsable = z.object({
  personaId: idOpcional,
  tipoDocumento: z.enum(TIPOS_DOCUMENTO_RESPONSABLE),
  numeroDocumento: z.string().trim().min(1, 'Requerido').max(20, 'Máximo 20 caracteres').transform((v) => v.toUpperCase()),
  nombreRazonSocial: textoRequerido(200),
  direccion: textoOpcional(200),
  /** Inicio de la responsabilidad; el responsable anterior se cierra el día previo. */
  desde: fecha,
});
export type DatosResponsable = z.infer<typeof esquemaResponsable>;

/** Aceptación de documento institucional (multipart: admite `evidencia`). */
export const esquemaAceptacion = z.object({
  documentoId: id,
  firmanteId: id,
  metodo: z.enum(METODOS_ACEPTACION),
  fecha: fechaOpcional,
});
export type DatosAceptacion = z.infer<typeof esquemaAceptacion>;

export const consultaMatriculas = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  seccionId: idOpcional,
  estudianteId: idOpcional,
  estado: z.enum(ESTADOS_MATRICULA).optional(),
  tipoIngreso: z.enum(TIPOS_INGRESO).optional(),
});

export const consultaNomina = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  seccionId: idOpcional,
  estado: z.enum(ESTADOS_MATRICULA).optional(),
  /** Ubicación vigente en esta fecha; sin fecha se toma la última ubicación de cada matrícula. */
  fecha: fechaOpcional,
});

export const consultaSecciones = z.object({ fecha: fechaOpcional });

export interface FilaMatricula {
  id: string;
  estudiante_id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: string;
  tipo_ingreso: string;
  estado: string;
  solicitada_en: string;
  confirmada_en: string | null;
  seccion: string | null;
  regla_version: number;
}

export interface FilaUbicacion {
  id: string;
  seccion_id: string;
  seccion: string;
  turno: string;
  desde: string;
  hasta: string;
  tipo_vacante: string;
}

export interface FilaMovimiento {
  id: string;
  tipo: string;
  fecha_efectiva: string;
  motivo: string;
  detalle: string | null;
  evidencia_id: string | null;
  registrado_por: string;
  registrado_en: string;
}

export interface FilaResponsable {
  id: string;
  matricula_id: string;
  anio: number | null;
  persona_id: string | null;
  tipo_documento: string;
  numero_documento: string;
  nombre_razon_social: string;
  direccion: string | null;
  desde: string;
  hasta: string | null;
  vigente: boolean;
}

export interface FilaAceptacion {
  id: string;
  documento_id: string;
  tipo: string;
  version: number;
  firmante_id: string;
  firmante: string;
  aceptado_en: string;
  metodo: string;
  evidencia_id: string | null;
}

export interface SeccionDisponible {
  id: string;
  nombre: string;
  turno: string;
  cupo: number;
  reserva: number;
  ocupadas: number;
  activa: boolean;
}

export interface DetalleMatricula {
  matricula: FilaMatricula & {
    referencia_siagie: string | null;
    regla_id: string;
    anio_inicio: string;
    anio_fin: string;
    nivel: string;
    persona_id: string;
    codigo_siagie: string | null;
    fecha_nacimiento: string | null;
  };
  ubicaciones: FilaUbicacion[];
  movimientos: FilaMovimiento[];
  responsables: FilaResponsable[];
  aceptaciones: FilaAceptacion[];
  documentos: { id: string; tipo: string; version: number; vigente_desde: string | null }[];
  firmantes: { persona_id: string; nombre: string; parentesco: string }[];
}

export interface FilaNomina {
  numero: number;
  matricula_id: string;
  estudiante_id: string;
  codigo: string;
  codigo_siagie: string | null;
  apellidos: string;
  nombres: string;
  nivel: string;
  grado: number;
  seccion: string | null;
  estado: string;
  tipo_ingreso: string;
  desde: string | null;
  hasta: string | null;
}
