import { redirect } from 'next/navigation';
import { obtenerActor } from '@/server/auth/actor';
import { portalPreferido } from '@/server/paginas';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const actor = await obtenerActor();
  if (!actor) redirect('/login');
  const portal = await portalPreferido(actor);
  redirect(portal ? `/${portal}` : '/portal');
}
