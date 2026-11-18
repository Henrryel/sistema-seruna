import { cn } from '@/lib/utils';

export type Tono = 'exito' | 'alerta' | 'peligro' | 'info' | 'neutro';

const TONOS: Record<Tono, string> = {
  exito: 'bg-exito text-exito-foreground',
  alerta: 'bg-alerta text-alerta-foreground',
  peligro: 'bg-peligro text-peligro-foreground',
  info: 'bg-info text-info-foreground',
  neutro: 'bg-muted text-muted-foreground',
};

/** Etiqueta de estado con color + texto (nunca solo color, por accesibilidad). */
export function Etiqueta({ tono = 'neutro', children, className }: { tono?: Tono; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONOS[tono], className)}>
      {children}
    </span>
  );
}

const NIVEL: Record<string, { tono: Tono; texto: string }> = {
  AD: { tono: 'exito', texto: 'Logro destacado' },
  A: { tono: 'info', texto: 'Logro esperado' },
  B: { tono: 'alerta', texto: 'En proceso' },
  C: { tono: 'peligro', texto: 'En inicio' },
};

/** Nivel de logro CNEB: AD, A, B, C. */
export function BadgeNivelLogro({ nivel, conTexto = false }: { nivel: string | null | undefined; conTexto?: boolean }) {
  if (!nivel) return <Etiqueta>—</Etiqueta>;
  const d = NIVEL[nivel] ?? { tono: 'neutro' as const, texto: nivel };
  return (
    <Etiqueta tono={d.tono}>
      <span className="font-bold" aria-label={d.texto}>
        {nivel}
      </span>
      {conTexto ? <span className="ml-1 font-normal">· {d.texto}</span> : null}
    </Etiqueta>
  );
}

export type EstadoPago = 'pagado' | 'pendiente' | 'vencido' | 'parcial';

const PAGO: Record<EstadoPago, { tono: Tono; texto: string }> = {
  pagado: { tono: 'exito', texto: 'Pagado' },
  parcial: { tono: 'info', texto: 'Pago parcial' },
  pendiente: { tono: 'alerta', texto: 'Pendiente' },
  vencido: { tono: 'peligro', texto: 'Vencido' },
};

/** Semáforo de pago a partir de saldo, abonado y vencimiento (vista saldos_cuotas). */
export function estadoPago(c: { saldo: string | number | null; abonado?: string | number | null; vence_en: string | null }, hoy: string): EstadoPago {
  const saldo = Number(c.saldo ?? 0);
  if (saldo <= 0) return 'pagado';
  if (c.vence_en && c.vence_en < hoy) return 'vencido';
  if (Number(c.abonado ?? 0) > 0) return 'parcial';
  return 'pendiente';
}

export function BadgeEstadoPago({ estado }: { estado: EstadoPago }) {
  const d = PAGO[estado];
  return <Etiqueta tono={d.tono}>{d.texto}</Etiqueta>;
}

const ESTADOS: Record<string, Tono> = {
  activo: 'exito', activa: 'exito', aprobado: 'exito', aprobada: 'exito', publicado: 'exito', emitido: 'exito', validado: 'exito', presente: 'exito', realizada: 'exito', abierto: 'info', cerrado: 'neutro', cerrada: 'neutro',
  pendiente: 'alerta', borrador: 'alerta', solicitada: 'alerta', preparado: 'alerta', preparada: 'alerta', programada: 'info', tarde: 'alerta', observado: 'alerta', parcial: 'info',
  suspendido: 'peligro', anulada: 'peligro', anulado: 'peligro', rechazada: 'peligro', fallido: 'peligro', ausente: 'peligro', retirada: 'neutro', trasladada: 'neutro', cancelada: 'neutro', justificado: 'info', revertido: 'peligro',
};

/** Badge genérico para columnas `estado` de la base. */
export function BadgeEstado({ estado }: { estado: string | null | undefined }) {
  if (!estado) return <Etiqueta>—</Etiqueta>;
  const texto = estado.replace(/_/g, ' ');
  return <Etiqueta tono={ESTADOS[estado] ?? 'neutro'}>{texto.charAt(0).toUpperCase() + texto.slice(1)}</Etiqueta>;
}
