import type { Metadata } from 'next';
import Link from 'next/link';
import { consultarTokenAcceso } from '@/server/services/auth';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormularioAcceso } from './formulario';

export const metadata: Metadata = { title: 'Crear contraseña', referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function PaginaAcceso({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const datos = await consultarTokenAcceso(token);
  return (
    <main id="contenido" className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {datos ? (
          <FormularioAcceso
            token={token}
            nombre={datos.nombres}
            login={datos.login}
            titulo={datos.proposito === 'activacion' ? 'Activar su cuenta' : 'Recuperar acceso'}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Enlace no válido</CardTitle>
              <CardDescription>El enlace ya fue usado, venció o no existe. Solicite uno nuevo al colegio.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/login">Ir al inicio de sesión</Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </main>
  );
}
