import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/matricula/apoderados';
import * as repoEstudiantes from '@/server/repositories/matricula/estudiantes';
import type { Actor } from '@/server/auth/actor';
import type { DatosAccesos, DatosVinculo } from '@/esquemas/matricula/apoderados';
import { conMensajes, guardarOpcional, resolverPersona, type ArchivoSubido } from './comun';

// Vínculo estudiante–apoderado. La base impone: vigencia con inicio, sin solapes por persona y
// accesos (académico/económico) solo si el vínculo fue verificado (CHECK). No se duplican aquí.

export async function listarApoderados(estudianteId: string) {
  return repo.listarApoderados(estudianteId);
}

async function obtenerVinculo(id: string) {
  const v = await repo.obtenerVinculo(id);
  if (!v) throw new NotFoundError('El vínculo no existe');
  return v;
}

export async function vincularApoderado(actor: Actor, estudianteId: string, datos: DatosVinculo) {
  const est = await repoEstudiantes.obtenerEstudiante(estudianteId);
  if (!est) throw new NotFoundError('El estudiante no existe');
  return conMensajes(() =>
    transaccion(async () => {
      const { personaId, creada } = await resolverPersona(datos);
      if (personaId === est.persona_id) throw new ValidationError('El estudiante no puede ser su propio apoderado');
      if (creada) await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'personas', registroId: personaId, resultado: 'ok' });
      const r = await repo.crearVinculo({ estudianteId, personaId, parentesco: datos.parentesco, desde: datos.desde, hasta: datos.hasta ?? null });
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'vincular_apoderado', entidad: 'estudiante_apoderado', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}

/** Verifica el vínculo (verificado_por/en) con evidencia opcional. */
export async function verificarVinculo(actor: Actor, id: string, evidencia?: ArchivoSubido | null) {
  const v = await obtenerVinculo(id);
  if (v.verificado_en) throw new ConflictError('El vínculo ya fue verificado');
  return conMensajes(() =>
    transaccion(async () => {
      const evidenciaId = await guardarOpcional(evidencia);
      await repo.verificarVinculo(id, actor.usuarioId, evidenciaId);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'verificar', entidad: 'estudiante_apoderado', registroId: id, resultado: 'ok' });
      return { id, evidenciaId };
    }),
  );
}

/** Otorga o retira accesos. La base rechaza otorgarlos si el vínculo no está verificado. */
export async function actualizarAccesos(actor: Actor, id: string, datos: DatosAccesos) {
  await obtenerVinculo(id);
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.actualizarAccesos(id, datos.accesoAcademico, datos.accesoEconomico);
      await registrarBitacora({
        actorId: actor.usuarioId,
        accion: 'actualizar_accesos',
        entidad: 'estudiante_apoderado',
        registroId: id,
        motivo: `académico=${datos.accesoAcademico ? 'sí' : 'no'}; económico=${datos.accesoEconomico ? 'sí' : 'no'}`,
        resultado: 'ok',
      });
      return r;
    }),
  );
}

/** Termina el vínculo cerrando su vigencia en `fin` (inclusive). */
export async function terminarVinculo(actor: Actor, id: string, fin: string) {
  const v = await obtenerVinculo(id);
  if (fin < v.desde) throw new ValidationError('La fecha de término no puede ser anterior al inicio del vínculo');
  if (v.hasta && v.hasta <= fin) throw new ConflictError('El vínculo ya termina en esa fecha o antes');
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.terminarVinculo(id, fin);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'terminar_vinculo', entidad: 'estudiante_apoderado', registroId: id, resultado: 'ok' });
      return r;
    }),
  );
}
