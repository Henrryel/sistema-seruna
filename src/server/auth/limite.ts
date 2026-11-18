import 'server-only';
import { RateLimitError } from '@/server/errores';

// Limitador en memoria por clave (ventana deslizante). Complementa el conteo de fallos en `bitacora`.
const intentos = new Map<string, number[]>();

export function verificarLimite(clave: string, maximo: number, ventanaMs: number): void {
  const ahora = Date.now();
  const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= maximo) {
    intentos.set(clave, recientes);
    throw new RateLimitError();
  }
  recientes.push(ahora);
  intentos.set(clave, recientes);
  if (intentos.size > 10_000) {
    for (const [k, v] of intentos) if (v.every((t) => ahora - t >= ventanaMs)) intentos.delete(k);
  }
}

export function reiniciarLimite(clave: string): void {
  intentos.delete(clave);
}
