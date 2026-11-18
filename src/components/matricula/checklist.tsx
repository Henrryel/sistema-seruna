'use client';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Etiqueta, type Tono } from '@/components/datos/badges';
import { EstadoVacio } from '@/components/datos/basicos';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFecha } from '@/lib/formato';
import type { Checklist, EstadoRequisito } from '@/esquemas/matricula/expedientes';
import { ENDPOINTS } from './utilidades';

const TONO_REQUISITO: Record<EstadoRequisito, { tono: Tono; texto: string }> = {
  validado: { tono: 'exito', texto: 'Validado' },
  pendiente: { tono: 'info', texto: 'Por revisar' },
  observado: { tono: 'alerta', texto: 'Observado' },
  en_regularizacion: { tono: 'alerta', texto: 'En regularización' },
  faltante: { tono: 'peligro', texto: 'Falta' },
};

export const claveChecklist = (matriculaId: string) => ['checklist', matriculaId] as const;

/** Requisitos de la regla de la matrícula frente a los documentos presentados. */
export function ChecklistMatricula(props: { matriculaId: string; titulo?: string; accion?: ReactNode }) {
  const consulta = useQuery({
    queryKey: claveChecklist(props.matriculaId),
    queryFn: () => api.get<Checklist>(conConsulta(`${ENDPOINTS.expedientes}/checklist`, { matriculaId: props.matriculaId })),
  });
  const c = consulta.data;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{props.titulo ?? 'Requisitos de la regla'}</CardTitle>
          <CardDescription>
            {c ? `${c.obligatoriosValidados} de ${c.obligatorios} obligatorios validados${c.completo ? ' · completo' : ''}` : 'Documentos exigidos vs. presentados'}
          </CardDescription>
        </div>
        {props.accion}
      </CardHeader>
      <CardContent className="grid gap-3">
        {consulta.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : consulta.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {mensajeDeError(consulta.error)}
          </p>
        ) : !c || c.items.length === 0 ? (
          <EstadoVacio titulo="La regla no exige documentos" />
        ) : (
          <>
            <Progress value={c.obligatorios ? (c.obligatoriosValidados / c.obligatorios) * 100 : 100} aria-label="Avance de requisitos obligatorios" />
            <ul className="grid gap-2">
              {c.items.map((i) => {
                const t = TONO_REQUISITO[i.estado];
                return (
                  <li key={i.tipo_documento_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{i.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {i.obligatorio ? ' · obligatorio' : ' · opcional'}
                        {i.plazo_regularizacion ? ` · regularizar hasta ${formatoFecha(i.plazo_regularizacion)}` : ''}
                      </span>
                      {i.observacion && i.estado === 'observado' ? <span className="block text-xs text-muted-foreground">Obs.: {i.observacion}</span> : null}
                    </span>
                    <Etiqueta tono={t.tono}>{t.texto}</Etiqueta>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
