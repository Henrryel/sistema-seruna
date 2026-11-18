import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { obtenerPersona } from '@/server/services/identidad/personas';
import { ClienteUsuarios, type PersonaPreseleccionada } from './cliente';

export const metadata: Metadata = { title: 'Usuarios y accesos' };

const ID = /^[1-9]\d{0,18}$/;

/** Sugerencia de login: inicial del nombre + primer apellido, sin tildes ni espacios. */
function sugerirLogin(nombres: string, apellidos: string) {
  const limpiar = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  return `${limpiar(nombres).slice(0, 1)}${limpiar(apellidos.split(/\s+/)[0] ?? '')}`;
}

export default async function PaginaUsuarios({ searchParams }: { searchParams: Promise<{ persona?: string; usuario?: string }> }) {
  const actor = await exigirPermisoPagina('usuarios.gestionar');
  const { persona, usuario } = await searchParams;
  let personaInicial: PersonaPreseleccionada | null = null;
  let usuarioInicial = usuario && ID.test(usuario) ? usuario : null;
  if (persona && ID.test(persona)) {
    const p = await obtenerPersona(persona).catch(() => null);
    if (p?.usuario) usuarioInicial = p.usuario.id;
    else if (p) personaInicial = { id: p.id, etiqueta: `${p.apellidos}, ${p.nombres}`, login: sugerirLogin(p.nombres, p.apellidos) };
  }
  return <ClienteUsuarios actorId={actor.usuarioId} personaInicial={personaInicial} usuarioInicial={usuarioInicial} />;
}
