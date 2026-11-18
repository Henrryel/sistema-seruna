import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaDocentes, esquemaDocente, type FilaDocente } from '@/esquemas/planilla/contratos';
import * as servicio from '@/server/services/planilla/contratos';

export const GET = ruta({ permiso: 'planilla.contratos', consulta: consultaDocentes }, async ({ consulta }) =>
  responderListado<FilaDocente>(consulta, {
    titulo: 'Docentes',
    filtros: {
      Activo: consulta.activo === undefined ? undefined : consulta.activo === 'true' ? 'Sí' : 'No',
      Búsqueda: consulta.q,
    },
    columnas: [
      { titulo: 'Apellidos', valor: 'apellidos' },
      { titulo: 'Nombres', valor: 'nombres' },
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'DNI', valor: 'dni' },
      { titulo: 'Contrato vigente', valor: 'contrato_vigente' },
      { titulo: 'Contratos', valor: 'contratos', formato: 'numero' },
      { titulo: 'Activo', valor: 'activo', formato: 'booleano' },
    ],
    obtener: (p) =>
      servicio.listarDocentes(
        { q: consulta.q, activo: consulta.activo === undefined ? undefined : consulta.activo === 'true' },
        p,
      ),
  }),
);

export const POST = ruta(
  { permiso: 'planilla.contratos', cuerpo: esquemaDocente },
  async ({ actor, cuerpo }) => servicio.crearDocente(actor, cuerpo),
);
