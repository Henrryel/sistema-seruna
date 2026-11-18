import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaListado } from '@/esquemas/comunes';
import { esquemaTipoDocumento, type FilaTipoDocumento } from '@/esquemas/matricula/reglas';
import * as servicio from '@/server/services/matricula/reglas';

export const GET = ruta({ permiso: ['matriculas.gestionar', 'expediente.gestionar'], consulta: consultaListado }, async ({ consulta }) =>
  responderListado<FilaTipoDocumento>(consulta, {
    titulo: 'Tipos de documento',
    filtros: { Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Nombre', valor: 'nombre', ancho: 30 },
      { titulo: 'Usos', valor: 'usos', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarTiposDocumento({ q: consulta.q }, p),
  }),
);

export const POST = ruta({ permiso: 'matriculas.gestionar', cuerpo: esquemaTipoDocumento }, async ({ actor, cuerpo }) =>
  servicio.crearTipoDocumento(actor, cuerpo),
);
