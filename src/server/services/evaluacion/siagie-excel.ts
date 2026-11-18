import 'server-only';
import ExcelJS from 'exceljs';
import { letraColumna, type ContenidoExportacion } from '@/esquemas/evaluacion/siagie';

// Escritura de notas sobre la plantilla oficial de SIAGIE (ExcelJS). Convención (docs/normativa.md):
//  - Columnas en numeración Excel desde 1 (A = 1). NL en `columna_nl` (par ≥ 4), conclusión en `columna_nl + 1`.
//  - La fila de cada alumno se ubica buscando su código SIAGIE en las columnas A .. (menor columna NL de la hoja − 1),
//    es decir, en las primeras columnas de identificación (como mínimo A–C).
//  - Los códigos se comparan sin espacios y, si son numéricos, sin ceros a la izquierda (Excel suele guardarlos
//    como número y perder esos ceros).
//  - Una competencia "no desarrollada" (sin nivel) deja vacías ambas celdas.
//  - `codigo_excel` se busca en la columna NL por encima de la primera fila de alumnos; si no aparece se emite una
//    advertencia (no bloquea), para detectar mapeos desplazados.

export function normalizarCodigo(valor: string | null | undefined): string {
  const t = (valor ?? '').replace(/\s+/g, '');
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t.toUpperCase();
}

function textoCelda(celda: ExcelJS.Cell): string {
  try {
    return celda.text ?? '';
  } catch {
    return '';
  }
}

export async function leerHojas(plantilla: Buffer): Promise<string[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(plantilla as unknown as ArrayBuffer);
  return libro.worksheets.map((h) => h.name);
}

export async function escribirNotasSiagie(plantilla: Buffer, contenido: ContenidoExportacion) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(plantilla as unknown as ArrayBuffer);
  const advertencias: string[] = [];
  let escritas = 0;

  const mapeos = contenido.mapeos ?? [];
  const hojas = [...new Set(mapeos.map((m) => m.hoja))];
  for (const nombreHoja of hojas) {
    const hoja = libro.getWorksheet(nombreHoja);
    const mapeosHoja = mapeos.filter((m) => m.hoja === nombreHoja);
    const notasHoja = contenido.notas.filter((n) => n.hoja === nombreHoja);
    if (!hoja) {
      advertencias.push(`La plantilla no tiene la hoja "${nombreHoja}" (${notasHoja.length} nota(s) sin escribir)`);
      continue;
    }
    const ultimaColumnaId = Math.max(1, Math.min(...mapeosHoja.map((m) => m.nl)) - 1);
    const filaDe = new Map<string, number>();
    hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
      for (let c = 1; c <= ultimaColumnaId; c++) {
        const codigo = normalizarCodigo(textoCelda(fila.getCell(c)));
        if (codigo && !filaDe.has(codigo)) filaDe.set(codigo, numero);
      }
    });

    const sinFila = new Set<string>();
    let primeraFilaAlumno = Number.POSITIVE_INFINITY;
    for (const nota of notasHoja) {
      const mapeo = mapeosHoja.find((m) => m.codigo === nota.codigo_excel);
      const fila = filaDe.get(normalizarCodigo(nota.alumno));
      if (!mapeo) continue;
      if (!fila) {
        sinFila.add(nota.alumno);
        continue;
      }
      primeraFilaAlumno = Math.min(primeraFilaAlumno, fila);
      hoja.getCell(fila, mapeo.nl).value = nota.nl ?? null;
      hoja.getCell(fila, mapeo.conclusion).value = nota.conclusion ?? null;
      escritas++;
    }
    if (sinFila.size) {
      advertencias.push(`Hoja "${nombreHoja}": no se encontró la fila de ${sinFila.size} alumno(s) por código SIAGIE (${[...sinFila].slice(0, 10).join(', ')})`);
    }
    if (Number.isFinite(primeraFilaAlumno)) {
      for (const m of mapeosHoja) {
        let encontrado = false;
        for (let r = 1; r < primeraFilaAlumno && !encontrado; r++) {
          encontrado = normalizarCodigo(textoCelda(hoja.getCell(r, m.nl))) === normalizarCodigo(m.codigo);
        }
        if (!encontrado) {
          advertencias.push(`Hoja "${nombreHoja}": el código ${m.codigo} no aparece en la cabecera de la columna ${letraColumna(m.nl)}; verifique el mapeo`);
        }
      }
    }
  }
  const salida = await libro.xlsx.writeBuffer();
  return { contenido: Buffer.from(salida as ArrayBuffer), escritas, advertencias };
}
