import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCuotas, descripcionCuota, type FilaCuota } from '@/esquemas/cobros/cuotas';
import * as servicio from '@/server/services/cobros/cuotas';

export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaCuotas }, async ({ consulta }) =>
  responderListado<FilaCuota>(consulta, {
    titulo: 'Cuotas',
    filtros: { Concepto: consulta.concepto, Estado: consulta.estado, Búsqueda: consulta.q },
    horizontal: true,
    columnas: [
      { titulo: 'Alumno', valor: 'alumno', ancho: 30 },
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Grado', valor: 'grado' },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Cuota', valor: (f) => descripcionCuota(f), ancho: 24 },
      { titulo: 'Vence', valor: 'vence_en', formato: 'fecha' },
      { titulo: 'Importe', valor: 'importe', formato: 'moneda' },
      { titulo: 'Ajustes', valor: 'ajustes', formato: 'moneda' },
      { titulo: 'Abonado', valor: 'abonado', formato: 'moneda' },
      { titulo: 'Saldo', valor: 'saldo', formato: 'moneda' },
    ],
    obtener: (p) =>
      servicio.listarCuotas(
        {
          q: consulta.q,
          anioId: consulta.anioId,
          gradoId: consulta.gradoId,
          seccionId: consulta.seccionId,
          matriculaId: consulta.matriculaId,
          concepto: consulta.concepto,
          estado: consulta.estado,
        },
        p,
      ),
  }),
);
