import { NextResponse } from 'next/server';
import { rutaPublica, ipCliente } from '@/server/http/ruta';
import { esquemaLogin } from '@/esquemas/auth';
import { iniciarSesion } from '@/server/services/auth';
import { COOKIE_SESION, opcionesCookieSesion } from '@/server/auth/cookies';

export const POST = rutaPublica({ cuerpo: esquemaLogin }, async ({ req, cuerpo }) => {
  const r = await iniciarSesion({ login: cuerpo.login, contrasena: cuerpo.contrasena, ip: ipCliente(req) });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESION, r.token, opcionesCookieSesion(r.expiraEn));
  return res;
});
