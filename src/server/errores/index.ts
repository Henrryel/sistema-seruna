import { MENSAJES_DB, PATRONES_DB } from './mensajes-db';
import type { TipoErrorDb } from './tipos';

export type TipoError = TipoErrorDb | 'Unauthorized' | 'RateLimit' | 'Interno';

const ESTADO_HTTP: Record<TipoError, number> = {
  Validation: 422,
  NotFound: 404,
  Forbidden: 403,
  Conflict: 409,
  Unauthorized: 401,
  RateLimit: 429,
  Interno: 500,
};

/** Error de dominio con mensaje apto para el usuario final (en español). */
export class ErrorDominio extends Error {
  readonly tipo: TipoError;
  readonly status: number;
  readonly detalles?: unknown;
  readonly codigoDb?: string;

  constructor(tipo: TipoError, mensaje: string, opciones?: { detalles?: unknown; codigoDb?: string; causa?: unknown }) {
    super(mensaje, { cause: opciones?.causa });
    this.name = `${tipo}Error`;
    this.tipo = tipo;
    this.status = ESTADO_HTTP[tipo];
    this.detalles = opciones?.detalles;
    this.codigoDb = opciones?.codigoDb;
  }
}

export class NotFoundError extends ErrorDominio {
  constructor(mensaje = 'El registro no existe', detalles?: unknown) {
    super('NotFound', mensaje, { detalles });
  }
}
export class ForbiddenError extends ErrorDominio {
  constructor(mensaje = 'No tiene permiso para realizar esta acción') {
    super('Forbidden', mensaje);
  }
}
export class ValidationError extends ErrorDominio {
  constructor(mensaje = 'Datos inválidos', detalles?: unknown) {
    super('Validation', mensaje, { detalles });
  }
}
export class ConflictError extends ErrorDominio {
  constructor(mensaje: string, detalles?: unknown) {
    super('Conflict', mensaje, { detalles });
  }
}
export class UnauthorizedError extends ErrorDominio {
  constructor(mensaje = 'Inicie sesión para continuar') {
    super('Unauthorized', mensaje);
  }
}
export class RateLimitError extends ErrorDominio {
  constructor(mensaje = 'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.') {
    super('RateLimit', mensaje);
  }
}

interface ErrorPostgres {
  code: string;
  message: string;
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
}

function esErrorPostgres(e: unknown): e is ErrorPostgres {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { code?: unknown }).code === 'string' &&
    /^[0-9A-Z]{5}$/.test((e as { code: string }).code) &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

/** Mensajes amigables para restricciones frecuentes (el resto usa un mensaje genérico). */
const RESTRICCIONES: Record<string, string> = {
  usuarios_login_key: 'Ya existe un usuario con ese login',
  usuarios_persona_id_key: 'La persona ya tiene una cuenta de usuario',
  usuarios_login_check: 'El login debe estar en minúsculas y sin espacios',
  usuarios_check: 'Un usuario activo debe tener contraseña',
  documentos_identidad_tipo_pais_emisor_numero_key: 'Ese documento de identidad ya está registrado',
  documentos_identidad_check: 'El DNI debe tener 8 dígitos y país PE',
  estudiantes_codigo_key: 'Ya existe un estudiante con ese código',
  estudiantes_codigo_siagie_key: 'Ese código SIAGIE ya está asignado',
  estudiantes_persona_id_key: 'La persona ya tiene perfil de estudiante',
  docentes_codigo_key: 'Ya existe un docente con ese código',
  docentes_persona_id_key: 'La persona ya tiene perfil de docente',
  matriculas_estudiante_id_anio_id_key: 'El estudiante ya tiene matrícula en ese año',
  anios_academicos_anio_key: 'Ese año académico ya existe',
  bimestres_anio_id_numero_key: 'Ese bimestre ya existe en el año',
  secciones_anio_id_grado_id_nombre_key: 'Ya existe una sección con ese nombre en el grado y año',
  pagos_clave_idempotencia_key: 'Este pago ya fue registrado',
  marcaciones_evento_uuid_key: 'Esta marcación ya fue registrada',
  sesiones_caja_una_abierta: 'La caja ya tiene una sesión abierta',
  series_recibos_codigo_key: 'Ya existe una serie de recibos con ese código',
  cajas_nombre_key: 'Ya existe una caja con ese nombre',
  comprobantes_externos_ruc_emisor_tipo_serie_numero_key: 'Ese comprobante (RUC, tipo, serie y número) ya está registrado',
  tramos_plan_cobro_plan_id_concepto_numero_key: 'El plan ya tiene un tramo con ese concepto y número',
  tramos_plan_cobro_plan_id_mes_servicio_key: 'El plan ya tiene una pensión para ese mes',
  planes_cobro_anio_id_grado_id_version_key: 'Ya existe esa versión del plan de cobro para el año y grado',
  areas_curriculares_codigo_key: 'Ya existe un área con ese código',
  asignaturas_codigo_key: 'Ya existe una asignatura con ese código',
  aulas_codigo_key: 'Ya existe un aula con ese código',
  competencias_codigo_version_key: 'Ya existe esa versión de la competencia',
  lectores_qr_codigo_key: 'Ya existe un lector con ese código',
  tipos_documento_codigo_key: 'Ya existe un tipo de documento con ese código',
  periodos_liquidacion_mes_key: 'El período de ese mes ya existe',
  contratos_docentes_docente_id_referencia_key: 'El docente ya tiene un contrato con esa referencia',
  contratos_docentes_docente_id_vigencia_excl: 'El contrato se superpone con otro contrato vigente del docente en ese período',
  calificaciones_competencia_matricula_id_bimestre_id_compete_key:
    'Ya existe una calificación para esa competencia y bimestre',
};

function mensajeP0001(mensaje: string): TipoErrorDb {
  const exacto = MENSAJES_DB[mensaje];
  if (exacto) return exacto;
  const patron = PATRONES_DB.find((p) => mensaje.startsWith(p.prefijo));
  return patron?.tipo ?? 'Validation';
}

/** Traduce errores de PostgreSQL (SQLSTATE y RAISE EXCEPTION) a errores de dominio. */
export function traducirErrorDb(e: unknown): ErrorDominio | null {
  if (!esErrorPostgres(e)) return null;
  const amigable = e.constraint ? RESTRICCIONES[e.constraint] : undefined;
  const opciones = { codigoDb: e.code, causa: e, detalles: e.constraint ? { restriccion: e.constraint } : undefined };
  switch (e.code) {
    case 'P0001':
      if (e.message.startsWith('El historial de asistencia es de solo inserción') && e.table) {
        return new ErrorDominio('Conflict', 'Este registro histórico es inmutable', opciones);
      }
      return new ErrorDominio(mensajeP0001(e.message), e.message, opciones);
    case 'P0002':
      return new ErrorDominio('NotFound', 'El registro solicitado no existe o no está disponible', opciones);
    case 'P0003':
      return new ErrorDominio('Conflict', 'La consulta devolvió más de un registro', opciones);
    case '23505':
      return new ErrorDominio('Conflict', amigable ?? 'Ya existe un registro con esos datos', opciones);
    case '23P01':
      return new ErrorDominio('Conflict', amigable ?? 'Se superpone con otro registro vigente en el mismo período', opciones);
    case '23503':
      return new ErrorDominio(
        'Validation',
        amigable ??
          (/update or delete|actualizar o eliminar/i.test(e.message)
            ? 'No se puede eliminar o cambiar: hay registros relacionados'
            : 'Hace referencia a un registro que no existe o no corresponde'),
        opciones,
      );
    case '23514':
      return new ErrorDominio('Validation', amigable ?? 'Los datos no cumplen una regla de validación de la base', opciones);
    case '23502':
      return new ErrorDominio('Validation', `Falta un dato obligatorio${e.column ? `: ${e.column}` : ''}`, opciones);
    case '22P02':
    case '22007':
    case '22008':
    case '22003':
    case '22001':
      return new ErrorDominio('Validation', 'Algún dato tiene un formato o tamaño inválido', opciones);
    case '40001':
    case '40P01':
    case '55P03':
      return new ErrorDominio('Conflict', 'Otra operación está usando estos datos. Inténtelo de nuevo.', opciones);
    default:
      return null;
  }
}

/** Normaliza cualquier error a ErrorDominio (los desconocidos quedan como Interno). */
export function aErrorDominio(e: unknown): ErrorDominio {
  if (e instanceof ErrorDominio) return e;
  return traducirErrorDb(e) ?? new ErrorDominio('Interno', 'Ocurrió un error inesperado', { causa: e });
}
