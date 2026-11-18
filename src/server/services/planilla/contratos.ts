import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/planilla/contratos';
import type { Actor } from '@/server/auth/actor';
import type {
  DatosActualizarDocente,
  DatosContrato,
  DatosDocente,
  Modalidad,
} from '@/esquemas/planilla/contratos';
import { guardarAdjunto, type ArchivoSubido } from './archivos';

// Servicio de docentes y contratos. Las reglas (vigencia sin solapes, condiciones por modalidad, cambios
// permitidos cuando ya hay horas o liquidaciones) las impone la base: CHECK, EXCLUDE y
// `conservar_condiciones_contrato`. Aquí solo se orquesta la transacción y la auditoría.

export const listarDocentes = repo.listarDocentes;
export const listarContratos = repo.listarContratos;
export const buscarPersonas = repo.buscarPersonasSinDocente;

export function opcionesContratos(filtros: { modalidad?: Modalidad; fecha?: string; mes?: string }) {
  return repo.opcionesContratos(filtros);
}

export async function crearDocente(actor: Actor, d: DatosDocente) {
  return transaccion(async () => {
    let personaId = d.personaId;
    if (d.origen === 'nueva') {
      const persona = await repo.crearPersona({
        nombres: d.nombres ?? '',
        apellidos: d.apellidos ?? '',
        correo: d.correo,
        telefono: d.telefono,
      });
      personaId = persona.id;
      if (d.dni) await repo.crearDni(persona.id, d.dni);
      await registrarBitacora({
        actorId: actor.usuarioId,
        accion: 'crear',
        entidad: 'personas',
        registroId: persona.id,
        resultado: 'ok',
      });
    }
    if (!personaId) throw new ValidationError('Seleccione la persona');
    const r = await repo.crearDocente({ personaId, codigo: d.codigo, activo: d.activo });
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'crear',
      entidad: 'docentes',
      registroId: r.id,
      resultado: 'ok',
    });
    return { id: r.id, personaId };
  });
}

export async function actualizarDocente(actor: Actor, id: string, d: DatosActualizarDocente) {
  return transaccion(async () => {
    const r = await repo.actualizarDocente(id, d);
    if (!r) throw new NotFoundError('El docente no existe');
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'actualizar',
      entidad: 'docentes',
      registroId: id,
      motivo: d.activo ? null : 'Docente desactivado',
      resultado: 'ok',
    });
    return r;
  });
}

export async function obtenerContrato(id: string) {
  const c = await repo.obtenerContrato(id);
  if (!c) throw new NotFoundError('El contrato no existe');
  return c;
}

export async function crearContrato(actor: Actor, d: DatosContrato, documento?: ArchivoSubido | null) {
  return transaccion(async () => {
    const documentoId = await guardarAdjunto(documento);
    const r = await repo.crearContrato({ ...d, documentoId, registradoPor: actor.usuarioId });
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'crear',
      entidad: 'contratos_docentes',
      registroId: r.id,
      resultado: 'ok',
    });
    return r;
  });
}

/** Edita el contrato dentro de lo que permita la base (con horas o liquidaciones, solo la vigencia). */
export async function actualizarContrato(
  actor: Actor,
  id: string,
  d: DatosContrato,
  documento?: ArchivoSubido | null,
) {
  return transaccion(async () => {
    const documentoId = await guardarAdjunto(documento);
    const r = await repo.actualizarContrato(id, { ...d, documentoId: documentoId ?? undefined });
    if (!r) throw new NotFoundError('El contrato no existe');
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'actualizar',
      entidad: 'contratos_docentes',
      registroId: id,
      resultado: 'ok',
    });
    return r;
  });
}
