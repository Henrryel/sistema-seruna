import 'server-only';
import { aErrorDominio, ErrorDominio, ValidationError } from '@/server/errores';
import { guardarArchivo } from '@/server/almacenamiento';
import { hoyLima } from '@/lib/formato';
import * as repoPersonas from '@/server/repositories/matricula/personas';
import type { ReferenciaPersona } from '@/esquemas/matricula/comunes';

/**
 * Mensajes en español para restricciones de las tablas de matrícula. La regla la impone la base
 * (CHECK/UNIQUE/EXCLUDE); aquí solo se explica mejor al usuario cuál falló.
 */
const MENSAJES_RESTRICCION: Record<string, string> = {
  estudiante_apoderado_check: 'Verifique el vínculo antes de otorgar acceso académico o económico',
  estudiante_apoderado_vigencia_check: 'La vigencia del vínculo debe tener fecha de inicio',
  estudiante_apoderado_estudiante_id_persona_id_vigencia_excl: 'Esa persona ya tiene un vínculo con el estudiante en ese período',
  reglas_matricula_check: 'La edad máxima debe ser mayor o igual a la mínima (y no negativa)',
  reglas_matricula_check1: 'El fin de la ventana de solicitudes debe ser igual o posterior al inicio',
  reglas_matricula_check2: 'Indique la fecha de corte de edad si fija una edad mínima o máxima',
  reglas_matricula_edad_minima_check: 'La edad mínima no puede ser negativa',
  reglas_matricula_anio_id_grado_id_tipo_ingreso_version_key: 'Ya existe esa versión de la regla para el año, grado y tipo de ingreso',
  requisitos_matricula_check: 'El plazo de regularización solo aplica si el requisito admite regularización',
  tipos_documento_codigo_key: 'Ya existe un tipo de documento con ese código',
  matriculas_check: 'Una matrícula activa, retirada o trasladada debe estar confirmada',
  matriculas_check1: 'La confirmación no puede ser anterior a la solicitud',
  matricula_secciones_matricula_id_vigencia_excl: 'La matrícula ya tiene una sección asignada en ese período',
  matricula_secciones_vigencia_check: 'La ubicación en la sección debe tener inicio y fin',
  responsables_economicos_matricula_id_vigencia_excl: 'Ya hay un responsable económico vigente en ese período',
  responsables_economicos_vigencia_check: 'La vigencia del responsable económico debe tener fecha de inicio',
  documentos_institucionales_anio_id_tipo_version_key: 'Ya existe esa versión del documento en el año',
  documentos_institucionales_check: 'Indique la fecha de vigencia (vigente desde) para publicar el documento',
  aceptaciones_documento_matricula_id_documento_id_firmante_i_key: 'Ese firmante ya aceptó este documento para la matrícula',
  aceptaciones_documento_documento_id_anio_id_fkey: 'El documento no corresponde al año de la matrícula',
  matricula_secciones_seccion_id_anio_id_grado_id_fkey: 'La sección no corresponde al año y grado de la matrícula',
  documentos_expediente_matricula_id_estudiante_id_fkey: 'La matrícula no corresponde al estudiante',
  documentos_expediente_check: 'La revisión exige revisor y fecha',
  matriculas_regla_id_anio_id_grado_id_tipo_ingreso_fkey: 'La regla no corresponde al año, grado y tipo de ingreso',
};

function conMensaje(e: unknown): unknown {
  if (e instanceof ErrorDominio && !e.codigoDb) return e;
  const d = aErrorDominio(e);
  if (d.tipo === 'Interno') return e;
  const restriccion = (d.detalles as { restriccion?: string } | undefined)?.restriccion;
  const mensaje = restriccion ? MENSAJES_RESTRICCION[restriccion] : undefined;
  return mensaje ? new ErrorDominio(d.tipo, mensaje, { detalles: d.detalles, codigoDb: d.codigoDb, causa: e }) : d;
}

/** Ejecuta la operación y traduce los errores de restricciones del dominio a mensajes claros. */
export async function conMensajes<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw conMensaje(e);
  }
}

export const hoy = () => hoyLima();

/** Edad cumplida en `corte` para quien nació en `nacimiento` (ambas 'YYYY-MM-DD'). */
export function edadAl(nacimiento: string, corte: string): number {
  const [an, mn, dn] = nacimiento.split('-').map(Number) as [number, number, number];
  const [ac, mc, dc] = corte.split('-').map(Number) as [number, number, number];
  let edad = ac - an;
  if (mc < mn || (mc === mn && dc < dn)) edad -= 1;
  return edad;
}

/** Persona existente (verifica que exista) o nueva (con su documento de identidad, si se indicó). */
export async function resolverPersona(ref: ReferenciaPersona): Promise<{ personaId: string; creada: boolean }> {
  if (ref.personaId) {
    const p = await repoPersonas.obtenerPersona(ref.personaId);
    if (!p) throw new ValidationError('La persona seleccionada no existe');
    return { personaId: p.id, creada: false };
  }
  if (!ref.persona) throw new ValidationError('Seleccione una persona o registre una nueva');
  const d = ref.persona;
  const { id } = await repoPersonas.crearPersona(d);
  if (d.documentoTipo && d.documentoNumero) {
    await repoPersonas.crearDocumentoIdentidad(id, { tipo: d.documentoTipo, numero: d.documentoNumero.toUpperCase(), paisEmisor: d.documentoPais });
  }
  return { personaId: id, creada: true };
}

export interface ArchivoSubido {
  contenido: Buffer;
  nombreOriginal: string;
  tipoMime: string;
}

/** Guarda un archivo opcional (evidencias) y devuelve su id. */
export async function guardarOpcional(archivo: ArchivoSubido | null | undefined): Promise<string | null> {
  if (!archivo) return null;
  const a = await guardarArchivo(archivo);
  return a.id;
}
