import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { sumarDias } from '@/lib/formato';
import * as servicio from '@/server/services/matricula/matriculas';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearEstudiante, crearSeccion } from '@tests/fixtures/base';
import { archivoPrueba, crearEstudianteConEdad, crearRegla, escenarioMatricula, movimientosDe, ubicacionesDe } from '@tests/fixtures/matricula';

const estadoDe = async (id: string) =>
  db().selectFrom('matriculas').select(['estado', 'confirmada_en']).where('id', '=', id).executeTakeFirstOrThrow();

describe('matrícula: solicitud y confirmación', () => {
  it('solicita con la regla publicada vigente y confirma ubicando en la sección hasta el fin del año', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula();
      // Una versión posterior en borrador no se usa; la publicada de mayor versión sí.
      const v2 = await crearRegla({ anioId: e.anio.anioId, gradoId: e.gradoId, version: 2 });
      await crearRegla({ anioId: e.anio.anioId, gradoId: e.gradoId, version: 3, publicada: false });
      const { estudianteId } = await crearEstudiante();

      const sol = await servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });
      expect(sol.reglaId).toBe(v2.id);
      expect((await estadoDe(sol.id)).estado).toBe('solicitada');

      await servicio.confirmarMatricula(e.actor, sol.id, { seccionId: e.seccionId, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null });
      const m = await estadoDe(sol.id);
      expect(m.estado).toBe('activa');
      expect(m.confirmada_en).not.toBeNull();
      expect(await ubicacionesDe(sol.id)).toEqual([{ seccion_id: e.seccionId, tipo_vacante: 'regular', desde: e.anio.inicio, hasta: e.anio.fin }]);
      expect((await movimientosDe(sol.id)).map((x) => x.tipo)).toEqual(['confirmacion']);

      // Nómina desde la vista reporte_nomina_matriculas
      const nomina = await servicio.nomina({ anioId: e.anio.anioId, seccionId: e.seccionId }, null);
      expect(nomina.filas.map((f) => f.matricula_id)).toEqual([sol.id]);
      expect(nomina.filas[0]).toMatchObject({ numero: 1, seccion: 'A', estado: 'activa', desde: e.anio.inicio, hasta: e.anio.fin });

      // Bitácora en la misma transacción
      const auditoria = await db().selectFrom('bitacora').select('accion').where('entidad', '=', 'matriculas').where('registro_id', '=', sol.id).execute();
      expect(auditoria.map((a) => a.accion)).toEqual(['solicitar', 'confirmar']);

      // No se confirma dos veces ni se duplica la matrícula del año
      await esperarError(servicio.confirmarMatricula(e.actor, sol.id, { seccionId: e.seccionId, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null }), 'Conflict');
      await esperarError(
        servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null }),
        'Conflict',
        /ya tiene matrícula/,
      );
    }));

  it('valida ventana de solicitudes y edad al corte (la base no lo hace)', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula();
      const otroGrado = (await db().selectFrom('grados').select('id').where('id', '<>', e.gradoId).executeTakeFirstOrThrow()).id;
      await crearRegla({ anioId: e.anio.anioId, gradoId: otroGrado, inicio: '2001-01-01', fin: '2001-02-01' });
      const { estudianteId } = await crearEstudiante();
      await esperarError(
        servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: otroGrado, tipoIngreso: 'nuevo', referenciaSiagie: null }),
        'Validation',
        /ventana de solicitudes/,
      );
      await esperarError(
        servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'traslado', referenciaSiagie: null }),
        'Validation',
        /No hay una regla/,
      );

      await crearRegla({ anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'continuidad', corteEdad: `${e.anio.anio}-03-31`, edadMinima: 6, edadMaxima: 7 });
      const pequeno = await crearEstudianteConEdad(`${e.anio.anio - 5}-01-15`);
      await esperarError(
        servicio.solicitarMatricula(e.actor, { estudianteId: pequeno.estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'continuidad', referenciaSiagie: null }),
        'Validation',
        /tiene 5 años/,
      );
      // Cumple 6 justo al corte
      const justo = await crearEstudianteConEdad(`${e.anio.anio - 6}-03-31`);
      await servicio.solicitarMatricula(e.actor, { estudianteId: justo.estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'continuidad', referenciaSiagie: null });
      await esperarError(
        servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'continuidad', referenciaSiagie: null }),
        'Validation',
        /fecha de nacimiento/,
      );
    }));

  it('el cupo excedido lo rechaza la base (trigger controlar_cupo) y la matrícula sigue solicitada', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula({ cupo: 1, reserva: 0 });
      const ids: string[] = [];
      for (let i = 0; i < 2; i++) {
        const { estudianteId } = await crearEstudiante();
        ids.push((await servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null })).id);
      }
      const [primera, segunda] = ids as [string, string];
      await servicio.confirmarMatricula(e.actor, primera, { seccionId: e.seccionId, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null });
      await esperarError(
        servicio.confirmarMatricula(e.actor, segunda, { seccionId: e.seccionId, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null }),
        'Validation',
        'No hay cupo para el tipo de vacante seleccionado',
      );
      expect((await estadoDe(segunda)).estado).toBe('solicitada');
      expect(await movimientosDe(segunda)).toEqual([]);

      // Sección de otro grado: la FK compuesta lo impide
      const otraSeccion = await crearSeccion(e.anio.anioId, (await db().selectFrom('grados').select('id').where('id', '<>', e.gradoId).executeTakeFirstOrThrow()).id, { nombre: 'Z' });
      await esperarError(
        servicio.confirmarMatricula(e.actor, segunda, { seccionId: otraSeccion.id, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null }),
        'Validation',
        /no corresponde al año y grado/,
      );
    }));
});

describe('matrícula: movimientos', () => {
  it('cambio de sección cierra la anterior el día previo; el retiro cierra la vigencia y registra la evidencia', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula({ secciones: 2 });
      const [a, b] = e.secciones as [string, string];
      const { estudianteId } = await crearEstudiante();
      const { id } = await servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });
      await servicio.confirmarMatricula(e.actor, id, { seccionId: a, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null });

      const cambio = `${e.anio.anio}-05-19`;
      await esperarError(servicio.cambiarSeccion(e.actor, id, { seccionId: a, fecha: cambio, tipoVacante: 'regular', motivo: 'x', detalle: null }), 'Validation', /ya está en esa sección/);
      await esperarError(servicio.cambiarSeccion(e.actor, id, { seccionId: b, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: 'x', detalle: null }), 'Validation', /posterior al inicio/);
      await servicio.cambiarSeccion(e.actor, id, { seccionId: b, fecha: cambio, tipoVacante: 'regular', motivo: 'Pedido de la familia', detalle: null });
      expect(await ubicacionesDe(id)).toEqual([
        { seccion_id: a, tipo_vacante: 'regular', desde: e.anio.inicio, hasta: sumarDias(cambio, -1) },
        { seccion_id: b, tipo_vacante: 'regular', desde: cambio, hasta: e.anio.fin },
      ]);
      // Nómina a una fecha y ocupación por sección
      const antes = await servicio.nomina({ anioId: e.anio.anioId, fecha: sumarDias(cambio, -1) }, null);
      expect(antes.filas.map((f) => f.seccion)).toEqual(['A']);
      const despues = await servicio.nomina({ anioId: e.anio.anioId, seccionId: b }, null);
      expect(despues.filas.map((f) => f.matricula_id)).toEqual([id]);
      const ocupacion = await servicio.seccionesDeMatricula(id, cambio);
      expect(ocupacion.secciones.map((s) => [s.nombre, s.ocupadas])).toEqual([
        ['A', 0],
        ['B', 1],
      ]);
      const detalle = await servicio.detalleMatricula(id);
      expect(detalle.ubicaciones.map((u) => [u.seccion, u.desde, u.hasta])).toEqual([
        ['A', e.anio.inicio, sumarDias(cambio, -1)],
        ['B', cambio, e.anio.fin],
      ]);

      const retiro = `${e.anio.anio}-08-04`;
      const r = await servicio.retirarMatricula(e.actor, id, { tipo: 'retiro', fecha: retiro, motivo: 'Cambio de domicilio', detalle: null }, archivoPrueba());
      expect(r.evidenciaId).not.toBeNull();
      expect((await estadoDe(id)).estado).toBe('retirada');
      expect((await ubicacionesDe(id)).at(-1)).toMatchObject({ seccion_id: b, hasta: sumarDias(retiro, -1) });
      const movs = await movimientosDe(id);
      expect(movs.map((m) => m.tipo)).toEqual(['confirmacion', 'cambio_seccion', 'retiro']);
      expect(movs.at(-1)).toMatchObject({ fecha_efectiva: retiro, motivo: 'Cambio de domicilio', evidencia_id: r.evidenciaId });

      // Retirada: no admite otro retiro ni cambio
      await esperarError(servicio.retirarMatricula(e.actor, id, { tipo: 'traslado', fecha: retiro, motivo: 'x', detalle: null }), 'Conflict');

      // Reincorporación abre nueva ubicación hasta fin de año (la base controla solapes y cupo)
      await esperarError(
        servicio.reincorporarMatricula(e.actor, id, { seccionId: b, fecha: sumarDias(retiro, -10), tipoVacante: 'regular', motivo: 'Regresa' }),
        'Conflict',
        /ya tiene una sección/,
      );
      const vuelta = `${e.anio.anio}-10-20`;
      await servicio.reincorporarMatricula(e.actor, id, { seccionId: b, fecha: vuelta, tipoVacante: 'regular', motivo: 'Regresa' });
      expect((await estadoDe(id)).estado).toBe('activa');
      expect((await ubicacionesDe(id)).at(-1)).toMatchObject({ seccion_id: b, desde: vuelta, hasta: e.anio.fin });

      // Traslado al final
      await servicio.retirarMatricula(e.actor, id, { tipo: 'traslado', fecha: `${e.anio.anio}-11-02`, motivo: 'Traslado a otra IE', detalle: 'IE destino: 12345' });
      expect((await estadoDe(id)).estado).toBe('trasladada');
      expect((await movimientosDe(id)).map((m) => m.tipo)).toEqual(['confirmacion', 'cambio_seccion', 'retiro', 'reincorporacion', 'traslado']);
    }));

  it('la anulación libera el cupo y deja la matrícula anulada', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula({ cupo: 1, reserva: 0 });
      const uno = await crearEstudiante();
      const dos = await crearEstudiante();
      const m1 = await servicio.solicitarMatricula(e.actor, { estudianteId: uno.estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });
      const m2 = await servicio.solicitarMatricula(e.actor, { estudianteId: dos.estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });
      await servicio.confirmarMatricula(e.actor, m1.id, { seccionId: e.seccionId, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null });
      await servicio.anularMatricula(e.actor, m1.id, { fecha: e.anio.inicio, motivo: 'Registrada por error' });
      expect((await estadoDe(m1.id)).estado).toBe('anulada');
      expect(await ubicacionesDe(m1.id)).toEqual([]);
      await servicio.confirmarMatricula(e.actor, m2.id, { seccionId: e.seccionId, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null });
      await esperarError(servicio.anularMatricula(e.actor, m1.id, { fecha: e.anio.inicio, motivo: 'otra vez' }), 'Conflict');
    }));

  it('responsable económico: el nuevo cierra al anterior y la base impide solapes', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula();
      const { estudianteId } = await crearEstudiante();
      const { id } = await servicio.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });
      const base = { personaId: undefined, tipoDocumento: 'DNI' as const, direccion: null };
      await servicio.registrarResponsable(e.actor, id, { ...base, numeroDocumento: '12345678', nombreRazonSocial: 'Ana Pérez', desde: e.anio.inicio });
      await esperarError(
        servicio.registrarResponsable(e.actor, id, { ...base, numeroDocumento: '87654321', nombreRazonSocial: 'Luis Rojas', desde: e.anio.inicio }),
        'Conflict',
      );
      await servicio.registrarResponsable(e.actor, id, { ...base, tipoDocumento: 'RUC', numeroDocumento: '20123456789', nombreRazonSocial: 'Empresa SAC', desde: `${e.anio.anio}-06-01` });
      const detalle = await servicio.detalleMatricula(id);
      expect(detalle.responsables.map((r) => [r.nombre_razon_social, r.desde, r.hasta])).toEqual([
        ['Empresa SAC', `${e.anio.anio}-06-01`, null],
        ['Ana Pérez', e.anio.inicio, `${e.anio.anio}-05-31`],
      ]);
    }));
});
