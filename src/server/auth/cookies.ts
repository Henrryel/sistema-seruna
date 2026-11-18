import 'server-only';

const produccion = process.env.NODE_ENV === 'production';

/** En producción (HTTPS) se usa el prefijo __Host- (cookie segura, sin Domain, Path=/). */
export const COOKIE_SESION = produccion ? '__Host-seruna_sesion' : 'seruna_sesion';
export const COOKIE_PORTAL = 'seruna_portal';
export const COOKIE_HIJO = 'seruna_hijo';

export const HORAS_SESION = Number(process.env.SESION_HORAS ?? 12);

export function opcionesCookieSesion(expira: Date) {
  return {
    httpOnly: true,
    secure: produccion,
    sameSite: 'lax' as const,
    path: '/',
    expires: expira,
  };
}

export function opcionesCookiePreferencia() {
  return { httpOnly: true, secure: produccion, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 180 };
}
