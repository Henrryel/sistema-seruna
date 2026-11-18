import { NextResponse, type NextRequest } from 'next/server';

// Filtro rápido (Edge): sin cookie de sesión no se entra a los portales. La validación real de la
// sesión, el estado del usuario y los permisos ocurre en el servidor (layouts y Route Handlers).
const COOKIES = ['__Host-seruna_sesion', 'seruna_sesion'];

export function middleware(req: NextRequest) {
  const tieneSesion = COOKIES.some((c) => req.cookies.has(c));
  if (!tieneSesion) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?siguiente=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/docente/:path*', '/estudiante/:path*', '/padre/:path*', '/portal', '/escaner/:path*'],
};
