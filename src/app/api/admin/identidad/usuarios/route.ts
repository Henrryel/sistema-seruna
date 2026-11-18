import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaUsuarios, esquemaCrearUsuario, type FilaUsuario } from '@/esquemas/identidad/usuarios';
import * as servicio from '@/server/services/identidad/usuarios';

export const GET = ruta({ permiso: 'usuarios.gestionar', consulta: consultaUsuarios }, async ({ consulta }) =>
  responderListado<FilaUsuario>(consulta, {
    titulo: 'Usuarios',
    filtros: { Estado: consulta.estado, Rol: consulta.rol, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Login', valor: 'login' },
      { titulo: 'Apellidos', valor: 'apellidos' },
      { titulo: 'Nombres', valor: 'nombres' },
      { titulo: 'Roles', valor: 'roles_texto' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Último acceso', valor: 'ultimo_acceso', formato: 'fechaHora' },
      { titulo: 'Sesiones activas', valor: 'sesiones_activas', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarUsuarios({ q: consulta.q, estado: consulta.estado, rol: consulta.rol }, p),
  }),
);

/** Crea la cuenta (estado pendiente) y, si se pide, devuelve UNA vez el enlace de activación. */
export const POST = ruta({ permiso: 'usuarios.gestionar', cuerpo: esquemaCrearUsuario }, async ({ req, actor, cuerpo }) =>
  servicio.crearUsuario(actor, cuerpo, req.nextUrl.origin),
);
