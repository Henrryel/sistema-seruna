import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaBitacora, type FilaBitacora } from '@/esquemas/identidad/bitacora';
import * as servicio from '@/server/services/identidad/bitacora';

export const GET = ruta({ permiso: 'usuarios.gestionar', consulta: consultaBitacora }, async ({ consulta }) =>
  responderListado<FilaBitacora>(consulta, {
    titulo: 'Bitácora de auditoría',
    nombreArchivo: 'bitacora',
    filtros: {
      Acción: consulta.accion,
      Entidad: consulta.entidad,
      Resultado: consulta.resultado,
      Actor: consulta.actor,
      Desde: consulta.desde,
      Hasta: consulta.hasta,
    },
    columnas: [
      { titulo: 'Fecha y hora', valor: 'ocurrido_en', formato: 'fechaHora' },
      { titulo: 'Actor', valor: 'actor_login' },
      { titulo: 'Usuario afectado', valor: 'afectado_login' },
      { titulo: 'Acción', valor: 'accion' },
      { titulo: 'Entidad', valor: 'entidad' },
      { titulo: 'Registro', valor: 'registro_id' },
      { titulo: 'Motivo', valor: 'motivo', ancho: 40 },
      { titulo: 'Resultado', valor: 'resultado' },
    ],
    obtener: (p) =>
      servicio.listarBitacora(
        {
          accion: consulta.accion,
          entidad: consulta.entidad,
          resultado: consulta.resultado,
          actor: consulta.actor,
          desde: consulta.desde,
          hasta: consulta.hasta,
          usuarioId: consulta.usuarioId,
        },
        p,
      ),
  }),
);
