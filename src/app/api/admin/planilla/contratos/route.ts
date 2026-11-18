import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import {
  consultaContratos,
  esquemaContrato,
  NOMBRE_MODALIDAD,
  textoRemuneracion,
  type FilaContrato,
} from '@/esquemas/planilla/contratos';
import * as servicio from '@/server/services/planilla/contratos';
import { leerCuerpoConArchivo } from '../_comun/formulario';

export const GET = ruta(
  { permiso: 'planilla.contratos', consulta: consultaContratos },
  async ({ consulta }) =>
    responderListado<FilaContrato>(consulta, {
      titulo: 'Contratos docentes',
      filtros: {
        Modalidad: consulta.modalidad ? NOMBRE_MODALIDAD[consulta.modalidad] : undefined,
        Situación: consulta.situacion,
        Búsqueda: consulta.q,
      },
      columnas: [
        { titulo: 'Docente', valor: 'docente', ancho: 30 },
        { titulo: 'Código', valor: 'codigo_docente' },
        { titulo: 'Referencia', valor: 'referencia' },
        { titulo: 'Modalidad', valor: (f) => NOMBRE_MODALIDAD[f.modalidad] },
        { titulo: 'Remuneración', valor: (f) => textoRemuneracion(f), ancho: 26 },
        { titulo: 'Desde', valor: 'inicio', formato: 'fecha' },
        { titulo: 'Hasta', valor: 'fin', formato: 'fecha' },
        { titulo: 'Horas', valor: 'horas', formato: 'numero' },
        { titulo: 'Liquidaciones', valor: 'liquidaciones', formato: 'numero' },
      ],
      obtener: (p) =>
        servicio.listarContratos(
          {
            q: consulta.q,
            docenteId: consulta.docenteId,
            modalidad: consulta.modalidad,
            situacion: consulta.situacion,
          },
          p,
        ),
    }),
);

/** JSON o multipart (`datos` + `archivo` con el documento del contrato, opcional). */
export const POST = ruta({ permiso: 'planilla.contratos' }, async ({ req, actor }) => {
  const { datos, archivo } = await leerCuerpoConArchivo(req, esquemaContrato);
  return servicio.crearContrato(actor, datos, archivo);
});
