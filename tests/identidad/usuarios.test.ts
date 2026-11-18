import { afterEach, describe, expect, it } from 'vitest';
import { randomInt } from 'node:crypto';
import { db, sql } from '@/server/db';
import { esquemaCrearPersona, esquemaDocumento } from '@/esquemas/identidad/personas';
import { esquemaCrearUsuario } from '@/esquemas/identidad/usuarios';
import * as personas from '@/server/services/identidad/personas';
import * as usuarios from '@/server/services/identidad/usuarios';
import { listarBitacora } from '@/server/services/identidad/bitacora';
import { canjearTokenAcceso, consultarTokenAcceso, iniciarSesion } from '@/server/services/auth';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { CONTRASENA_PRUEBA, crearAdmin, crearPersona, crearUsuario, sufijo } from '@tests/fixtures/base';

const dniAleatorio = () => `7${randomInt(10_000_000).toString().padStart(7, '0')}`;
const appUrlOriginal = process.env.APP_URL;

afterEach(() => {
  if (appUrlOriginal === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = appUrlOriginal;
});

async function eventos(usuarioId: string) {
  return db().selectFrom('bitacora').select(['accion', 'entidad', 'motivo', 'actor_id']).where('usuario_afectado_id', '=', usuarioId).orderBy('id').execute();
}

describe('personas y documentos de identidad', () => {
  it('crea una persona con DNI y la encuentra por nombre (sin tildes) o por documento', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const s = sufijo();
      const dni = dniAleatorio();
      const p = await personas.crearPersona(
        admin.actor,
        esquemaCrearPersona.parse({ nombres: 'Lucía', apellidos: `Quispe ${s}`, correoContacto: 'LUCIA@Correo.pe', documento: { tipo: 'DNI', numero: dni } }),
      );
      const detalle = await personas.obtenerPersona(p.id);
      expect(detalle.correo_contacto).toBe('lucia@correo.pe');
      expect(detalle.documentos).toMatchObject([{ tipo: 'DNI', pais_emisor: 'PE', numero: dni }]);

      const porDni = await personas.listarPersonas({ q: dni }, { limite: 10, desplazamiento: 0 });
      expect(porDni.filas.map((f) => f.id)).toEqual([p.id]);
      const porNombre = await personas.listarPersonas({ q: `lucia quispe ${s}` }, { limite: 10, desplazamiento: 0 });
      expect(porNombre.filas.map((f) => f.id)).toEqual([p.id]);
      expect(porNombre.filas[0]?.documentos).toBe(`DNI ${dni}`);

      // Pasaporte: el número se normaliza a mayúsculas.
      const pas = await personas.agregarDocumento(admin.actor, p.id, esquemaDocumento.parse({ tipo: 'PASAPORTE', paisEmisor: 've', numero: ' ab12345 ' }));
      const guardado = await db().selectFrom('documentos_identidad').select(['numero', 'pais_emisor']).where('id', '=', pas.id).executeTakeFirstOrThrow();
      expect(guardado).toEqual({ numero: 'AB12345', pais_emisor: 'VE' });

      const auditoria = await db().selectFrom('bitacora').select('accion').where('actor_id', '=', admin.usuarioId).where('entidad', '=', 'documentos_identidad').execute();
      expect(auditoria).toHaveLength(2);
    }));

  it('la base valida el DNI (8 dígitos, país PE) y la unicidad del documento', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const p = await crearPersona();
      await esperarError(personas.agregarDocumento(admin.actor, p.id, esquemaDocumento.parse({ tipo: 'DNI', numero: '1234567' })), 'Validation', /8 dígitos/);
      await esperarError(personas.agregarDocumento(admin.actor, p.id, esquemaDocumento.parse({ tipo: 'DNI', paisEmisor: 'CL', numero: '12345678' })), 'Validation', /país PE/);
      const dni = dniAleatorio();
      await personas.agregarDocumento(admin.actor, p.id, esquemaDocumento.parse({ tipo: 'DNI', numero: dni }));
      const otra = await crearPersona();
      await esperarError(personas.agregarDocumento(admin.actor, otra.id, esquemaDocumento.parse({ tipo: 'DNI', numero: dni })), 'Conflict', /ya está registrado/);
    }));
});

describe('usuarios y accesos', () => {
  it('crea un usuario pendiente con varios roles y genera un enlace de activación de un solo uso', () =>
    enPrueba(async () => {
      process.env.APP_URL = 'https://colegio.test/';
      const admin = await crearAdmin();
      const persona = await crearPersona({ nombres: 'Rosa' });
      const login = `Rosa.${sufijo()}`;
      const r = await usuarios.crearUsuario(admin.actor, esquemaCrearUsuario.parse({ personaId: persona.id, login: `  ${login.toUpperCase()} `, roles: ['docente', 'apoderado'] }), 'http://otro-origen');
      expect(r.estado).toBe('pendiente');
      expect(r.login).toBe(login.toLowerCase());

      const u = await usuarios.obtenerUsuario(r.id);
      expect(u.estado).toBe('pendiente');
      expect(u.tiene_contrasena).toBe(false);
      expect(u.roles).toEqual(['apoderado', 'docente']);
      expect(u.permisos).toContain('academico.calificar');
      expect(u.tokens).toHaveLength(1);

      // El enlace se arma con APP_URL y el token solo vive en la respuesta (en la base queda el hash).
      expect(r.enlace?.proposito).toBe('activacion');
      expect(r.enlace?.url).toMatch(/^https:\/\/colegio\.test\/acceso\/[A-Za-z0-9_-]{20,}$/);
      const token = r.enlace?.url.split('/').pop() ?? '';
      const hashes = await db().selectFrom('tokens_acceso').select('token_hash').where('usuario_id', '=', r.id).execute();
      expect(hashes.every((h) => !h.token_hash.toString('utf8').includes(token))).toBe(true);
      expect(await consultarTokenAcceso(token)).toMatchObject({ proposito: 'activacion', login: login.toLowerCase() });

      // Un pendiente no puede iniciar sesión hasta activar su cuenta con el enlace.
      await canjearTokenAcceso(token, 'ClaveNueva2026');
      expect((await usuarios.obtenerUsuario(r.id)).estado).toBe('activo');
      const sesion = await iniciarSesion({ login, contrasena: 'ClaveNueva2026', ip: `id-${sufijo()}` });
      expect(sesion.usuarioId).toBe(r.id);

      // Con contraseña, el siguiente enlace por defecto es de recuperación y revoca los anteriores.
      const recuperacion = await usuarios.generarEnlace(admin.actor, r.id, {}, 'http://localhost:3000');
      expect(recuperacion.proposito).toBe('recuperacion');
      const vigentes = await db().selectFrom('tokens_acceso').select('id').where('usuario_id', '=', r.id).where('revocado_en', 'is', null).where('consumido_en', 'is', null).execute();
      expect(vigentes).toHaveLength(1);

      const acciones = (await eventos(r.id)).map((e) => e.accion);
      expect(acciones).toEqual(expect.arrayContaining(['crear', 'emitir_activacion', 'canjear_activacion', 'emitir_recuperacion']));
    }));

  it('sin APP_URL usa el origen de la petición', () =>
    enPrueba(async () => {
      delete process.env.APP_URL;
      const admin = await crearAdmin();
      const persona = await crearPersona();
      const r = await usuarios.crearUsuario(admin.actor, esquemaCrearUsuario.parse({ personaId: persona.id, login: `u${sufijo()}`, roles: ['alumno'] }), 'http://localhost:3000');
      expect(r.enlace?.url).toMatch(/^http:\/\/localhost:3000\/acceso\//);
      await esperarError(
        usuarios.crearUsuario(admin.actor, esquemaCrearUsuario.parse({ personaId: persona.id, login: `otro${sufijo()}`, roles: ['alumno'] }), 'http://x'),
        'Conflict',
        /ya tiene una cuenta/,
      );
      await esperarError(
        usuarios.crearUsuario(admin.actor, esquemaCrearUsuario.parse({ personaId: (await crearPersona()).id, login: `x${sufijo()}`, roles: ['rector'] }), 'http://x'),
        'Validation',
        /Rol inexistente/,
      );
    }));

  it('agrega y quita roles con auditoría y protege al propio administrador', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario({ roles: ['docente'] });
      const r = await usuarios.actualizarRoles(admin.actor, u.usuarioId, ['alumno', 'apoderado']);
      expect(r.roles).toEqual(['alumno', 'apoderado']);
      const ev = await eventos(u.usuarioId);
      expect(ev.filter((e) => e.accion === 'asignar_rol').map((e) => e.motivo).sort()).toEqual(['alumno', 'apoderado']);
      expect(ev.filter((e) => e.accion === 'quitar_rol').map((e) => e.motivo)).toEqual(['docente']);

      await esperarError(usuarios.actualizarRoles(admin.actor, admin.usuarioId, ['docente']), 'Forbidden', /a sí mismo/);
      await esperarError(usuarios.cambiarEstado(admin.actor, admin.usuarioId, { estado: 'suspendido', motivo: 'prueba' }), 'Forbidden', /propia cuenta/);
      // Mantener admin (que incluye usuarios.gestionar) sí se permite.
      await usuarios.actualizarRoles(admin.actor, admin.usuarioId, ['admin', 'docente']);
    }));

  it('suspende cerrando sesiones y enlaces; al reactivar queda activo solo si tiene contraseña', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const activo = await crearUsuario({ roles: ['docente'] });
      await iniciarSesion({ login: activo.login, contrasena: CONTRASENA_PRUEBA, ip: `s-${sufijo()}` });
      await iniciarSesion({ login: activo.login, contrasena: CONTRASENA_PRUEBA, ip: `s-${sufijo()}` });

      expect(await usuarios.cambiarEstado(admin.actor, activo.usuarioId, { estado: 'suspendido', motivo: 'Fin de contrato' })).toEqual({ estado: 'suspendido' });
      const abiertas = await db().selectFrom('sesiones').select('id').where('usuario_id', '=', activo.usuarioId).where('revocada_en', 'is', null).execute();
      expect(abiertas).toHaveLength(0);
      await esperarError(usuarios.generarEnlace(admin.actor, activo.usuarioId, {}, 'http://x'), 'Conflict', /suspendida/);
      await esperarError(iniciarSesion({ login: activo.login, contrasena: CONTRASENA_PRUEBA, ip: `s-${sufijo()}` }), 'Forbidden', /suspendida/);
      expect(await usuarios.cambiarEstado(admin.actor, activo.usuarioId, { estado: 'activo', motivo: null })).toEqual({ estado: 'activo' });

      const pendiente = await crearUsuario({ estado: 'pendiente' });
      await usuarios.cambiarEstado(admin.actor, pendiente.usuarioId, { estado: 'suspendido', motivo: 'Revisión' });
      expect(await usuarios.cambiarEstado(admin.actor, pendiente.usuarioId, { estado: 'activo', motivo: null })).toEqual({ estado: 'pendiente' });

      const bitacora = await listarBitacora({ accion: 'suspender', actor: admin.login }, { limite: 10, desplazamiento: 0 });
      expect(bitacora.filas.map((f) => f.afectado_login).sort()).toEqual([activo.login, pendiente.login].sort());
      expect(bitacora.filas[0]?.actor_login).toBe(admin.login);
    }));

  it('revoca las sesiones de un usuario y filtra la bitácora por fechas', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario();
      await iniciarSesion({ login: u.login, contrasena: CONTRASENA_PRUEBA, ip: `r-${sufijo()}` });
      expect(await usuarios.revocarSesiones(admin.actor, u.usuarioId)).toEqual({ revocadas: 1 });
      const hoy = (await sql<{ hoy: string }>`select (now() at time zone 'America/Lima')::date::text as hoy`.execute(db())).rows[0]?.hoy ?? '';
      const deHoy = await listarBitacora({ accion: 'revocar_sesiones', desde: hoy, hasta: hoy }, { limite: 50, desplazamiento: 0 });
      expect(deHoy.filas.some((f) => f.afectado_login === u.login)).toBe(true);
      const deAyer = await listarBitacora({ accion: 'revocar_sesiones', hasta: '2000-01-01' }, { limite: 50, desplazamiento: 0 });
      expect(deAyer.filas.some((f) => f.afectado_login === u.login)).toBe(false);
    }));
});
