import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { id } from '@/esquemas/comunes';
import { hijosDelApoderado } from '@/server/autorizacion/alcance';
import { ForbiddenError } from '@/server/errores';
import { COOKIE_HIJO, opcionesCookiePreferencia } from '@/server/auth/cookies';

/** Hijos con vínculo vigente (selector del portal de padres). */
export const GET = ruta({ portal: 'padre' }, async ({ actor }) => ({ hijos: await hijosDelApoderado(actor) }));

/** Selecciona el hijo activo (validado contra estudiante_apoderado vigente). */
export const POST = ruta({ portal: 'padre', cuerpo: z.object({ estudianteId: id }) }, async ({ actor, cuerpo }) => {
  const hijos = await hijosDelApoderado(actor);
  if (!hijos.some((h) => h.estudianteId === cuerpo.estudianteId)) throw new ForbiddenError('No tiene un vínculo vigente con ese estudiante');
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_HIJO, cuerpo.estudianteId, opcionesCookiePreferencia());
  return res;
});
