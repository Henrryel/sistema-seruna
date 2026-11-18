// Lectura de archivos de un sistema anterior (JSON o CSV) a filas planas. Se usa en el cliente (vista previa
// y conteos) y en el servidor (carga real). NO valida reglas de la base: anidados y credenciales los rechaza
// el trigger `controlar_carga_historica`.

export interface FilaParseada {
  claveOrigen: string;
  datos: Record<string, unknown>;
}

export class ErrorParseo extends Error {}

function detectarSeparador(cabecera: string): string {
  const candidatos = [',', ';', '\t', '|'];
  let mejor = ',';
  let max = -1;
  for (const c of candidatos) {
    const n = cabecera.split(c).length - 1;
    if (n > max) {
      max = n;
      mejor = c;
    }
  }
  return mejor;
}

/** CSV (RFC 4180): comillas dobles, comillas escapadas ("") y saltos de línea dentro de campos. */
export function parsearCsv(texto: string): Record<string, string | null>[] {
  const limpio = texto.replace(/^﻿/, '');
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? '';
  const sep = detectarSeparador(primeraLinea);
  const registros: string[][] = [];
  let campo = '';
  let registro: string[] = [];
  let enComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo === '') enComillas = true;
    else if (c === sep) {
      registro.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = '';
    } else campo += c;
  }
  if (enComillas) throw new ErrorParseo('El CSV tiene comillas sin cerrar');
  if (campo !== '' || registro.length) {
    registro.push(campo);
    registros.push(registro);
  }
  const [cabecera, ...resto] = registros.filter((r) => r.some((v) => v.trim() !== ''));
  if (!cabecera) return [];
  const columnas = cabecera.map((c) => c.trim());
  if (columnas.some((c) => c === '')) throw new ErrorParseo('La cabecera del CSV tiene columnas sin nombre');
  return resto.map((r, n) => {
    if (r.length > columnas.length) throw new ErrorParseo(`La fila ${n + 2} del CSV tiene más valores que columnas`);
    const fila: Record<string, string | null> = {};
    columnas.forEach((col, j) => {
      const v = r[j];
      fila[col] = v === undefined || v === '' ? null : v;
    });
    return fila;
  });
}

/** JSON: arreglo de objetos, o un objeto con un único arreglo de objetos (p. ej. {"estudiantes": [...]}). */
export function parsearJson(texto: string): Record<string, unknown>[] {
  let valor: unknown;
  try {
    valor = JSON.parse(texto.replace(/^﻿/, ''));
  } catch {
    throw new ErrorParseo('El archivo no es un JSON válido');
  }
  if (!Array.isArray(valor) && valor && typeof valor === 'object') {
    const arreglos = Object.values(valor).filter(Array.isArray);
    if (arreglos.length === 1) valor = arreglos[0];
  }
  if (!Array.isArray(valor)) throw new ErrorParseo('El JSON debe ser un arreglo de objetos');
  return valor.map((f, i) => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) throw new ErrorParseo(`El elemento ${i + 1} del JSON no es un objeto`);
    return f as Record<string, unknown>;
  });
}

export function esJson(nombre: string, texto: string): boolean {
  if (/\.json$/i.test(nombre)) return true;
  if (/\.(csv|txt|tsv)$/i.test(nombre)) return false;
  const inicio = texto.replace(/^﻿/, '').trimStart()[0];
  return inicio === '[' || inicio === '{';
}

/** Convierte el contenido en filas con su clave de origen (columna indicada) y detecta claves repetidas. */
export function parsearArchivoImportacion(texto: string, nombre: string, columnaClave: string): FilaParseada[] {
  const filas = esJson(nombre, texto) ? parsearJson(texto) : parsearCsv(texto);
  const vistas = new Set<string>();
  return filas.map((datos, i) => {
    const valor = datos[columnaClave];
    const clave = valor === null || valor === undefined ? '' : String(valor).trim();
    if (!clave) throw new ErrorParseo(`${nombre}: la fila ${i + 1} no tiene valor en la columna clave "${columnaClave}"`);
    if (vistas.has(clave)) throw new ErrorParseo(`${nombre}: la clave de origen "${clave}" está repetida`);
    vistas.add(clave);
    return { claveOrigen: clave, datos };
  });
}
