'use client';
import { useState } from 'react';
import { IdCard, Printer, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta, type Tono } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import type { EstadoCredencial, FilaCredencial } from '@/esquemas/asistencia/credenciales';
import { EmitirCredenciales, type PersonaElegida } from './emitir';

const ENDPOINT = '/api/admin/asistencia/credenciales';
const TONO: Record<EstadoCredencial, Tono> = { vigente: 'exito', vencida: 'neutro', revocada: 'peligro' };
const TEXTO: Record<EstadoCredencial, string> = { vigente: 'Vigente', vencida: 'Vencida', revocada: 'Revocada' };

export function ClienteCredenciales() {
  const recargar = useRecargarListado();
  const [abierto, setAbierto] = useState(false);
  const [inicial, setInicial] = useState<PersonaElegida[] | undefined>(undefined);

  return (
    <>
      <EncabezadoPagina
        titulo="Credenciales y carnets"
        descripcion="Cada carnet lleva un QR y un Code 128 con el mismo código. Solo se guarda su huella (hash): para reimprimir se reemite y la anterior queda revocada."
        acciones={
          <Button
            onClick={() => {
              setInicial(undefined);
              setAbierto(true);
            }}
          >
            <IdCard aria-hidden /> Emitir carnets
          </Button>
        }
      />
      <TablaDatos<FilaCredencial>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por nombre o código…"
        filtros={[
          {
            nombre: 'estado',
            etiqueta: 'Estado',
            tipo: 'select',
            opciones: (['vigente', 'vencida', 'revocada'] as const).map((e) => ({ valor: e, etiqueta: TEXTO[e] })),
          },
          {
            nombre: 'perfil',
            etiqueta: 'Perfil',
            tipo: 'select',
            opciones: [
              { valor: 'alumno', etiqueta: 'Alumnos' },
              { valor: 'docente', etiqueta: 'Docentes' },
            ],
          },
        ]}
        columnas={[
          {
            clave: 'persona',
            titulo: 'Persona',
            celda: (f) => (
              <div>
                <p className="font-medium">{f.persona}</p>
                <p className="text-xs text-muted-foreground">
                  {f.perfil} · {f.codigo ?? '—'}
                </p>
              </div>
            ),
          },
          { clave: 'estado', titulo: 'Estado', celda: (f) => <Etiqueta tono={TONO[f.estado]}>{TEXTO[f.estado]}</Etiqueta> },
          {
            clave: 'emitida_en',
            titulo: 'Emitida',
            ocultarEnMovil: true,
            celda: (f) => (
              <span className="text-xs">
                {formatoFechaHora(f.emitida_en)}
                <span className="block text-muted-foreground">por {f.emitida_por}</span>
              </span>
            ),
          },
          { clave: 'expira_en', titulo: 'Vence', celda: (f) => formatoFechaHora(f.expira_en), ocultarEnMovil: true },
          { clave: 'revocada_en', titulo: 'Revocada', celda: (f) => formatoFechaHora(f.revocada_en), ocultarEnMovil: true },
        ]}
        acciones={(f) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Reemitir y reimprimir carnet de ${f.persona}`}
              title="Reemitir (revoca la actual)"
              onClick={() => {
                setInicial([{ persona_id: f.persona_id, nombre: f.persona, detalle: null }]);
                setAbierto(true);
              }}
            >
              <Printer aria-hidden />
            </Button>
            {f.estado === 'vigente' ? (
              <Confirmar
                titulo={`¿Revocar la credencial de ${f.persona}?`}
                descripcion="El carnet dejará de registrar asistencia de inmediato. No se puede deshacer; para un carnet nuevo use «Reemitir»."
                destructivo
                pedirMotivo
                etiquetaMotivo="Motivo (p. ej., pérdida o robo)"
                textoConfirmar="Revocar"
                mensajeExito="Credencial revocada"
                alConfirmar={async (motivo) => {
                  await api.post(`${ENDPOINT}/${f.id}/revocar`, { motivo });
                  await recargar(ENDPOINT);
                }}
                disparador={
                  <Button variant="ghost" size="icon-sm" aria-label={`Revocar credencial de ${f.persona}`}>
                    <ShieldOff aria-hidden />
                  </Button>
                }
              />
            ) : null}
          </>
        )}
      />
      <EmitirCredenciales abierto={abierto} alCambiarAbierto={setAbierto} inicial={inicial} alEmitir={() => recargar(ENDPOINT)} />
    </>
  );
}
