import 'server-only';
import { ForbiddenError, NotFoundError } from '@/server/errores';
import { estudianteDelActor, exigirAccesoEstudiante } from '@/server/autorizacion/alcance';
import * as pagosRepo from '@/server/repositories/cobros/pagos';
import * as cuotasRepo from '@/server/repositories/cobros/cuotas';
import type { Actor } from '@/server/auth/actor';
import type { EstadoCuenta } from '@/esquemas/cobros/reportes';
import { medioDesdeBase } from '@/esquemas/cobros/pagos';
import { aCentimos, deCentimos, numeroRecibo } from '@/esquemas/cobros/dinero';
import { hoyLima } from '@/lib/formato';
import { reciboPdf } from './pagos';

// Estados de cuenta de los portales. Alcance: el alumno solo ve su registro; el apoderado solo hijos con
// vínculo vigente y acceso_economico. Los recibos se entregan solo si TODAS sus aplicaciones son del alumno.

async function estadoCuenta(estudianteId: string, matriculaId?: string): Promise<EstadoCuenta> {
  const estudiante = await pagosRepo.estudianteBasico(estudianteId);
  if (!estudiante) throw new NotFoundError('El estudiante no existe');
  const matriculas = await pagosRepo.matriculasDeEstudiante(estudianteId);
  const matricula = matriculaId ? matriculas.find((m) => m.id === matriculaId) : (matriculas.find((m) => m.estado === 'activa') ?? matriculas[0]);
  if (matriculaId && !matricula) throw new ForbiddenError('La matrícula no corresponde al estudiante');
  const hoy = hoyLima();
  const cuotas = matricula ? await cuotasRepo.cuotasDeMatricula(matricula.id) : [];
  const pagos = matricula ? await pagosRepo.pagosDeMatricula(matricula.id) : [];
  let total = 0;
  let abonado = 0;
  let saldo = 0;
  let vencido = 0;
  for (const c of cuotas) {
    total += aCentimos(c.importe) + aCentimos(c.ajustes);
    abonado += aCentimos(c.abonado);
    const s = aCentimos(c.saldo);
    if (s > 0) {
      saldo += s;
      if (c.vence_en < hoy) vencido += s;
    }
  }
  return {
    estudiante,
    matriculas,
    matricula: matricula ?? null,
    cuotas,
    pagos: pagos.map((p) => ({
      id: p.id,
      pagado_en: p.pagado_en,
      importe: p.importe,
      medio_ui: medioDesdeBase(p.medio, p.referencia),
      recibo_id: p.recibo_id,
      recibo: p.recibo_id ? numeroRecibo(p.serie, p.numero) : null,
      revertido: p.revertido,
      devuelto: p.devuelto,
      detalle: p.detalle,
    })),
    resumen: { total: deCentimos(total), abonado: deCentimos(abonado), saldo: deCentimos(saldo), vencido: deCentimos(vencido) },
    hoy,
  };
}

export async function estadoCuentaEstudiante(actor: Actor, matriculaId?: string) {
  const { estudianteId } = await estudianteDelActor(actor);
  return estadoCuenta(estudianteId, matriculaId);
}

export async function estadoCuentaPadre(actor: Actor, estudianteId: string, matriculaId?: string) {
  await exigirAccesoEstudiante(actor, estudianteId, { portal: 'padre', tipo: 'economico' });
  return estadoCuenta(estudianteId, matriculaId);
}

async function reciboDeEstudiante(estudianteId: string, reciboId: string) {
  const r = await pagosRepo.pagoDeRecibo(reciboId);
  if (!r) throw new NotFoundError('El recibo no existe');
  const estudiantes = await pagosRepo.estudiantesDePago(r.pago_id);
  if (estudiantes.length === 0 || estudiantes.some((e) => e !== estudianteId)) {
    throw new ForbiddenError('El recibo no corresponde a este estudiante');
  }
  return reciboPdf(r.pago_id);
}

export async function reciboEstudiante(actor: Actor, reciboId: string) {
  const { estudianteId } = await estudianteDelActor(actor);
  return reciboDeEstudiante(estudianteId, reciboId);
}

export async function reciboPadre(actor: Actor, estudianteId: string, reciboId: string) {
  await exigirAccesoEstudiante(actor, estudianteId, { portal: 'padre', tipo: 'economico' });
  return reciboDeEstudiante(estudianteId, reciboId);
}
