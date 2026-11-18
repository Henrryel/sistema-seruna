import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaReglas, esquemaRegla, type FilaRegla } from '@/esquemas/matricula/reglas';
import { etiqueta } from '@/esquemas/matricula/comunes';
import * as servicio from '@/server/services/matricula/reglas';

export const GET = ruta({ permiso: 'matriculas.gestionar', consulta: consultaReglas }, async ({ consulta }) =>
  responderListado<FilaRegla>(consulta, {
    titulo: 'Reglas de matrícula',
    filtros: { 'Tipo de ingreso': consulta.tipoIngreso ? etiqueta(consulta.tipoIngreso) : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Grado', valor: 'grado', ancho: 16 },
      { titulo: 'Ingreso', valor: (f) => etiqueta(f.tipo_ingreso) },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Solicitudes desde', valor: 'solicitudes_inicio', formato: 'fecha' },
      { titulo: 'Solicitudes hasta', valor: 'solicitudes_fin', formato: 'fecha' },
      { titulo: 'Corte de edad', valor: 'corte_edad', formato: 'fecha' },
      { titulo: 'Edad', valor: (f) => (f.edad_minima ?? f.edad_maxima) !== null ? `${f.edad_minima ?? '—'} a ${f.edad_maxima ?? '—'}` : '' },
      { titulo: 'Publicada', valor: (f) => (f.publicada_en ? new Date(f.publicada_en) : null), formato: 'fechaHora' },
      { titulo: 'Requisitos', valor: 'requisitos', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarReglas(consulta, p),
  }),
);

export const POST = ruta({ permiso: 'matriculas.gestionar', cuerpo: esquemaRegla }, async ({ actor, cuerpo }) => servicio.crearRegla(actor, cuerpo));
