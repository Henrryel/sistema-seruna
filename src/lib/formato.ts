// Formatos para Perú (es-PE, America/Lima, soles). Seguros en cliente y servidor.
const ZONA = 'America/Lima';

const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

export function formatoMoneda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return moneda.format(Number(valor));
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' sin corrimientos de zona horaria. */
export function formatoFecha(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  if (typeof valor === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (m && valor.length <= 10) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeZone: ZONA }).format(new Date(valor));
}

export function formatoFechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: ZONA }).format(new Date(valor));
}

export function formatoHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  if (typeof valor === 'string' && /^\d{2}:\d{2}/.test(valor)) return valor.slice(0, 5);
  return new Intl.DateTimeFormat('es-PE', { timeStyle: 'short', timeZone: ZONA }).format(new Date(valor));
}

/** Fecha de hoy en Lima como 'YYYY-MM-DD'. */
export function hoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 'YYYY-MM-01' → 'marzo 2026'. */
export function formatoMes(valor: string | null | undefined): string {
  if (!valor) return '—';
  const m = /^(\d{4})-(\d{2})/.exec(valor);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : valor;
}

/**
 * Rango de PostgreSQL ('[2026-03-01,2026-12-31)') → { inicio, fin } con fin INCLUSIVO.
 * Límites infinitos se devuelven como null.
 */
export function leerRangoFechas(rango: string | null | undefined): { inicio: string | null; fin: string | null } {
  if (!rango || rango === 'empty') return { inicio: null, fin: null };
  const m = /^([[(])([^,]*),([^\])]*)([\])])$/.exec(rango.trim());
  if (!m) return { inicio: null, fin: null };
  const limpiar = (s: string) => s.replace(/"/g, '').trim();
  let inicio: string | null = limpiar(m[2] ?? '') || null;
  let fin: string | null = limpiar(m[3] ?? '') || null;
  if (inicio && m[1] === '(') inicio = sumarDias(inicio, 1);
  if (fin && m[4] === ')') fin = sumarDias(fin, -1);
  return { inicio, fin };
}

/** { inicio, fin inclusivo } → literal daterange '[inicio,fin]' (fin null = abierto). */
export function rangoFechas(inicio: string, fin: string | null | undefined): string {
  return fin ? `[${inicio},${fin}]` : `[${inicio},)`;
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function nombreCompleto(p: { nombres?: string | null; apellidos?: string | null }): string {
  return [p.apellidos, p.nombres].filter(Boolean).join(', ');
}

export const NOMBRE_DIA_ISO = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
