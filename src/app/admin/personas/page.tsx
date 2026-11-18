import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { ClientePersonas } from './cliente';

export const metadata: Metadata = { title: 'Personas' };

export default async function PaginaPersonas() {
  const actor = await exigirPermisoPagina(['usuarios.gestionar', 'matriculas.gestionar']);
  return <ClientePersonas puedeGestionarUsuarios={tienePermiso(actor, 'usuarios.gestionar')} />;
}
