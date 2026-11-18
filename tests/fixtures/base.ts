// Fixtures reutilizables por todos los módulos. Usar SIEMPRE dentro de enPrueba() (todo se revierte).
import { randomInt } from 'node:crypto';
import { db, sql } from '@/server/db';
import { hashContrasena } from '@/server/auth/contrasenas';
import { construirActor, type Actor } from '@/server/auth/actor';

export const sufijo = () => `${Date.now().toString(36)}${randomInt(1_000_000).toString(36)}`;

export async function crearPersona(datos: Partial<{ nombres: string; apellidos: string; fechaNacimiento: string }> = {}) {
  return db()
    .insertInto('personas')
    .values({
      nombres: datos.nombres ?? 'Nombre',
      apellidos: datos.apellidos ?? `Prueba ${sufijo()}`,
      fecha_nacimiento: datos.fechaNacimiento ?? null,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

let hashPrueba: Promise<string> | undefined;
export const CONTRASENA_PRUEBA = 'Clave12345';

/** Usuario con roles (códigos de `roles`). Por defecto activo con CONTRASENA_PRUEBA. */
export async function crearUsuario(
  opciones: { roles?: string[]; estado?: 'pendiente' | 'activo' | 'suspendido'; personaId?: string; login?: string } = {},
) {
  const personaId = opciones.personaId ?? (await crearPersona()).id;
  const estado = opciones.estado ?? 'activo';
  hashPrueba ??= hashContrasena(CONTRASENA_PRUEBA);
  const login = opciones.login ?? `prueba_${sufijo()}`;
  const u = await db()
    .insertInto('usuarios')
    .values({ persona_id: personaId, login, estado, contrasena_hash: estado === 'pendiente' ? null : await hashPrueba })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  for (const rol of opciones.roles ?? []) {
    await db()
      .insertInto('usuario_roles')
      .columns(['usuario_id', 'rol_id'])
      .expression((eb) => eb.selectFrom('roles').select([sql<string>`${u.id}::bigint`.as('usuario_id'), 'id']).where('codigo', '=', rol))
      .execute();
  }
  return { usuarioId: u.id, personaId, login };
}

/** Actor como lo construye la app a partir de una sesión. */
export async function actorDe(usuario: { usuarioId: string; personaId: string; login: string }): Promise<Actor> {
  const p = await db().selectFrom('personas').select(['nombres', 'apellidos']).where('id', '=', usuario.personaId).executeTakeFirstOrThrow();
  return construirActor({ ...usuario, nombres: p.nombres, apellidos: p.apellidos, sesionId: '0' });
}

export async function crearAdmin() {
  const u = await crearUsuario({ roles: ['admin'] });
  return { ...u, actor: await actorDe(u) };
}

/** Año académico (aleatorio para no chocar con datos reales) con sus 4 bimestres consecutivos. */
export async function crearAnio(opciones: { anio?: number; inicio?: string; fin?: string } = {}) {
  const anio = opciones.anio ?? 2100 + randomInt(100);
  const inicio = opciones.inicio ?? `${anio}-03-01`;
  const fin = opciones.fin ?? `${anio}-12-20`;
  const a = await db().insertInto('anios_academicos').values({ anio, inicio, fin, estado: 'abierto' }).returning(['id']).executeTakeFirstOrThrow();
  const rangos: [string, string][] = [
    [`${anio}-03-01`, `${anio}-05-09`],
    [`${anio}-05-19`, `${anio}-07-18`],
    [`${anio}-08-04`, `${anio}-10-10`],
    [`${anio}-10-20`, fin],
  ];
  const bimestres: { id: string; numero: number; inicio: string; fin: string }[] = [];
  for (const [i, [bi, bf]] of rangos.entries()) {
    const b = await db().insertInto('bimestres').values({ anio_id: a.id, numero: i + 1, inicio: bi, fin: bf }).returning(['id']).executeTakeFirstOrThrow();
    bimestres.push({ id: b.id, numero: i + 1, inicio: bi, fin: bf });
  }
  return { anioId: a.id, anio, inicio, fin, bimestres };
}

/** Grado sembrado por nivel y número (primaria 1..6, secundaria 1..5). */
export async function gradoId(nivel: 'primaria' | 'secundaria', numero: number) {
  const g = await db()
    .selectFrom('grados as g')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select('g.id')
    .where('n.codigo', '=', nivel)
    .where('g.numero', '=', numero)
    .executeTakeFirstOrThrow();
  return g.id;
}

export async function crearSeccion(anioId: string, grado: string, opciones: { nombre?: string; cupo?: number; reserva?: number } = {}) {
  return db()
    .insertInto('secciones')
    .values({ anio_id: anioId, grado_id: grado, nombre: opciones.nombre ?? 'A', turno: 'Mañana', cupo: opciones.cupo ?? 30, reserva: opciones.reserva ?? 2 })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function crearEstudiante(opciones: { personaId?: string; codigoSiagie?: string } = {}) {
  const personaId = opciones.personaId ?? (await crearPersona()).id;
  const e = await db()
    .insertInto('estudiantes')
    .values({ persona_id: personaId, codigo: `E-${sufijo()}`, codigo_siagie: opciones.codigoSiagie ?? null })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return { estudianteId: e.id, personaId };
}

export async function crearDocente(opciones: { personaId?: string } = {}) {
  const personaId = opciones.personaId ?? (await crearPersona()).id;
  const d = await db().insertInto('docentes').values({ persona_id: personaId, codigo: `D-${sufijo()}` }).returning(['id']).executeTakeFirstOrThrow();
  return { docenteId: d.id, personaId };
}

/** Regla de matrícula publicada para año/grado/tipo de ingreso. */
export async function crearReglaMatricula(anioId: string, grado: string, tipoIngreso: 'nuevo' | 'continuidad' | 'traslado' = 'nuevo') {
  return db()
    .insertInto('reglas_matricula')
    .values({
      anio_id: anioId,
      grado_id: grado,
      tipo_ingreso: tipoIngreso,
      version: 1,
      solicitudes_inicio: '2000-01-01',
      solicitudes_fin: '2200-12-31',
      publicada_en: sql`now()`,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/**
 * Matrícula ACTIVA y confirmada, ubicada en la sección durante todo el año.
 * Devuelve ids útiles para cobros, asistencia y evaluación.
 */
export async function crearMatriculaActiva(opciones: {
  registradoPor: string;
  anio?: Awaited<ReturnType<typeof crearAnio>>;
  nivel?: 'primaria' | 'secundaria';
  grado?: number;
  estudianteId?: string;
  seccionId?: string;
}) {
  const anio = opciones.anio ?? (await crearAnio());
  const grado = await gradoId(opciones.nivel ?? 'primaria', opciones.grado ?? 1);
  const seccionId = opciones.seccionId ?? (await crearSeccion(anio.anioId, grado)).id;
  const estudianteId = opciones.estudianteId ?? (await crearEstudiante()).estudianteId;
  const regla = await crearReglaMatricula(anio.anioId, grado);
  const m = await db()
    .insertInto('matriculas')
    .values({
      estudiante_id: estudianteId,
      anio_id: anio.anioId,
      grado_id: grado,
      regla_id: regla.id,
      tipo_ingreso: 'nuevo',
      estado: 'activa',
      confirmada_en: sql`now()`,
      registrado_por: opciones.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  const ms = await db()
    .insertInto('matricula_secciones')
    .values({
      matricula_id: m.id,
      seccion_id: seccionId,
      anio_id: anio.anioId,
      grado_id: grado,
      vigencia: `[${anio.inicio},${anio.fin}]`,
      registrado_por: opciones.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return { matriculaId: m.id, matriculaSeccionId: ms.id, estudianteId, seccionId, gradoId: grado, anio };
}

/** Vincula un apoderado (persona) con un estudiante, verificado, con los accesos indicados. */
export async function vincularApoderado(opciones: {
  estudianteId: string;
  personaId: string;
  verificadoPor: string;
  academico?: boolean;
  economico?: boolean;
  vigencia?: string;
}) {
  return db()
    .insertInto('estudiante_apoderado')
    .values({
      estudiante_id: opciones.estudianteId,
      persona_id: opciones.personaId,
      parentesco: 'madre',
      vigencia: opciones.vigencia ?? '[2000-01-01,)',
      verificado_por: opciones.verificadoPor,
      verificado_en: sql`now()`,
      acceso_academico: opciones.academico ?? true,
      acceso_economico: opciones.economico ?? true,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}
