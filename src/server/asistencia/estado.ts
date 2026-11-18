// Estado presente/tarde de una entrada.
//
// `validar_asistencia` (trigger de la base) NO calcula el estado: VERIFICA que coincida con
//   (entrada.instante AT TIME ZONE 'America/Lima') > jornada.fecha + jornada.entrada + make_interval(mins => politica.tolerancia_minutos)
// La app debe enviar el estado ya calculado con EXACTAMENTE la misma fórmula (precisión de microsegundos).
// Por eso el instante se recibe como texto local de Lima con microsegundos, tal como lo formatea la base
// (`to_char(instante AT TIME ZONE 'America/Lima', 'YYYY-MM-DD"T"HH24:MI:SS.US')`), y no como Date (milisegundos).

export type EstadoEntrada = 'presente' | 'tarde';

interface MarcaLocal {
  segundos: number;
  micro: number;
}

function leerFraccion(fraccion: string | undefined): number {
  if (!fraccion) return 0;
  return Number(fraccion.slice(0, 6).padEnd(6, '0'));
}

/** 'YYYY-MM-DD' + 'HH:MM[:SS[.ffffff]]' → segundos desde 1970 del reloj local (sin zona) y microsegundos. */
function marcaLocal(fecha: string, hora: string): MarcaLocal {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const h = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(hora);
  if (!f || !h) throw new Error(`Fecha u hora inválida: ${fecha} ${hora}`);
  const ms = Date.UTC(Number(f[1]), Number(f[2]) - 1, Number(f[3]), Number(h[1]), Number(h[2]), Number(h[3] ?? 0));
  return { segundos: ms / 1000, micro: leerFraccion(h[4]) };
}

/** Texto 'YYYY-MM-DDTHH:MM:SS[.ffffff]' (hora local de Lima) → marca comparable. */
function leerInstanteLocal(instanteLocal: string): MarcaLocal {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(instanteLocal.trim());
  if (!m) throw new Error(`Instante local inválido: ${instanteLocal}`);
  return marcaLocal(m[1] as string, m[2] as string);
}

/** tarde ⇔ instante_local > fecha + hora_entrada + tolerancia (la misma desigualdad estricta que la base). */
export function estadoPorEntrada(entrada: {
  instanteLocal: string;
  fecha: string;
  horaEntrada: string;
  toleranciaMinutos: number;
}): EstadoEntrada {
  const instante = leerInstanteLocal(entrada.instanteLocal);
  const base = marcaLocal(entrada.fecha, entrada.horaEntrada);
  const limite = { segundos: base.segundos + entrada.toleranciaMinutos * 60, micro: base.micro };
  const tarde = instante.segundos > limite.segundos || (instante.segundos === limite.segundos && instante.micro > limite.micro);
  return tarde ? 'tarde' : 'presente';
}

const ZONA = 'America/Lima';

/** Date → texto local de Lima 'YYYY-MM-DDTHH:MM:SS.mmm000' (solo para fechas con precisión de ms). */
export function instanteLocalLima(instante: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  const ms = String(instante.getUTCMilliseconds()).padStart(3, '0');
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}.${ms}000`;
}
