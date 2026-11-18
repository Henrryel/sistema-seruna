import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { canjearTokenAcceso, emitirTokenAcceso, iniciarSesion } from '@/server/services/auth';
import { obtenerSesionVigente } from '@/server/repositories/identidad/auth';
import { hashToken } from '@/server/auth/tokens';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { CONTRASENA_PRUEBA, actorDe, crearAdmin, crearUsuario } from '@tests/fixtures/base';

describe('autenticación', () => {
  it('inicia sesión por login, guarda solo el hash del token y audita', () =>
    enPrueba(async () => {
      const u = await crearUsuario({ roles: ['docente'] });
      const r = await iniciarSesion({ login: u.login.toUpperCase(), contrasena: CONTRASENA_PRUEBA, ip: 't1' });
      expect(r.token.length).toBeGreaterThan(30);
      const sesion = await obtenerSesionVigente(hashToken(r.token));
      expect(sesion?.usuario_id).toBe(u.usuarioId);
      const guardado = await db().selectFrom('sesiones').select('token_hash').where('usuario_id', '=', u.usuarioId).executeTakeFirstOrThrow();
      expect(guardado.token_hash.length).toBe(32);
      expect(guardado.token_hash.toString('utf8')).not.toContain(r.token);
      const evento = await db().selectFrom('bitacora').select('resultado').where('actor_id', '=', u.usuarioId).where('accion', '=', 'login').executeTakeFirst();
      expect(evento?.resultado).toBe('ok');
    }));

  it('rechaza contraseña incorrecta y registra el fallo', () =>
    enPrueba(async () => {
      const u = await crearUsuario();
      await esperarError(iniciarSesion({ login: u.login, contrasena: 'otra-clave1', ip: 't2' }), 'Unauthorized', /incorrectos/);
      const fallos = await db().selectFrom('bitacora').select('id').where('usuario_afectado_id', '=', u.usuarioId).where('resultado', '=', 'fallido').execute();
      expect(fallos).toHaveLength(1);
    }));

  it('bloquea tras 5 fallos consecutivos', () =>
    enPrueba(async () => {
      const u = await crearUsuario();
      for (let i = 0; i < 5; i++) await esperarError(iniciarSesion({ login: u.login, contrasena: 'mala-clave1', ip: `t3-${i}` }), 'Unauthorized');
      await esperarError(iniciarSesion({ login: u.login, contrasena: CONTRASENA_PRUEBA, ip: 't3-x' }), 'Unauthorized', /bloqueada/);
    }));

  it('respeta usuarios.estado: suspendido no entra', () =>
    enPrueba(async () => {
      const u = await crearUsuario({ estado: 'suspendido' });
      await esperarError(iniciarSesion({ login: u.login, contrasena: CONTRASENA_PRUEBA, ip: 't4' }), 'Forbidden', /suspendida/);
    }));

  it('activa una cuenta pendiente con token de un solo uso', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario({ estado: 'pendiente' });
      const { token } = await emitirTokenAcceso({ usuarioId: u.usuarioId, proposito: 'activacion', emisorId: admin.usuarioId });
      await canjearTokenAcceso(token, 'NuevaClave123');
      const usuario = await db().selectFrom('usuarios').select(['estado', 'contrasena_hash']).where('id', '=', u.usuarioId).executeTakeFirstOrThrow();
      expect(usuario.estado).toBe('activo');
      expect(usuario.contrasena_hash).toMatch(/^\$argon2id\$/);
      await esperarError(canjearTokenAcceso(token, 'OtraClave123'), 'Conflict', /no es válido/);
      const r = await iniciarSesion({ login: u.login, contrasena: 'NuevaClave123', ip: 't5' });
      expect(r.usuarioId).toBe(u.usuarioId);
    }));
});

describe('actor y portales', () => {
  it('calcula portales por permisos y por datos, no por nombre de rol', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      expect(admin.actor.portales).toContain('admin');
      expect(admin.actor.permisos).toContain('tesoreria.cobrar');
      const alumno = await crearUsuario({ roles: ['alumno'] });
      const actor = await actorDe(alumno);
      expect(actor.portales).not.toContain('admin');
      expect(actor.portales).not.toContain('estudiante'); // sin perfil en `estudiantes` no hay portal
    }));
});
