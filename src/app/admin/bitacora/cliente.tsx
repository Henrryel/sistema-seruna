'use client';
import { useQuery } from '@tanstack/react-query';
import { TablaDatos } from '@/components/datos/tabla-datos';
import { Etiqueta, type Tono } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { api } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import type { FilaBitacora, OpcionesBitacora } from '@/esquemas/identidad/bitacora';

const ENDPOINT = '/api/admin/identidad/bitacora';

const TONO_RESULTADO: Record<string, Tono> = {
  ok: 'exito',
  fallido: 'peligro',
  rechazado: 'peligro',
  bloqueado: 'peligro',
  pendiente: 'alerta',
};

const legible = (v: string) => v.replace(/_/g, ' ');
const opciones = (lista: string[] | undefined) => (lista ?? []).map((v) => ({ valor: v, etiqueta: legible(v) }));

export function ClienteBitacora() {
  const filtros = useQuery({
    queryKey: ['bitacora-opciones'],
    queryFn: () => api.get<OpcionesBitacora>(`${ENDPOINT}/opciones`),
    staleTime: 60_000,
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Bitácora de auditoría"
        descripcion="Registro inmutable de acciones de usuarios y de la base (triggers). Las fechas se filtran en hora de Lima."
      />
      <TablaDatos<FilaBitacora>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        buscador={false}
        porPagina={30}
        filtros={[
          { nombre: 'accion', etiqueta: 'Acción', tipo: 'select', opciones: opciones(filtros.data?.acciones) },
          { nombre: 'entidad', etiqueta: 'Entidad', tipo: 'select', opciones: opciones(filtros.data?.entidades) },
          { nombre: 'resultado', etiqueta: 'Resultado', tipo: 'select', opciones: opciones(filtros.data?.resultados) },
          { nombre: 'actor', etiqueta: 'Actor (login)', tipo: 'texto' },
          { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
          { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
        ]}
        columnas={[
          {
            clave: 'ocurrido_en',
            titulo: 'Fecha y hora',
            className: 'whitespace-nowrap tabular-nums',
            celda: (f) => formatoFechaHora(f.ocurrido_en),
          },
          {
            clave: 'accion',
            titulo: 'Acción',
            celda: (f) => (
              <div className="min-w-0">
                <p className="font-medium">{legible(f.accion)}</p>
                <p className="text-xs text-muted-foreground">
                  {f.entidad}
                  {f.registro_id ? ` #${f.registro_id}` : ''}
                </p>
              </div>
            ),
          },
          { clave: 'actor_login', titulo: 'Actor', celda: (f) => <span className="font-mono text-xs">{f.actor_login ?? 'sistema'}</span> },
          {
            clave: 'afectado_login',
            titulo: 'Usuario afectado',
            ocultarEnMovil: true,
            celda: (f) => <span className="font-mono text-xs">{f.afectado_login ?? '—'}</span>,
          },
          {
            clave: 'motivo',
            titulo: 'Motivo',
            ocultarEnMovil: true,
            celda: (f) => (
              <span className="line-clamp-2 max-w-xs text-sm text-muted-foreground" title={f.motivo ?? undefined}>
                {f.motivo ?? '—'}
              </span>
            ),
          },
          { clave: 'resultado', titulo: 'Resultado', celda: (f) => <Etiqueta tono={TONO_RESULTADO[f.resultado] ?? 'neutro'}>{legible(f.resultado)}</Etiqueta> },
        ]}
      />
    </>
  );
}
