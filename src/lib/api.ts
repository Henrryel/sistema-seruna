'use client';
// Cliente HTTP del frontend: JSON, cabecera anti-CSRF y errores tipados en español.

export class ApiError extends Error {
  readonly status: number;
  readonly tipo: string;
  readonly detalles?: unknown;
  constructor(status: number, tipo: string, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.status = status;
    this.tipo = tipo;
    this.detalles = detalles;
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function solicitar<T>(metodo: Metodo, url: string, cuerpo?: unknown): Promise<T> {
  const esForm = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
  const res = await fetch(url, {
    method: metodo,
    credentials: 'same-origin',
    headers: {
      'x-seruna': '1',
      Accept: 'application/json',
      ...(cuerpo !== undefined && !esForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo === undefined ? undefined : esForm ? (cuerpo as FormData) : JSON.stringify(cuerpo),
  });
  if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth/')) {
    window.location.href = `/login?siguiente=${encodeURIComponent(window.location.pathname)}`;
  }
  const texto = await res.text();
  const datos = texto ? (JSON.parse(texto) as unknown) : null;
  if (!res.ok) {
    const e = (datos as { error?: { tipo?: string; mensaje?: string; detalles?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.tipo ?? 'Error', e?.mensaje ?? `Error ${res.status}`, e?.detalles);
  }
  return datos as T;
}

export const api = {
  get: <T>(url: string) => solicitar<T>('GET', url),
  post: <T>(url: string, cuerpo?: unknown) => solicitar<T>('POST', url, cuerpo ?? {}),
  put: <T>(url: string, cuerpo?: unknown) => solicitar<T>('PUT', url, cuerpo ?? {}),
  patch: <T>(url: string, cuerpo?: unknown) => solicitar<T>('PATCH', url, cuerpo ?? {}),
  delete: <T>(url: string, cuerpo?: unknown) => solicitar<T>('DELETE', url, cuerpo),
};

/** Construye una URL con query string omitiendo valores vacíos. */
export function conConsulta(url: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `${url}${url.includes('?') ? '&' : '?'}${q}` : url;
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Ocurrió un error inesperado';
}
