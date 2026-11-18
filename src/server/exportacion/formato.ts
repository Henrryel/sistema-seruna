import 'server-only';
import type { FormatoColumna } from '@/server/http/listado';

const ZONA = 'America/Lima';

export function institucion() {
  return {
    nombre: process.env.INSTITUCION_NOMBRE ?? 'I.E.P. Excelencia Seruna',
    ruc: process.env.INSTITUCION_RUC ?? '',
    direccion: process.env.INSTITUCION_DIRECCION ?? '',
  };
}

export function ahoraLegible(): string {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: ZONA }).format(new Date());
}

/** Convierte un valor de la base a texto para PDF. */
export function textoCelda(valor: unknown, formato: FormatoColumna = 'texto'): string {
  if (valor === null || valor === undefined || valor === '') return '';
  switch (formato) {
    case 'moneda':
      return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(valor));
    case 'numero':
      return new Intl.NumberFormat('es-PE').format(Number(valor));
    case 'fecha': {
      const s = String(valor);
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeZone: ZONA }).format(new Date(s));
    }
    case 'fechaHora':
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: ZONA }).format(
        valor instanceof Date ? valor : new Date(String(valor)),
      );
    case 'booleano':
      return valor ? 'Sí' : 'No';
    default:
      return valor instanceof Date ? textoCelda(valor, 'fechaHora') : String(valor);
  }
}
