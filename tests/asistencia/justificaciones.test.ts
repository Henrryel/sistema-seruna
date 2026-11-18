import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as registro from '@/server/services/asistencia/registro';
import * as justificaciones from '@/server/services/asistencia/justificaciones';
import { hoyLima, sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearUsuario, vincularApoderado } from '@tests/fixtures/base';
import { crearEscenarioAlumnos, crearEscenarioDocente } from '@tests/fixtures/asistencia';

const estadoAsistencia = async (id: string) =>
  (await db().selectFrom('asistencia_estudiantes').select(['estado', 'motivo']).where('id', '=', id).executeTakeFirstOrThrow());

/** Escenario: dos alumnos con asistencia de ayer registrada a mano por el admin (ausente y presente). */
async function escenario() {
  const admin = await crearAdmin();
  const ayer = sumarDias(hoyLima(), -1);
  const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, alumnos: 2, fecha: ayer, entrada: '08:00', salida: '13:00' });
  const [a1, a2] = esc.alumnos as [(typeof esc.alumnos)[0], (typeof esc.alumnos)[0]];
  const lote = await registro.registrarDiario(
    admin.actor,
    {
      jornadaId: esc.jornadaId,
      motivo: 'Registro de aula',
      registros: [
        { matriculaId: a1.matriculaId, estado: 'ausente' },
        { matriculaId: a2.matriculaId, estado: 'presente' },
      ],
    },
    'admin',
  );
  expect(lote).toMatchObject({ guardados: 2, errores: [] });
  const ids = await db()
    .selectFrom('asistencia_estudiantes')
    .select(['id', 'matricula_id'])
    .where('jornada_id', '=', esc.jornadaId)
    .execute();
  const id1 = ids.find((x) => x.matricula_id === a1.matriculaId)!.id;
  const id2 = ids.find((x) => x.matricula_id === a2.matriculaId)!.id;
  return { admin, esc, a1, a2, id1, id2 };
}

describe('justificaciones', () => {
  it('alumno solicita para sí; al aprobarse la asistencia queda "justificado"', () =>
    enPrueba(async () => {
      const { admin, a1, id1, id2 } = await escenario();
      const u = await crearUsuario({ roles: ['alumno'], personaId: a1.personaId });
      const alumno = await actorDe(u);
      // No puede justificar la asistencia de otro alumno.
      await esperarError(justificaciones.solicitarParaAlumno(alumno, { asistenciaId: id2, motivo: 'Cita médica' }, 'estudiante'), 'Forbidden');

      const evidencia = { contenido: Buffer.from('%PDF-1.4 certificado'), nombreOriginal: 'certificado.pdf', tipoMime: 'application/pdf' };
      const j = await justificaciones.solicitarParaAlumno(alumno, { asistenciaId: id1, motivo: 'Cita médica' }, 'estudiante', evidencia);
      expect(j.estado).toBe('pendiente');
      // Una segunda solicitud vigente para la misma asistencia la rechaza la base (índice único).
      await esperarError(justificaciones.solicitarParaAlumno(alumno, { asistenciaId: id1, motivo: 'Otra vez' }, 'estudiante'), 'Conflict');

      const resumen = await registro.resumenPropioAlumno(alumno, {});
      expect(resumen.justificaciones.map((x) => x.id)).toEqual([j.id]);
      expect(resumen.justificaciones[0]?.tiene_evidencia).toBe(true);

      await justificaciones.resolver(admin.actor, j.id, { estado: 'aprobada', decision: 'Certificado conforme' });
      expect(await estadoAsistencia(id1)).toEqual({ estado: 'justificado', motivo: `Justificación aprobada #${j.id}` });
      // Se resuelve una sola vez.
      await esperarError(justificaciones.resolver(admin.actor, j.id, { estado: 'rechazada', decision: 'x' }), 'Conflict');
      // El alumno ve su evidencia.
      const archivo = await justificaciones.evidencia(alumno, j.id);
      expect(archivo.nombre_original).toBe('certificado.pdf');
    }));

  it('rechazada: la asistencia conserva su estado; solo se justifica ausente o tarde', () =>
    enPrueba(async () => {
      const { admin, a1, a2, id1, id2 } = await escenario();
      const alumno = await actorDe(await crearUsuario({ roles: ['alumno'], personaId: a1.personaId }));
      const j = await justificaciones.solicitarParaAlumno(alumno, { asistenciaId: id1, motivo: 'Viaje familiar' }, 'estudiante');
      await justificaciones.resolver(admin.actor, j.id, { estado: 'rechazada', decision: 'No es causa justificada' });
      expect((await estadoAsistencia(id1)).estado).toBe('ausente');
      // Presente: la base no admite justificarla.
      const otro = await actorDe(await crearUsuario({ roles: ['alumno'], personaId: a2.personaId }));
      await esperarError(justificaciones.solicitarParaAlumno(otro, { asistenciaId: id2, motivo: 'No aplica' }, 'estudiante'), 'Validation', /ausencia o tardanza/);
      // Sin permiso asistencia.resolver no se resuelve.
      await esperarError(justificaciones.resolver(alumno, j.id, { estado: 'aprobada', decision: 'x' }), 'Forbidden');
    }));

  it('apoderado: con vínculo vigente sí; sin vínculo Forbidden', () =>
    enPrueba(async () => {
      const { admin, a1, id1 } = await escenario();
      const sinVinculo = await actorDe(await crearUsuario({ roles: ['apoderado'] }));
      await esperarError(justificaciones.solicitarParaAlumno(sinVinculo, { asistenciaId: id1, motivo: 'Enfermedad' }, 'padre'), 'Forbidden');
      await esperarError(registro.resumenHijo(sinVinculo, a1.estudianteId, {}), 'Forbidden');

      const padreU = await crearUsuario({ roles: ['apoderado'] });
      await vincularApoderado({ estudianteId: a1.estudianteId, personaId: padreU.personaId, verificadoPor: admin.usuarioId, academico: false, economico: true });
      const sinAcademico = await actorDe(padreU);
      await esperarError(justificaciones.solicitarParaAlumno(sinAcademico, { asistenciaId: id1, motivo: 'Enfermedad' }, 'padre'), 'Forbidden', /académica/);

      const madreU = await crearUsuario({ roles: ['apoderado'] });
      await vincularApoderado({ estudianteId: a1.estudianteId, personaId: madreU.personaId, verificadoPor: admin.usuarioId });
      const madre = await actorDe(madreU);
      const j = await justificaciones.solicitarParaAlumno(madre, { asistenciaId: id1, motivo: 'Enfermedad' }, 'padre');
      expect(j.estado).toBe('pendiente');
      const resumen = await registro.resumenHijo(madre, a1.estudianteId, {});
      expect(resumen.totales.ausente).toBe(1);
      expect(resumen.diaria[0]).toMatchObject({ estado: 'ausente', justificacion_estado: 'pendiente', justificable: false });
    }));

  it('docente: justifica solo su propia asistencia', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario({ roles: ['docente'] });
      const esc = await crearEscenarioDocente({ personaId: u.personaId, fecha: sumarDias(hoyLima(), -1), entrada: '08:00', salida: '14:00' });
      const r = await registro.registrarDocente(admin.actor, { jornadaId: esc.jornadaId, estado: 'ausente', motivo: 'No se presentó' });
      const docente = await actorDe(u);
      const otro = await actorDe(await crearUsuario({ roles: ['docente'] }));
      await esperarError(justificaciones.solicitarParaDocente(otro, { asistenciaId: r.id, motivo: 'Capacitación UGEL' }), 'Forbidden');
      const j = await justificaciones.solicitarParaDocente(docente, { asistenciaId: r.id, motivo: 'Capacitación UGEL' });
      await justificaciones.resolver(admin.actor, j.id, { estado: 'aprobada', decision: 'Con oficio' });
      const a = await db().selectFrom('asistencia_docentes').select('estado').where('id', '=', r.id).executeTakeFirstOrThrow();
      expect(a.estado).toBe('justificado');
      const resumen = await registro.resumenPropioDocente(docente, {});
      expect(resumen.totales.justificado).toBe(1);
      expect(resumen.justificaciones[0]?.estado).toBe('aprobada');
    }));
});
