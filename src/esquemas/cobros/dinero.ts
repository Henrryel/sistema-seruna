// Aritmética de dinero en céntimos enteros (nunca float). Compartido cliente/servidor.

/** '12.50' | 12.5 → 1250. Valores vacíos → 0. */
export function aCentimos(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  const texto = typeof valor === 'number' ? valor.toFixed(2) : String(valor).trim().replace(',', '.');
  const m = /^(-)?(\d+)(?:\.(\d*))?$/.exec(texto);
  if (!m) return Number.NaN;
  const decimales = `${m[3] ?? ''}00`.slice(0, 2);
  const n = Number(m[2]) * 100 + Number(decimales);
  return m[1] ? -n : n;
}

/** 1250 → '12.50'. */
export function deCentimos(centimos: number): string {
  const negativo = centimos < 0;
  const a = Math.abs(Math.trunc(centimos));
  return `${negativo ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

export function sumar(...valores: (string | number | null | undefined)[]): string {
  return deCentimos(valores.reduce<number>((t, v) => t + aCentimos(v), 0));
}

/** Número de recibo legible: REC-001-00000123. */
export function numeroRecibo(serie: string | null | undefined, numero: string | number | null | undefined): string {
  if (!serie || numero === null || numero === undefined) return '—';
  return `${serie}-${String(numero).padStart(8, '0')}`;
}
