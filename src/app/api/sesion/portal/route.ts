import { NextResponse } from 'next/server';
import { ruta } from '@/server/http/ruta';
import { esquemaPortal } from '@/esquemas/auth';
import { ForbiddenError } from '@/server/errores';
import { COOKIE_PORTAL, opcionesCookiePreferencia } from '@/server/auth/cookies';

/** Selector de portal (usuario con varios roles). */
export const POST = ruta({ cuerpo: esquemaPortal }, async ({ actor, cuerpo }) => {
  if (!actor.portales.includes(cuerpo.portal)) throw new ForbiddenError('No tiene acceso a ese portal');
  const res = NextResponse.json({ ok: true, destino: `/${cuerpo.portal}` });
  res.cookies.set(COOKIE_PORTAL, cuerpo.portal, opcionesCookiePreferencia());
  return res;
});
