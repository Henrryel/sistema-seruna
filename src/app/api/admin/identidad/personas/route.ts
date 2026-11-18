import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaPersonas, esquemaCrearPersona, type FilaPersona } from '@/esquemas/identidad/personas';
import * as servicio from '@/server/services/identidad/personas';

const PERMISO = ['usuarios.gestionar', 'matriculas.gestionar'] as const;

export const GET = ruta({ permiso: PERMISO, consulta: consultaPersonas }, async ({ consulta }) =>
  responderListado<FilaPersona>(consulta, {
    titulo: 'Personas',
    filtros: { Perfil: consulta.perfil, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Apellidos', valor: 'apellidos' },
      { titulo: 'Nombres', valor: 'nombres' },
      { titulo: 'Documentos', valor: 'documentos' },
      { titulo: 'Nacimiento', valor: 'fecha_nacimiento', formato: 'fecha' },
      { titulo: 'Correo', valor: 'correo_contacto' },
      { titulo: 'Teléfono', valor: 'telefono' },
      { titulo: 'Usuario', valor: 'usuario_login' },
      { titulo: 'Estado de cuenta', valor: 'usuario_estado' },
    ],
    obtener: (p) => servicio.listarPersonas({ q: consulta.q, perfil: consulta.perfil }, p),
  }),
);

export const POST = ruta({ permiso: PERMISO, cuerpo: esquemaCrearPersona }, async ({ actor, cuerpo }) => servicio.crearPersona(actor, cuerpo));
