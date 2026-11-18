'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatoFechaHora } from '@/lib/formato';
import type { EnlaceAcceso } from '@/esquemas/identidad/usuarios';

/**
 * Muestra UNA sola vez el enlace de activación/recuperación (en la base solo queda el hash del token).
 * Al cerrar, el enlace se descarta del estado del cliente.
 */
export function DialogoEnlaceAcceso(props: { enlace: EnlaceAcceso | null; login?: string; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const enlace = props.enlace;
  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace.url);
      setCopiado(true);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar. Seleccione el enlace y cópielo manualmente.');
    }
  };
  return (
    <Dialog
      open={enlace !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          setCopiado(false);
          props.alCerrar();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden />
            {enlace?.proposito === 'recuperacion' ? 'Enlace de recuperación' : 'Enlace de activación'}
          </DialogTitle>
          <DialogDescription>
            Entréguelo personalmente {props.login ? <strong>a {props.login}</strong> : 'al usuario'}. Es de un solo uso y vence el{' '}
            {formatoFechaHora(enlace?.expiraEn)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="enlace-acceso">Enlace</Label>
          <div className="flex gap-2">
            <Input id="enlace-acceso" readOnly value={enlace?.url ?? ''} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copiar} aria-label="Copiar enlace">
              {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
            </Button>
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-md bg-alerta px-3 py-2 text-sm text-alerta-foreground" role="note">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Este enlace se muestra una sola vez. Si se pierde, genere uno nuevo (el anterior quedará anulado).
        </p>
        <DialogFooter>
          <Button type="button" onClick={() => props.alCerrar()}>
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
