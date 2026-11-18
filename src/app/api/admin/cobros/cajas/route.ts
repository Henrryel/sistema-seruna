import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCajas, esquemaCaja, type FilaCaja } from '@/esquemas/cobros/caja';
import * as servicio from '@/server/services/cobros/caja';

export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaCajas }, async ({ consulta }) =>
  responderListado<FilaCaja>(consulta, {
    titulo: 'Cajas',
    columnas: [
      { titulo: 'Caja', valor: 'nombre' },
      { titulo: 'Activa', valor: 'activa', formato: 'booleano' },
      { titulo: 'Operador con sesión abierta', valor: 'operador' },
      { titulo: 'Abierta desde', valor: 'abierta_en', formato: 'fechaHora' },
    ],
    obtener: (p) => servicio.listarCajas({ q: consulta.q }, p),
  }),
);

export const POST = ruta({ permiso: 'tesoreria.cobrar', cuerpo: esquemaCaja }, async ({ actor, cuerpo }) => servicio.crearCaja(actor, cuerpo));
