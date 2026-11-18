import 'server-only';
import type { Paginacion } from '@/server/http/listado';
import * as repo from '@/server/repositories/cobros/reportes';
import type { ConsultaMorosidad, FilaRecaudacionDia, Recaudacion, ResumenMorosidad } from '@/esquemas/cobros/reportes';
import type { MedioPago } from '@/esquemas/cobros/pagos';
import { MEDIOS_PAGO } from '@/esquemas/cobros/pagos';
import { aCentimos, deCentimos } from '@/esquemas/cobros/dinero';
import { hoyLima } from '@/lib/formato';

// Servicio de reportes de tesorería. La morosidad se calcula SIEMPRE con reporte_cuotas_al_corte (base).

type FiltrosEntrada = Pick<ConsultaMorosidad, 'anioId' | 'corte' | 'gradoId' | 'seccionId' | 'concepto' | 'soloVencidas' | 'q'>;

function filtros(c: FiltrosEntrada): repo.FiltrosMorosidad {
  return {
    anioId: c.anioId,
    corte: c.corte ?? hoyLima(),
    gradoId: c.gradoId,
    seccionId: c.seccionId,
    concepto: c.concepto,
    soloVencidas: c.soloVencidas,
    q: c.q,
  };
}

export function morosidad(c: FiltrosEntrada, p: Paginacion | null) {
  return repo.morosidad(filtros(c), p);
}

export async function resumenMorosidad(c: FiltrosEntrada): Promise<ResumenMorosidad> {
  const f = filtros(c);
  const r = await repo.resumenMorosidad(f);
  return {
    corte: f.corte,
    cuotas: Number(r.cuotas),
    alumnos: Number(r.alumnos),
    saldo: deCentimos(aCentimos(r.saldo)),
    vencido: deCentimos(aCentimos(r.vencido)),
  };
}

export async function recaudacion(desde: string, hasta: string): Promise<Recaudacion> {
  const dias = await repo.recaudacionPorDia(desde, hasta);
  const totales = { cobrado: 0, revertido: 0, devuelto: 0, pagos: 0 };
  const porMedioCent: Record<MedioPago, number> = { efectivo: 0, transferencia: 0, tarjeta: 0, yape: 0, plin: 0, otro: 0 };
  const porDia: FilaRecaudacionDia[] = dias.map((d) => {
    const cobrado = aCentimos(d.cobrado);
    const revertido = aCentimos(d.revertido);
    const devuelto = aCentimos(d.devuelto);
    totales.cobrado += cobrado;
    totales.revertido += revertido;
    totales.devuelto += devuelto;
    totales.pagos += Number(d.pagos);
    for (const m of MEDIOS_PAGO) porMedioCent[m] += aCentimos(d[m]);
    return {
      fecha: d.fecha,
      efectivo: deCentimos(aCentimos(d.efectivo)),
      transferencia: deCentimos(aCentimos(d.transferencia)),
      yape: deCentimos(aCentimos(d.yape)),
      plin: deCentimos(aCentimos(d.plin)),
      tarjeta: deCentimos(aCentimos(d.tarjeta)),
      otro: deCentimos(aCentimos(d.otro)),
      cobrado: deCentimos(cobrado),
      revertido: deCentimos(revertido),
      devuelto: deCentimos(devuelto),
      neto: deCentimos(cobrado - revertido - devuelto),
      pagos: Number(d.pagos),
    };
  });
  const conteo = await conteoPorMedio(desde, hasta);
  return {
    desde,
    hasta,
    porDia,
    porMedio: MEDIOS_PAGO.map((m) => ({ medio: m, pagos: conteo[m] ?? 0, importe: deCentimos(porMedioCent[m]) })),
    totales: {
      cobrado: deCentimos(totales.cobrado),
      revertido: deCentimos(totales.revertido),
      devuelto: deCentimos(totales.devuelto),
      neto: deCentimos(totales.cobrado - totales.revertido - totales.devuelto),
      pagos: totales.pagos,
    },
  };
}

async function conteoPorMedio(desde: string, hasta: string): Promise<Partial<Record<MedioPago, number>>> {
  const filas = await repo.conteoPorMedio(desde, hasta);
  return Object.fromEntries(filas.map((f) => [f.medio, Number(f.pagos)]));
}
