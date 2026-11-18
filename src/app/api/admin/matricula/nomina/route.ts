import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaNomina, type FilaNomina } from '@/esquemas/matricula/matriculas';
import { etiqueta } from '@/esquemas/matricula/comunes';
import * as servicio from '@/server/services/matricula/matriculas';

/** Nómina por año/grado/sección (vista reporte_nomina_matriculas) con exportación Excel/PDF. */
export const GET = ruta({ permiso: ['matriculas.gestionar', 'reportes.matriculas'], consulta: consultaNomina }, async ({ consulta }) =>
  responderListado<FilaNomina>(consulta, {
    titulo: 'Nómina de matrícula',
    nombreArchivo: 'nomina-matricula',
    horizontal: true,
    filtros: { Estado: consulta.estado ? etiqueta(consulta.estado) : undefined, 'Ubicación al': consulta.fecha, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'N.º', valor: 'numero', formato: 'numero', ancho: 5 },
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Código SIAGIE', valor: 'codigo_siagie' },
      { titulo: 'Apellidos', valor: 'apellidos', ancho: 20 },
      { titulo: 'Nombres', valor: 'nombres', ancho: 20 },
      { titulo: 'Nivel', valor: 'nivel' },
      { titulo: 'Grado', valor: (f) => `${f.grado}.º` },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Estado', valor: (f) => etiqueta(f.estado) },
      { titulo: 'Ingreso', valor: (f) => etiqueta(f.tipo_ingreso) },
      { titulo: 'Desde', valor: 'desde', formato: 'fecha' },
      { titulo: 'Hasta', valor: 'hasta', formato: 'fecha' },
    ],
    obtener: (p) => servicio.nomina(consulta, p),
  }),
);
