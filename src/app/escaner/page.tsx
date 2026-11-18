import { exigirSesionPagina } from '@/server/paginas';
import * as servicio from '@/server/services/asistencia/configuracion';
import { ClienteEscaner } from './cliente';

export default async function PaginaEscaner() {
  const actor = await exigirSesionPagina();
  const lectores = await servicio.lectoresActivos();
  return <ClienteEscaner lectoresIniciales={lectores} operador={`${actor.nombres} ${actor.apellidos}`} />;
}
