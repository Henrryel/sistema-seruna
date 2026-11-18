'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, IdCard, Pencil, Plus, Trash2, UserCog, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha } from '@/lib/formato';
import {
  esquemaCrearPersona,
  esquemaDocumento,
  esquemaPersona,
  NOMBRE_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO,
  type DetallePersona,
  type DocumentoPersona,
  type FilaPersona,
} from '@/esquemas/identidad/personas';

const ENDPOINT = '/api/admin/identidad/personas';
const OPCIONES_TIPO = TIPOS_DOCUMENTO.map((t) => ({ valor: t, etiqueta: NOMBRE_TIPO_DOCUMENTO[t] ?? t }));
const OPCIONES_PERFIL = [
  { valor: 'con_usuario', etiqueta: 'Con cuenta' },
  { valor: 'sin_usuario', etiqueta: 'Sin cuenta' },
  { valor: 'estudiante', etiqueta: 'Estudiantes' },
  { valor: 'docente', etiqueta: 'Docentes' },
];

function CamposPersona() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto nombre="nombres" etiqueta="Nombres" autoComplete="off" />
      <CampoTexto nombre="apellidos" etiqueta="Apellidos" autoComplete="off" />
      <CampoTexto nombre="fechaNacimiento" etiqueta="Fecha de nacimiento" tipo="date" descripcion="Opcional" />
      <CampoTexto nombre="correoContacto" etiqueta="Correo de contacto" tipo="email" descripcion="Opcional" />
      <CampoTexto nombre="telefono" etiqueta="Teléfono" tipo="tel" descripcion="Opcional" />
      <CampoTexto nombre="direccion" etiqueta="Dirección" descripcion="Opcional" />
    </div>
  );
}

function CamposDocumento({ prefijo = '' }: { prefijo?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <CampoSelect nombre={`${prefijo}tipo`} etiqueta="Tipo" opciones={OPCIONES_TIPO} />
      <CampoTexto nombre={`${prefijo}paisEmisor`} etiqueta="País emisor" placeholder="PE" descripcion="Código ISO de 2 letras" />
      <CampoTexto nombre={`${prefijo}numero`} etiqueta="Número" autoComplete="off" descripcion="DNI: 8 dígitos" />
      {prefijo ? null : <CampoSwitch nombre="verificado" etiqueta="Verificado" descripcion="Documento cotejado con el original" className="sm:col-span-3" />}
    </div>
  );
}

const valoresPersona = (p?: DetallePersona) => ({
  nombres: p?.nombres ?? '',
  apellidos: p?.apellidos ?? '',
  fechaNacimiento: p?.fecha_nacimiento ?? '',
  correoContacto: p?.correo_contacto ?? '',
  telefono: p?.telefono ?? '',
  direccion: p?.direccion ?? '',
});

export function ClientePersonas({ puedeGestionarUsuarios }: { puedeGestionarUsuarios: boolean }) {
  const recargar = useRecargarListado();
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  return (
    <>
      <EncabezadoPagina
        titulo="Personas"
        descripcion="Registro único de personas (estudiantes, apoderados, docentes y personal) con sus documentos de identidad."
        acciones={
          <DialogoFormulario
            titulo="Nueva persona"
            descripcion="El documento es opcional; puede agregar otros después."
            esquema={esquemaCrearPersona}
            valores={{ ...valoresPersona(), documento: { tipo: 'DNI', paisEmisor: 'PE', numero: '' } }}
            ancho="lg"
            alEnviar={async (d) => {
              const r = await api.post<{ id: string }>(ENDPOINT, d);
              await recargar(ENDPOINT);
              setSeleccionada(r.id);
            }}
            mensajeExito="Persona registrada"
            disparador={
              <Button>
                <Plus aria-hidden /> Nueva persona
              </Button>
            }
          >
            <CamposPersona />
            <Separator />
            <p className="text-sm font-medium">Documento de identidad</p>
            <CamposDocumento prefijo="documento." />
          </DialogoFormulario>
        }
      />
      <TablaDatos<FilaPersona>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por nombre o documento…"
        filtros={[{ nombre: 'perfil', etiqueta: 'Perfil', tipo: 'select', opciones: OPCIONES_PERFIL }]}
        alSeleccionarFila={(f) => setSeleccionada(f.id)}
        columnas={[
          {
            clave: 'nombre',
            titulo: 'Persona',
            celda: (f) => (
              <div className="min-w-0">
                <p className="font-medium">
                  {f.apellidos}, {f.nombres}
                </p>
                <p className="text-xs text-muted-foreground md:hidden">{f.documentos || 'Sin documento'}</p>
              </div>
            ),
          },
          { clave: 'documentos', titulo: 'Documentos', celda: (f) => f.documentos || '—', ocultarEnMovil: true },
          {
            clave: 'contacto',
            titulo: 'Contacto',
            ocultarEnMovil: true,
            celda: (f) => <span className="text-sm text-muted-foreground">{[f.correo_contacto, f.telefono].filter(Boolean).join(' · ') || '—'}</span>,
          },
          {
            clave: 'perfiles',
            titulo: 'Perfiles',
            ocultarEnMovil: true,
            celda: (f) => (
              <div className="flex flex-wrap gap-1">
                {f.es_estudiante ? <Etiqueta tono="info">Estudiante</Etiqueta> : null}
                {f.es_docente ? <Etiqueta tono="info">Docente</Etiqueta> : null}
                {!f.es_estudiante && !f.es_docente ? <span className="text-muted-foreground">—</span> : null}
              </div>
            ),
          },
          {
            clave: 'cuenta',
            titulo: 'Cuenta',
            celda: (f) => (f.usuario_estado ? <BadgeEstado estado={f.usuario_estado} /> : <Etiqueta>Sin cuenta</Etiqueta>),
          },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Ver ficha de ${f.nombres} ${f.apellidos}`} onClick={() => setSeleccionada(f.id)}>
            <IdCard aria-hidden />
          </Button>
        )}
      />
      <Sheet open={seleccionada !== null} onOpenChange={(v) => !v && setSeleccionada(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {seleccionada ? <FichaPersona id={seleccionada} puedeGestionarUsuarios={puedeGestionarUsuarios} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FichaPersona({ id, puedeGestionarUsuarios }: { id: string; puedeGestionarUsuarios: boolean }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const clave = ['persona', id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetallePersona>(`${ENDPOINT}/${id}`) });
  const [editando, setEditando] = useState(false);
  const [documento, setDocumento] = useState<DocumentoPersona | 'nuevo' | null>(null);
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await recargar(ENDPOINT);
  };
  const p = consulta.data;

  if (consulta.isPending) {
    return (
      <div className="grid gap-3 p-4" aria-busy="true">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!p) {
    return (
      <div className="p-4">
        <SheetHeader className="px-0">
          <SheetTitle>Ficha de persona</SheetTitle>
        </SheetHeader>
        <EstadoVacio titulo="No se pudo cargar" descripcion={mensajeDeError(consulta.error)} />
      </div>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {p.apellidos}, {p.nombres}
        </SheetTitle>
        <SheetDescription className="flex flex-wrap gap-1">
          {p.es_estudiante ? <Etiqueta tono="info">Estudiante</Etiqueta> : null}
          {p.es_docente ? <Etiqueta tono="info">Docente</Etiqueta> : null}
          <span>Registrada el {formatoFecha(p.creado_en)}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 px-4 pb-6">
        <section aria-labelledby="datos-persona" className="grid gap-2">
          <div className="flex items-center justify-between">
            <h3 id="datos-persona" className="text-sm font-semibold">
              Datos personales
            </h3>
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              <Pencil aria-hidden /> Editar
            </Button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Nacimiento</dt>
            <dd>{formatoFecha(p.fecha_nacimiento)}</dd>
            <dt className="text-muted-foreground">Correo</dt>
            <dd className="break-all">{p.correo_contacto ?? '—'}</dd>
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd>{p.telefono ?? '—'}</dd>
            <dt className="text-muted-foreground">Dirección</dt>
            <dd>{p.direccion ?? '—'}</dd>
          </dl>
        </section>

        <section aria-labelledby="docs-persona" className="grid gap-2">
          <div className="flex items-center justify-between">
            <h3 id="docs-persona" className="text-sm font-semibold">
              Documentos de identidad
            </h3>
            <Button variant="outline" size="sm" onClick={() => setDocumento('nuevo')}>
              <Plus aria-hidden /> Agregar
            </Button>
          </div>
          {p.documentos.length === 0 ? (
            <EstadoVacio titulo="Sin documentos" descripcion="Registre el DNI, carné de extranjería o pasaporte." />
          ) : (
            <ul className="grid gap-2">
              {p.documentos.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">
                      {NOMBRE_TIPO_DOCUMENTO[d.tipo] ?? d.tipo} {d.numero}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      País {d.pais_emisor}
                      {d.verificado_en ? (
                        <>
                          {' · '}
                          <BadgeCheck className="size-3 text-exito-foreground" aria-hidden /> Verificado el {formatoFecha(d.verificado_en)}
                        </>
                      ) : (
                        ' · Sin verificar'
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${d.tipo} ${d.numero}`} onClick={() => setDocumento(d)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Confirmar
                      titulo={`¿Eliminar el documento ${d.tipo} ${d.numero}?`}
                      destructivo
                      textoConfirmar="Eliminar"
                      mensajeExito="Documento eliminado"
                      alConfirmar={async () => {
                        await api.delete(`/api/admin/identidad/documentos/${d.id}`);
                        await refrescar();
                      }}
                      disparador={
                        <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${d.tipo} ${d.numero}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="cuenta-persona" className="grid gap-2">
          <h3 id="cuenta-persona" className="text-sm font-semibold">
            Cuenta de acceso
          </h3>
          {p.usuario ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="font-mono text-sm">{p.usuario.login}</p>
                <BadgeEstado estado={p.usuario.estado} />
              </div>
              {puedeGestionarUsuarios ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/usuarios?usuario=${p.usuario.id}`}>
                    <UserCog aria-hidden /> Gestionar
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-3">
              <p className="text-sm text-muted-foreground">Esta persona no tiene cuenta de acceso.</p>
              {puedeGestionarUsuarios ? (
                <Button size="sm" asChild>
                  <Link href={`/admin/usuarios?persona=${p.id}`}>
                    <UserPlus aria-hidden /> Crear cuenta
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <DialogoFormulario
        titulo="Editar datos personales"
        esquema={esquemaPersona}
        valores={valoresPersona(p)}
        abierto={editando}
        alCambiarAbierto={setEditando}
        ancho="lg"
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${id}`, d);
          await refrescar();
        }}
      >
        <CamposPersona />
      </DialogoFormulario>
      <DialogoFormulario
        titulo={documento === 'nuevo' ? 'Agregar documento' : 'Editar documento'}
        esquema={esquemaDocumento}
        valores={
          documento && documento !== 'nuevo'
            ? { tipo: documento.tipo as 'DNI', paisEmisor: documento.pais_emisor, numero: documento.numero, verificado: Boolean(documento.verificado_en) }
            : { tipo: 'DNI', paisEmisor: 'PE', numero: '', verificado: false }
        }
        abierto={documento !== null}
        alCambiarAbierto={(v) => !v && setDocumento(null)}
        alEnviar={async (d) => {
          if (documento === 'nuevo') await api.post(`${ENDPOINT}/${id}/documentos`, d);
          else if (documento) await api.put(`/api/admin/identidad/documentos/${documento.id}`, d);
          await refrescar();
        }}
        mensajeExito="Documento guardado"
      >
        <CamposDocumento />
      </DialogoFormulario>
    </>
  );
}
