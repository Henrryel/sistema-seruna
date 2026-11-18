'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, GraduationCap, LogOut, Presentation, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NOMBRE_PORTAL, type Portal } from '@/lib/permisos';
import { api, mensajeDeError } from '@/lib/api';

const ICONOS: Record<Portal, typeof Building2> = { admin: Building2, docente: Presentation, estudiante: GraduationCap, padre: Users };

export function SelectorPortales({ portales }: { portales: Portal[] }) {
  const router = useRouter();
  return (
    <div className="grid gap-3">
      {portales.map((p) => {
        const Icono = ICONOS[p];
        return (
          <Button
            key={p}
            variant="outline"
            className="h-16 justify-start gap-3 text-base"
            onClick={async () => {
              try {
                const r = await api.post<{ destino: string }>('/api/sesion/portal', { portal: p });
                router.push(r.destino);
              } catch (e) {
                toast.error(mensajeDeError(e));
              }
            }}
          >
            <Icono className="size-5" aria-hidden /> {NOMBRE_PORTAL[p]}
          </Button>
        );
      })}
      <Button
        variant="ghost"
        onClick={async () => {
          await api.post('/api/auth/logout').catch(() => undefined);
          router.push('/login');
        }}
      >
        <LogOut aria-hidden /> Cerrar sesión
      </Button>
    </div>
  );
}
