import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError, aErrorDominio } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/cobros/cuotas';
import * as planes from '@/server/repositories/cobros/planes';
import type { Actor } from '@/server/auth/actor';
import type { DatosAjuste, DatosEmision, ResultadoEmision } from '@/esquemas/cobros/cuotas';
import { aCentimos, deCentimos } from '@/esquemas/cobros/dinero';
import { formatoMoneda } from '@/lib/formato';

// Servicio: emisión de cuotas replicando EXACTAMENTE los tramos del plan publicado (lo verifica el trigger
// validar_emision_cuota) y ajustes con motivo. Las cuotas nunca se editan ni borran.

export const listarCuotas = repo.listarCuotas;
export const listarAjustes = repo.listarAjustes;

type Tramo = Awaited<ReturnType<typeof repo.tramosDePlan>>[number];

/** Inserta las cuotas faltantes de una matrícula. Devuelve emitidas/omitidas y si se omitió el ingreso. */
async function emitirParaMatricula(m: repo.MatriculaEmision, tramos: Tramo[]) {
  const ya = await repo.cuotasEmitidas(m.id);
  const obligacion = tramos.some((t) => t.concepto === 'ingreso') ? await planes.obligacionDeEstudiante(m.estudiante_id) : undefined;
  let emitidas = 0;
  let omitidas = 0;
  let sinObligacion = false;
  for (const t of tramos) {
    if (ya.claves.has(`${t.concepto}-${t.numero}`) || (t.mes_servicio && ya.meses.has(t.mes_servicio))) {
      omitidas++;
      continue;
    }
    // La cuota de ingreso se emite solo en la matrícula de ingreso del alumno con obligación acordada.
    if (t.concepto === 'ingreso' && (!obligacion || obligacion.matricula_ingreso_id !== m.id)) {
      omitidas++;
      sinObligacion = true;
      continue;
    }
    await repo.insertarCuota({
      matriculaId: m.id,
      estudianteId: m.estudiante_id,
      anioId: m.anio_id,
      gradoId: m.grado_id,
      tramoId: t.id,
      concepto: t.concepto,
      obligacionIngresoId: t.concepto === 'ingreso' ? (obligacion?.id ?? null) : null,
      numero: t.numero,
      importe: t.importe,
      mesServicio: t.mes_servicio,
      exigibleDesde: t.exigible_desde,
      venceEn: t.vence_en,
    });
    emitidas++;
  }
  return { emitidas, omitidas, sinObligacion };
}

/**
 * Emite cuotas para una matrícula, una sección o un grado. Cada matrícula se procesa en su propio
 * SAVEPOINT: si la base rechaza una, las demás continúan y el error se informa. Reemitir es seguro:
 * los tramos ya emitidos se omiten.
 */
export async function emitirCuotas(actor: Actor, datos: DatosEmision): Promise<ResultadoEmision> {
  let matriculas: repo.MatriculaEmision[];
  if (datos.alcance === 'matricula') {
    const m = await repo.matriculaParaEmision(datos.matriculaId as string);
    if (!m) throw new NotFoundError('La matrícula no existe');
    matriculas = [m];
  } else if (datos.alcance === 'seccion') {
    const s = await repo.seccionBasica(datos.seccionId as string);
    if (!s) throw new NotFoundError('La sección no existe');
    matriculas = await repo.matriculasActivas({ seccionId: s.id });
  } else {
    matriculas = await repo.matriculasActivas({ anioId: datos.anioId as string, gradoId: datos.gradoId as string });
  }
  const resultado: ResultadoEmision = { matriculas: matriculas.length, emitidas: 0, omitidas: 0, errores: [], avisos: [] };
  if (matriculas.length === 0) {
    resultado.avisos.push('No hay matrículas activas en el alcance seleccionado');
    return resultado;
  }

  return transaccion(async () => {
    const planesCache = new Map<string, { id: string; tramos: Tramo[] } | null>();
    let sinObligacion = 0;
    for (const m of matriculas) {
      const clave = `${m.anio_id}-${m.grado_id}`;
      if (!planesCache.has(clave)) {
        const plan = await planes.planVigente(m.anio_id, m.grado_id);
        planesCache.set(clave, plan ? { id: plan.id, tramos: await repo.tramosDePlan(plan.id) } : null);
      }
      const plan = planesCache.get(clave);
      if (!plan) {
        const mensaje = 'No hay un plan de cobro publicado y vigente para el año y grado de la matrícula';
        if (datos.alcance === 'matricula') throw new ValidationError(mensaje);
        resultado.errores.push({ matriculaId: m.id, alumno: m.alumno, mensaje });
        continue;
      }
      try {
        const r = await transaccion(() => emitirParaMatricula(m, plan.tramos));
        resultado.emitidas += r.emitidas;
        resultado.omitidas += r.omitidas;
        if (r.sinObligacion) sinObligacion++;
      } catch (e) {
        if (datos.alcance === 'matricula') throw e;
        resultado.errores.push({ matriculaId: m.id, alumno: m.alumno, mensaje: aErrorDominio(e).message });
      }
    }
    if (sinObligacion > 0) {
      resultado.avisos.push(`${sinObligacion} matrícula(s) sin obligación de ingreso registrada: se omitió la cuota de ingreso`);
    }
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'emitir_cuotas',
      entidad: 'cuotas',
      registroId: datos.matriculaId ?? datos.seccionId ?? datos.gradoId ?? null,
      motivo: `Alcance ${datos.alcance}: ${resultado.emitidas} emitida(s), ${resultado.omitidas} omitida(s), ${resultado.errores.length} error(es)`,
      resultado: resultado.errores.length ? 'parcial' : 'ok',
    });
    return resultado;
  });
}

/**
 * Ajuste de cuota (descuento/exoneración negativos, corrección con signo). La cuota se bloquea para que
 * el ajuste no la deje con saldo negativo.
 */
export async function registrarAjuste(actor: Actor, cuotaId: string, datos: DatosAjuste) {
  return transaccion(async () => {
    const cuota = await repo.bloquearCuota(cuotaId);
    if (!cuota) throw new NotFoundError('La cuota no existe');
    const nuevoSaldo = aCentimos(cuota.saldo) + aCentimos(datos.importe);
    if (nuevoSaldo < 0) {
      throw new ValidationError(`El ajuste deja la cuota con saldo negativo (saldo actual ${formatoMoneda(cuota.saldo)})`);
    }
    const r = await repo.crearAjuste(cuotaId, datos, actor.usuarioId);
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'ajustar',
      entidad: 'ajustes_cuota',
      registroId: r.id,
      motivo: `${datos.tipo} ${datos.importe} en cuota ${cuotaId}: ${datos.motivo}`,
      resultado: 'ok',
    });
    return { id: r.id, saldo: deCentimos(nuevoSaldo) };
  });
}
