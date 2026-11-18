'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, ScanLine, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import { esquemaLector, type FilaLector } from '@/esquemas/asistencia/configuracion';

const ENDPOINT = '/api/admin/asistencia/lectores';

function CamposLector() {
  return (
    <div className="grid gap-4">
      <CampoTexto nombre="codigo" etiqueta="Código" placeholder="PUERTA-1" descripcion="Se muestra en el escáner y en el motivo de las lecturas sin conexión." />
      <CampoTexto nombre="nombre" etiqueta="Nombre / ubicación" placeholder="Puerta principal (Av. …)" />
      <CampoSwitch nombre="activo" etiqueta="Activo" descripcion="Un lector inactivo no registra marcaciones QR." />
    </div>
  );
}

export function ClienteLectores() {
  const recargar = useRecargarListado();
  const [editando, setEditando] = useState<FilaLector | null>(null);
  return (
    <>
      <EncabezadoPagina
        titulo="Lectores QR"
        descripcion={
          <>
            Puntos de lectura (tablet con cámara o lector USB) habilitados para marcar asistencia en el{' '}
            <Link href="/escaner" className="text-primary underline-offset-4 hover:underline">
              escáner de puerta
            </Link>
            .
          </>
        }
        acciones={
          <DialogoFormulario
            titulo="Nuevo lector"
            esquema={esquemaLector}
            valores={{ codigo: '', nombre: '', activo: true }}
            alEnviar={async (d) => {
              await api.post(ENDPOINT, d);
              await recargar(ENDPOINT);
            }}
            mensajeExito="Lector creado"
            disparador={
              <Button>
                <Plus aria-hidden /> Nuevo lector
              </Button>
            }
          >
            <CamposLector />
          </DialogoFormulario>
        }
      />
      <TablaDatos<FilaLector>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por código o nombre…"
        filtros={[
          {
            nombre: 'activo',
            etiqueta: 'Estado',
            tipo: 'select',
            opciones: [
              { valor: 'true', etiqueta: 'Activos' },
              { valor: 'false', etiqueta: 'Inactivos' },
            ],
          },
        ]}
        columnas={[
          {
            clave: 'codigo',
            titulo: 'Lector',
            celda: (f) => (
              <span className="inline-flex items-center gap-2">
                <ScanLine className="size-4 text-muted-foreground" aria-hidden />
                <span>
                  <span className="font-medium">{f.codigo}</span>
                  <span className="block text-xs text-muted-foreground">{f.nombre}</span>
                </span>
              </span>
            ),
          },
          { clave: 'activo', titulo: 'Estado', celda: (f) => <Etiqueta tono={f.activo ? 'exito' : 'neutro'}>{f.activo ? 'Activo' : 'Inactivo'}</Etiqueta> },
          { clave: 'marcaciones', titulo: 'Marcaciones', celda: (f) => f.marcaciones.toLocaleString('es-PE'), ocultarEnMovil: true },
          { clave: 'ultima', titulo: 'Última lectura', celda: (f) => formatoFechaHora(f.ultima_marcacion), ocultarEnMovil: true },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.codigo}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
            {f.marcaciones === 0 ? (
              <Confirmar
                titulo={`¿Eliminar el lector ${f.codigo}?`}
                descripcion="Solo es posible porque aún no registró marcaciones."
                destructivo
                textoConfirmar="Eliminar"
                mensajeExito="Lector eliminado"
                alConfirmar={async () => {
                  await api.delete(`${ENDPOINT}/${f.id}`);
                  await recargar(ENDPOINT);
                }}
                disparador={
                  <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${f.codigo}`}>
                    <Trash2 aria-hidden />
                  </Button>
                }
              />
            ) : null}
          </>
        )}
      />
      <DialogoFormulario
        titulo={`Editar lector ${editando?.codigo ?? ''}`}
        esquema={esquemaLector}
        valores={editando ? { codigo: editando.codigo, nombre: editando.nombre, activo: editando.activo } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${editando?.id}`, d);
          await recargar(ENDPOINT);
        }}
      >
        <CamposLector />
      </DialogoFormulario>
    </>
  );
}
