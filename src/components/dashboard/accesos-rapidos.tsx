import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { NAVEGACION } from '@/config/navegacion';
import type { Permiso, Portal } from '@/lib/permisos';

/**
 * Accesos rápidos a las pantallas del portal que el usuario puede abrir (mismos permisos que el menú).
 * Componente de servidor: recibe los permisos ya resueltos del actor.
 */
export function AccesosRapidos(props: { portal: Portal; permisos: readonly Permiso[]; titulo?: string; excluir?: string[]; limite?: number }) {
  const raiz = `/${props.portal}`;
  const items = NAVEGACION[props.portal]
    .flatMap((g) => g.items.map((i) => ({ ...i, grupo: g.titulo })))
    .filter((i) => i.href !== raiz && !(props.excluir ?? []).includes(i.href))
    .filter((i) => !i.permisos || i.permisos.some((p) => props.permisos.includes(p)))
    .slice(0, props.limite ?? 50);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`accesos-${props.portal}`} className="grid gap-3">
      <h3 id={`accesos-${props.portal}`} className="text-base font-semibold">
        {props.titulo ?? 'Accesos rápidos'}
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <i.icono className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{i.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{i.grupo}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
