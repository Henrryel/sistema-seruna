import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { leerArchivo } from '@/server/almacenamiento';
import * as siagie from '@/server/services/evaluacion/siagie';
import * as cierres from '@/server/services/evaluacion/cierres';
import { normalizarCodigo } from '@/server/services/evaluacion/siagie-excel';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { abrirRegistro, bimestre, calificarTodo, crearEscenario } from '@tests/fixtures/evaluacion';

/** Plantilla mínima tipo SIAGIE: códigos de competencia en la fila 1 (columnas NL), alumnos desde la fila 3. */
async function plantillaExcel(codigos: string[]) {
  const libro = new ExcelJS.Workbook();
  libro.addWorksheet('Datos').getCell('A1').value = 'Hoja informativa';
  const hoja = libro.addWorksheet('Notas');
  hoja.getCell('A1').value = 'Código';
  hoja.getCell('B1').value = 'Estudiante';
  hoja.getCell('D1').value = 101;
  hoja.getCell('F1').value = '102';
  hoja.getCell('H1').value = '103';
  hoja.getCell('D2').value = 'NL';
  hoja.getCell('E2').value = 'Conclusión';
  codigos.forEach((c, i) => {
    // El primero como número (Excel pierde ceros a la izquierda), el resto como texto.
    hoja.getCell(3 + i, 1).value = i === 0 ? Number(c) : c;
    hoja.getCell(3 + i, 2).value = `Alumno ${i + 1}`;
  });
  return Buffer.from((await libro.xlsx.writeBuffer()) as ArrayBuffer);
}

describe('exportación SIAGIE', () => {
  it('prepara con la función de la base y escribe NL y conclusión en la plantilla oficial', () =>
    enPrueba(async () => {
      const e = await crearEscenario();
      const [a0, a1] = e.alumnos;
      if (!a0 || !a1) throw new Error('faltan alumnos');
      const contenido = await plantillaExcel([a0.codigoSiagie, a1.codigoSiagie]);
      const archivo = { contenido, nombreOriginal: 'siagie-2b.xlsx', tipoMime: 'application/octet-stream' };
      await esperarError(siagie.subirPlantilla(e.admin.actor, { seccionId: e.seccionId, bimestreId: bimestre(e, 1).id }, { ...archivo, nombreOriginal: 'x.pdf' }), 'Validation');
      const pl = await siagie.subirPlantilla(e.admin.actor, { seccionId: e.seccionId, bimestreId: bimestre(e, 1).id }, archivo);
      expect(pl.version).toBe(1);
      expect(pl.hojas).toEqual(['Datos', 'Notas']);

      await siagie.agregarMapeo(e.admin.actor, pl.id, { competenciaId: e.competencias.k1, hoja: 'Notas', codigoExcel: '101', columnaNl: 4 });
      await siagie.agregarMapeo(e.admin.actor, pl.id, { competenciaId: e.competencias.k2, hoja: 'Notas', codigoExcel: '102', columnaNl: 6 });
      // Columna impar: la base exige NL en columna par.
      await esperarError(siagie.agregarMapeo(e.admin.actor, pl.id, { competenciaId: e.competencias.k3, hoja: 'Notas', codigoExcel: '103', columnaNl: 7 }), 'Validation');

      await esperarError(siagie.prepararExportacion(e.admin.actor, pl.id), 'Conflict', /publíquelo/);
      const cierreId = await abrirRegistro(e, 1);
      await calificarTodo(e, 1, (i, k) => (i === 1 && k === e.competencias.k1 ? 'C' : 'AD'));
      await esperarError(siagie.prepararExportacion(e.admin.actor, pl.id), 'Conflict', /Publique el bimestre/);
      await cierres.ejecutarAccion(e.admin.actor, cierreId, 'cerrar');
      await cierres.ejecutarAccion(e.admin.actor, cierreId, 'publicar');
      await esperarError(siagie.prepararExportacion(e.admin.actor, pl.id), 'Validation', /mapeos/);
      await siagie.agregarMapeo(e.admin.actor, pl.id, { competenciaId: e.competencias.k3, hoja: 'Notas', codigoExcel: '103', columnaNl: 8 });

      const exp = await siagie.prepararExportacion(e.admin.actor, pl.id);
      expect(exp.estado).toBe('preparada');
      await esperarError(siagie.resolverExportacion(e.admin.actor, exp.id, { estado: 'aceptada', observacion: null }), 'Conflict');

      const gen = await siagie.generarExcel(e.admin.actor, exp.id);
      expect(gen.escritas).toBe(6);
      expect(gen.advertencias).toEqual([]);
      await esperarError(siagie.generarExcel(e.admin.actor, exp.id), 'Conflict');

      const salida = new ExcelJS.Workbook();
      await salida.xlsx.load((await leerArchivo(gen.archivoId)).contenido as unknown as ArrayBuffer);
      const hoja = salida.getWorksheet('Notas');
      expect(hoja?.getCell('D3').value).toBe('AD');
      expect(hoja?.getCell('E3').value ?? null).toBeNull();
      expect(hoja?.getCell('D4').value).toBe('C');
      expect(String(hoja?.getCell('E4').value)).toMatch(/reforzar/);
      expect(hoja?.getCell('H4').value).toBe('AD');
      expect(hoja?.getCell('B3').value).toBe('Alumno 1');

      await siagie.resolverExportacion(e.admin.actor, exp.id, { estado: 'aceptada', observacion: 'Cargado en SIAGIE' });
      const detalle = await siagie.detallePlantilla(pl.id);
      expect(detalle.exportacionesDetalle[0]).toMatchObject({ estado: 'aceptada', notas: 6 });
      expect(detalle.competencias.every((k) => k.mapeada)).toBe(true);

      // Copiar el mapeo a la plantilla del bimestre siguiente.
      const pl2 = await siagie.subirPlantilla(e.admin.actor, { seccionId: e.seccionId, bimestreId: bimestre(e, 2).id }, archivo);
      expect((await siagie.copiarMapeos(e.admin.actor, pl2.id, pl.id)).copiados).toBe(3);
    }));

  it('normaliza códigos numéricos sin ceros a la izquierda', () => {
    expect(normalizarCodigo(' 0001234 ')).toBe('1234');
    expect(normalizarCodigo('ab 12')).toBe('AB12');
    expect(normalizarCodigo('0')).toBe('0');
  });
});
