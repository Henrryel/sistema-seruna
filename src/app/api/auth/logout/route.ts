import { NextResponse } from 'next/server';
import { rutaPublica } from '@/server/http/ruta';
import { cerrarSesion } from '@/server/services/auth';
import { COOKIE_SESION, COOKIE_HIJO } from '@/server/auth/cookies';

export const POST = rutaPublica({}, async ({ actor }) => {
  if (actor) await cerrarSesion(actor);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_SESION);
  res.cookies.delete(COOKIE_HIJO);
  return res;
});
