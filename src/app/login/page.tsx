import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { obtenerActor } from '@/server/auth/actor';
import { FormularioLogin } from './formulario';

export const metadata: Metadata = { title: 'Iniciar sesión' };
export const dynamic = 'force-dynamic';

export default async function PaginaLogin() {
  if (await obtenerActor()) redirect('/');
  return (
    <main id="contenido" className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">SERUNA</h1>
          <p className="text-sm text-muted-foreground">Sistema de Gestión Escolar</p>
        </div>
        <Suspense>
          <FormularioLogin />
        </Suspense>
      </div>
    </main>
  );
}
