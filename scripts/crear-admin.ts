/**
 * Crea el primer administrador (o emite un nuevo enlace de activación si ya existe).
 *
 *   npm run admin:crear -- --login admin --nombres "Ana" --apellidos "Pérez" [--dni 12345678]
 *
 * La cuenta queda 'pendiente' y se imprime un enlace /acceso/<token> (válido 72 h) para que la persona
 * cree su propia contraseña. Nunca se imprime ni se guarda una contraseña en claro.
 */
import { parseArgs } from 'node:util';
import { db, kysely, transaccion } from '@/server/db';
import { emitirTokenAcceso } from '@/server/services/auth';
import { registrarBitacora } from '@/server/repositories/bitacora';

async function main() {
  const { values } = parseArgs({
    options: {
      login: { type: 'string' },
      nombres: { type: 'string' },
      apellidos: { type: 'string' },
      dni: { type: 'string' },
    },
  });
  const login = values.login?.trim().toLowerCase();
  if (!login || !/^[a-z0-9._-]{3,40}$/.test(login)) throw new Error('Indique --login (3-40 caracteres: a-z, 0-9, . _ -)');

  const existente = await db().selectFrom('usuarios').select(['id', 'estado']).where('login', '=', login).executeTakeFirst();
  let usuarioId: string;
  if (existente) {
    if (existente.estado === 'activo') {
      console.log(`El usuario "${login}" ya está activo. Use "¿Olvidó su contraseña?" o el módulo de usuarios para recuperarlo.`);
      return;
    }
    usuarioId = existente.id;
  } else {
    if (!values.nombres || !values.apellidos) throw new Error('Indique --nombres y --apellidos para crear la persona');
    if (values.dni && !/^\d{8}$/.test(values.dni)) throw new Error('El DNI debe tener 8 dígitos');
    usuarioId = await transaccion(async () => {
      const persona = await db()
        .insertInto('personas')
        .values({ nombres: values.nombres!.trim(), apellidos: values.apellidos!.trim() })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (values.dni) {
        await db().insertInto('documentos_identidad').values({ persona_id: persona.id, tipo: 'DNI', pais_emisor: 'PE', numero: values.dni }).execute();
      }
      const u = await db().insertInto('usuarios').values({ persona_id: persona.id, login, estado: 'pendiente' }).returning('id').executeTakeFirstOrThrow();
      const rol = await db().selectFrom('roles').select('id').where('codigo', '=', 'admin').executeTakeFirstOrThrow();
      await db().insertInto('usuario_roles').values({ usuario_id: u.id, rol_id: rol.id }).execute();
      await registrarBitacora({ usuarioAfectadoId: u.id, accion: 'crear_admin_inicial', entidad: 'usuarios', registroId: u.id, resultado: 'ok' });
      return u.id;
    });
  }
  const { token, expiraEn } = await emitirTokenAcceso({ usuarioId, proposito: 'activacion', emisorId: null });
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  console.log(`\nAdministrador "${login}" listo (pendiente de activación).`);
  console.log(`Enlace de activación (vence ${expiraEn.toLocaleString('es-PE', { timeZone: 'America/Lima' })}):`);
  console.log(`  ${base}/acceso/${token}\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => kysely().destroy());
