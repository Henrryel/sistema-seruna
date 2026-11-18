import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { formatoMes } from '@/lib/formato';
import { NOMBRE_MODALIDAD } from '@/esquemas/planilla/contratos';
import {
  consultaLiquidaciones,
  esquemaLiquidacion,
  type FilaLiquidacion,
} from '@/esquemas/planilla/liquidaciones';
import { PERMISOS_VER_LIQUIDACIONES } from '@/esquemas/planilla/permisos';
import * as servicio from '@/server/services/planilla/liquidaciones';

export const GET = ruta(
  { permiso: PERMISOS_VER_LIQUIDACIONES, consulta: consultaLiquidaciones },
  async ({ consulta }) =>
    responderListado<FilaLiquidacion>(consulta, {
      titulo: 'Liquidaciones docentes',
      filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
      horizontal: true,
      columnas: [
        { titulo: 'Mes', valor: (f) => formatoMes(f.mes) },
        { titulo: 'Docente', valor: 'docente', ancho: 28 },
        { titulo: 'Código', valor: 'codigo_docente' },
        { titulo: 'Contrato', valor: 'referencia' },
        { titulo: 'Modalidad', valor: (f) => NOMBRE_MODALIDAD[f.modalidad] },
        { titulo: 'Estado', valor: 'estado' },
        { titulo: 'Base', valor: 'base', formato: 'moneda' },
        { titulo: 'Adicionales', valor: 'adicionales', formato: 'moneda' },
        { titulo: 'Descuentos', valor: 'descuentos', formato: 'moneda' },
        { titulo: 'Neto', valor: 'neto', formato: 'moneda' },
        { titulo: 'Pagado', valor: 'abonado', formato: 'moneda' },
        { titulo: 'Saldo', valor: 'saldo', formato: 'moneda' },
      ],
      obtener: (p) =>
        servicio.listarLiquidaciones(
          { q: consulta.q, periodoId: consulta.periodoId, estado: consulta.estado },
          p,
        ),
    }),
);

export const POST = ruta(
  { permiso: 'planilla.liquidar', cuerpo: esquemaLiquidacion },
  async ({ actor, cuerpo }) => servicio.crearLiquidacion(actor, cuerpo),
);
