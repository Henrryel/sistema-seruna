import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCredenciales, type FilaCredencial } from '@/esquemas/asistencia/credenciales';
import * as servicio from '@/server/services/asistencia/credenciales';

export const GET = ruta({ permiso: 'asistencia.configurar', portal: 'admin', consulta: consultaCredenciales }, async ({ consulta }) =>
  responderListado<FilaCredencial>(consulta, {
    titulo: 'Credenciales QR',
    filtros: { Estado: consulta.estado, Perfil: consulta.perfil, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Persona', valor: 'persona', ancho: 30 },
      { titulo: 'Perfil', valor: 'perfil' },
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Emitida', valor: (f) => new Date(f.emitida_en), formato: 'fechaHora' },
      { titulo: 'Vence', valor: (f) => new Date(f.expira_en), formato: 'fechaHora' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Emitida por', valor: 'emitida_por' },
    ],
    obtener: (p) => servicio.listarCredenciales({ q: consulta.q, estado: consulta.estado, perfil: consulta.perfil }, p),
  }),
);
