import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { aErrorDominio, ForbiddenError, ValidationError, type ErrorDominio } from '@/server/errores';
import { exigirActor, obtenerActor, type Actor } from '@/server/auth/actor';
import { exigirPermiso, type Permiso } from '@/server/autorizacion/permisos';
import type { Portal } from '@/lib/permisos';

type Infer<T> = T extends ZodTypeAny ? z.infer<T> : undefined;
type Segmento = { params: Promise<Record<string, string | string[] | undefined>> };

interface OpcionesBase<C, Q, P> {
  /** Esquema Zod del cuerpo JSON. */
  cuerpo?: C;
  /** Esquema Zod de la query string (?a=1). */
  consulta?: Q;
  /** Esquema Zod de los parámetros de ruta ([id]). */
  parametros?: P;
}

interface OpcionesRuta<C, Q, P> extends OpcionesBase<C, Q, P> {
  /** Al menos uno de estos permisos (autorización por PERMISO). */
  permiso?: Permiso | readonly Permiso[];
  /** El actor debe tener disponible este portal (perfil por datos: docente/estudiante/apoderado). */
  portal?: Portal;
}

export interface Contexto<C, Q, P, A = Actor> {
  req: NextRequest;
  actor: A;
  cuerpo: Infer<C>;
  consulta: Infer<Q>;
  parametros: Infer<P>;
}

const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Protección CSRF: las mutaciones exigen la cabecera personalizada `x-seruna: 1` (que un sitio ajeno no
 * puede enviar sin CORS) y, si el navegador envía Origin/Sec-Fetch-Site, que sea del mismo sitio.
 */
export function verificarOrigen(req: NextRequest): void {
  if (!METODOS_MUTACION.has(req.method)) return;
  if (req.headers.get('x-seruna') !== '1') throw new ForbiddenError('Solicitud rechazada (CSRF)');
  const sitio = req.headers.get('sec-fetch-site');
  if (sitio && sitio !== 'same-origin' && sitio !== 'none') throw new ForbiddenError('Solicitud rechazada (origen)');
  const origen = req.headers.get('origin');
  if (origen) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    let hostOrigen: string | null = null;
    try {
      hostOrigen = new URL(origen).host;
    } catch {
      hostOrigen = null;
    }
    if (!host || hostOrigen !== host) throw new ForbiddenError('Solicitud rechazada (origen)');
  }
}

function validar<T extends ZodTypeAny>(esquema: T, datos: unknown, donde: string): z.infer<T> {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    const campos = r.error.flatten().fieldErrors;
    const primero = r.error.issues[0];
    throw new ValidationError(primero ? `${primero.path.join('.') || donde}: ${primero.message}` : 'Datos inválidos', {
      campos,
    });
  }
  return r.data;
}

async function leerJson(req: NextRequest): Promise<unknown> {
  const texto = await req.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new ValidationError('El cuerpo de la solicitud no es JSON válido');
  }
}

export function responderError(e: unknown): NextResponse {
  const error: ErrorDominio = aErrorDominio(e);
  if (error.tipo === 'Interno') console.error('[seruna] error no controlado', e);
  return NextResponse.json(
    { error: { tipo: error.tipo, mensaje: error.message, detalles: error.tipo === 'Interno' ? undefined : error.detalles } },
    { status: error.status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function aRespuesta(resultado: unknown): Response {
  if (resultado instanceof Response) return resultado;
  return NextResponse.json(resultado ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

async function prepararEntrada<C extends ZodTypeAny | undefined, Q extends ZodTypeAny | undefined, P extends ZodTypeAny | undefined>(req: NextRequest, segmento: Segmento, op: OpcionesBase<C, Q, P>) {
  const parametrosCrudos = (await segmento.params) ?? {};
  const parametros = (op.parametros ? validar(op.parametros as unknown as ZodTypeAny, parametrosCrudos, 'ruta') : parametrosCrudos) as Infer<P>;
  const consulta = (
    op.consulta ? validar(op.consulta as unknown as ZodTypeAny, Object.fromEntries(req.nextUrl.searchParams), 'consulta') : undefined
  ) as Infer<Q>;
  const cuerpo = (op.cuerpo ? validar(op.cuerpo as unknown as ZodTypeAny, await leerJson(req), 'cuerpo') : undefined) as Infer<C>;
  return { parametros, consulta, cuerpo };
}

/**
 * Route Handler FINO autenticado: CSRF → sesión → permiso/portal → Zod → servicio → JSON.
 * Los errores (de dominio o de PostgreSQL) se traducen con un manejador común.
 */
export function ruta<C extends ZodTypeAny | undefined = undefined, Q extends ZodTypeAny | undefined = undefined, P extends ZodTypeAny | undefined = undefined>(
  op: OpcionesRuta<C, Q, P>,
  manejador: (ctx: Contexto<C, Q, P>) => Promise<unknown>,
) {
  return async (req: NextRequest, segmento: Segmento): Promise<Response> => {
    try {
      verificarOrigen(req);
      const actor = await exigirActor();
      if (op.permiso) exigirPermiso(actor, op.permiso);
      if (op.portal && !actor.portales.includes(op.portal)) throw new ForbiddenError('No tiene acceso a este portal');
      const entrada = await prepararEntrada(req, segmento, op);
      return aRespuesta(await manejador({ req, actor, ...entrada }));
    } catch (e) {
      return responderError(e);
    }
  };
}

/** Route Handler público (login, activación). El actor puede ser null. */
export function rutaPublica<C extends ZodTypeAny | undefined = undefined, Q extends ZodTypeAny | undefined = undefined, P extends ZodTypeAny | undefined = undefined>(
  op: OpcionesBase<C, Q, P>,
  manejador: (ctx: Contexto<C, Q, P, Actor | null>) => Promise<unknown>,
) {
  return async (req: NextRequest, segmento: Segmento): Promise<Response> => {
    try {
      verificarOrigen(req);
      const actor = await obtenerActor();
      const entrada = await prepararEntrada(req, segmento, op);
      return aRespuesta(await manejador({ req, actor, ...entrada }));
    } catch (e) {
      return responderError(e);
    }
  };
}

/** IP del cliente (detrás de proxy usa X-Forwarded-For). */
export function ipCliente(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

/** Respuesta de descarga de archivo. */
export function descargar(contenido: Buffer | Uint8Array, nombre: string, tipo: string): Response {
  const seguro = nombre.replace(/[^\w.\- ]+/g, '_');
  return new Response(new Uint8Array(contenido), {
    headers: {
      'Content-Type': tipo,
      'Content-Disposition': `attachment; filename="${seguro}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      'Cache-Control': 'no-store',
    },
  });
}
