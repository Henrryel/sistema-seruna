import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaMatriculas, esquemaSolicitud, type FilaMatricula } from '@/esquemas/matricula/matriculas';
import { etiqueta } from '@/esquemas/matricula/comunes';
import * as servicio from '@/server/services/matricula/matriculas';

export const GET = ruta({ permiso: ['matriculas.gestionar', 'expediente.gestionar'], consulta: consultaMatriculas }, async ({ consulta }) =>
  responderListado<FilaMatricula>(consulta, {
    titulo: 'Matrículas',
    filtros: { Estado: consulta.estado ? etiqueta(consulta.estado) : undefined, 'Tipo de ingreso': consulta.tipoIngreso ? etiqueta(consulta.tipoIngreso) : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Apellidos', valor: 'apellidos', ancho: 20 },
      { titulo: 'Nombres', valor: 'nombres', ancho: 20 },
      { titulo: 'Grado', valor: 'grado', ancho: 15 },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Ingreso', valor: (f) => etiqueta(f.tipo_ingreso) },
      { titulo: 'Estado', valor: (f) => etiqueta(f.estado) },
      { titulo: 'Solicitada', valor: (f) => new Date(f.solicitada_en), formato: 'fechaHora' },
      { titulo: 'Confirmada', valor: (f) => (f.confirmada_en ? new Date(f.confirmada_en) : null), formato: 'fechaHora' },
    ],
    obtener: (p) => servicio.listarMatriculas(consulta, p),
  }),
);

/** Solicitud de matrícula (valida ventana y edad de la regla publicada vigente). */
export const POST = ruta({ permiso: 'matriculas.gestionar', cuerpo: esquemaSolicitud }, async ({ actor, cuerpo }) =>
  servicio.solicitarMatricula(actor, cuerpo),
);
