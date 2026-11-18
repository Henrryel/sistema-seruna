import 'server-only';
import ExcelJS from 'exceljs';
import { valorColumna, type ColumnaExportacion } from '@/server/http/listado';
import { ahoraLegible, institucion } from './formato';

/** Excel de un listado: encabezado institucional, filtros, cabecera con estilo y formatos por columna. */
export async function generarExcelListado<F>(datos: {
  titulo: string;
  columnas: ColumnaExportacion<F>[];
  filas: F[];
  filtros?: Record<string, string>;
}): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = institucion().nombre;
  libro.created = new Date();
  const hoja = libro.addWorksheet(datos.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  const n = Math.max(datos.columnas.length, 1);

  hoja.addRow([institucion().nombre]).font = { bold: true, size: 12 };
  hoja.addRow([datos.titulo]).font = { bold: true, size: 14 };
  hoja.addRow([`Generado: ${ahoraLegible()}`]).font = { italic: true, size: 9 };
  const filtros = Object.entries(datos.filtros ?? {});
  if (filtros.length) hoja.addRow([`Filtros: ${filtros.map(([k, v]) => `${k}: ${v}`).join(' · ')}`]).font = { size: 9 };
  for (let i = 1; i <= hoja.rowCount; i++) hoja.mergeCells(i, 1, i, n);
  hoja.addRow([]);

  const cabecera = hoja.addRow(datos.columnas.map((c) => c.titulo));
  cabecera.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3D8F' } };
    celda.alignment = { vertical: 'middle', wrapText: true };
  });
  const filaCabecera = cabecera.number;

  for (const fila of datos.filas) {
    hoja.addRow(
      datos.columnas.map((c) => {
        const v = valorColumna(fila, c);
        if (v === null || v === undefined) return null;
        switch (c.formato) {
          case 'moneda':
          case 'numero':
            return Number(v);
          case 'fecha':
            return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T12:00:00Z`) : v;
          case 'fechaHora':
            return v instanceof Date ? v : new Date(String(v));
          case 'booleano':
            return v ? 'Sí' : 'No';
          default:
            return v instanceof Date ? v : String(v);
        }
      }),
    );
  }

  datos.columnas.forEach((c, i) => {
    const col = hoja.getColumn(i + 1);
    col.width = c.ancho ?? Math.min(Math.max(c.titulo.length + 4, 12), 50);
    if (c.formato === 'moneda') col.numFmt = '"S/" #,##0.00';
    if (c.formato === 'fecha') col.numFmt = 'dd/mm/yyyy';
    if (c.formato === 'fechaHora') col.numFmt = 'dd/mm/yyyy hh:mm';
  });
  hoja.views = [{ state: 'frozen', ySplit: filaCabecera }];
  hoja.autoFilter = { from: { row: filaCabecera, column: 1 }, to: { row: filaCabecera, column: n } };

  return Buffer.from(await libro.xlsx.writeBuffer());
}
