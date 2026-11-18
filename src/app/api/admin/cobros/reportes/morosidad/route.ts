import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaMorosidad, type FilaMorosidad } from '@/esquemas/cobros/reportes';
import { descripcionCuota } from '@/esquemas/cobros/cuotas';
import { formatoFecha, hoyLima } from '@/lib/formato';
import * as servicio from '@/server/services/cobros/reportes';

export const runtime = 'nodejs';

/** Morosidad al corte (reporte_cuotas_al_corte) unida a alumno, grado y sección. */
export const GET = ruta({ permiso: 'reportes.tesoreria', consulta: consultaMorosidad }, async ({ consulta }) =>
  responderListado<FilaMorosidad>(consulta, {
    titulo: 'Morosidad al corte',
    nombreArchivo: `morosidad-${consulta.corte ?? hoyLima()}`,
    filtros: {
      Corte: formatoFecha(consulta.corte ?? hoyLima()),
      Concepto: consulta.concepto,
      Alcance: consulta.soloVencidas ? 'Solo vencidas' : 'Todas las cuotas con saldo',
      Búsqueda: consulta.q,
    },
    horizontal: true,
    columnas: [
      { titulo: 'Alumno', valor: 'alumno', ancho: 30 },
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Grado', valor: 'grado' },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Cuota', valor: (f) => descripcionCuota(f), ancho: 24 },
      { titulo: 'Vence', valor: 'vence_en', formato: 'fecha' },
      { titulo: 'Días de atraso', valor: 'dias_atraso', formato: 'numero' },
      { titulo: 'Importe', valor: 'importe', formato: 'moneda' },
      { titulo: 'Ajustes', valor: 'ajustes', formato: 'moneda' },
      { titulo: 'Abonado', valor: 'abonado', formato: 'moneda' },
      { titulo: 'Saldo', valor: 'saldo', formato: 'moneda' },
    ],
    obtener: (p) => servicio.morosidad(consulta, p),
  }),
);
