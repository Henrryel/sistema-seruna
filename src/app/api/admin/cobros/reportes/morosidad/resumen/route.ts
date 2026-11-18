import { ruta } from '@/server/http/ruta';
import { consultaResumenMorosidad } from '@/esquemas/cobros/reportes';
import * as servicio from '@/server/services/cobros/reportes';

/** Totales de morosidad al corte con los mismos filtros del listado. */
export const GET = ruta({ permiso: 'reportes.tesoreria', consulta: consultaResumenMorosidad }, async ({ consulta }) => servicio.resumenMorosidad(consulta));
