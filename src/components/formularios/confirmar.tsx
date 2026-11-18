'use client';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { mensajeDeError } from '@/lib/api';

/**
 * Confirmación de acciones irreversibles. Si `pedirMotivo`, exige un sustento (muchas operaciones
 * de la base lo requieren: reversiones, rectificaciones, anulaciones).
 */
export function Confirmar(props: {
  disparador: ReactNode;
  titulo: string;
  descripcion?: ReactNode;
  textoConfirmar?: string;
  destructivo?: boolean;
  pedirMotivo?: boolean;
  etiquetaMotivo?: string;
  mensajeExito?: string;
  alConfirmar: (motivo: string) => Promise<unknown>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <AlertDialog open={abierto} onOpenChange={(v) => { setAbierto(v); if (!v) setMotivo(''); }}>
      <AlertDialogTrigger asChild>{props.disparador}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.titulo}</AlertDialogTitle>
          {props.descripcion ? <AlertDialogDescription>{props.descripcion}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {props.pedirMotivo ? (
          <div className="grid gap-2">
            <Label htmlFor="motivo-confirmacion">{props.etiquetaMotivo ?? 'Motivo'}</Label>
            <Textarea id="motivo-confirmacion" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={enviando || (props.pedirMotivo && motivo.trim().length < 3)}
            className={props.destructivo ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
            onClick={async (e) => {
              e.preventDefault();
              setEnviando(true);
              try {
                await props.alConfirmar(motivo.trim());
                toast.success(props.mensajeExito ?? 'Operación realizada');
                setAbierto(false);
                setMotivo('');
              } catch (err) {
                toast.error(mensajeDeError(err));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {props.textoConfirmar ?? 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
