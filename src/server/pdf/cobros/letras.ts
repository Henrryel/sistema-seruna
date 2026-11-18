// Importe en letras para recibos (formato usual en Perú: "CIENTO VEINTE CON 50/100 SOLES").

const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function decenas(n: number): string {
  if (n < 30) return UNIDADES[n] ?? '';
  const d = Math.floor(n / 10);
  const u = n % 10;
  return `${DECENAS[d] ?? ''}${u ? ` Y ${UNIDADES[u] ?? ''}` : ''}`;
}

function menorMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const r = n % 100;
  return [CENTENAS[c] ?? '', decenas(r)].filter(Boolean).join(' ');
}

/** "UNO" → "UN" y "VEINTIUNO" → "VEINTIÚN" delante de MIL/MILLONES. */
function apocope(t: string): string {
  return t.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');
}

export function enteroEnLetras(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocope(enteroEnLetras(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocope(menorMil(miles))} MIL`);
  if (resto) partes.push(menorMil(resto));
  return partes.join(' ');
}

/** Céntimos → "CIENTO VEINTE CON 50/100 SOLES". */
export function importeEnLetras(centimos: number): string {
  const entero = Math.floor(Math.abs(centimos) / 100);
  const cent = Math.abs(centimos) % 100;
  return `${enteroEnLetras(entero)} CON ${String(cent).padStart(2, '0')}/100 SOLES`;
}
