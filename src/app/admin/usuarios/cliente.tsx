'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, KeyRound, Loader2, LogOut, RotateCcw, Save, UserCog, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { CampoPersona } from '@/components/identidad/campo-persona';
import { CampoRoles, ListaRoles, useRoles } from '@/components/identidad/lista-roles';
import { DialogoEnlaceAcceso } from '@/components/identidad/enlace-acceso';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import {
  ESTADOS_USUARIO,
  esquemaCrearUsuario,
  NOMBRE_ESTADO_USUARIO,
  type DetalleUsuario,
  type EnlaceAcceso,
  type FilaUsuario,
} from '@/esquemas/identidad/usuarios';
import type { RespuestaListado } from '@/esquemas/comunes';
import type { FilaBitacora } from '@/esquemas/identidad/bitacora';

const ENDPOINT = '/api/admin/identidad/usuarios';
const OPCIONES_ESTADO = ESTADOS_USUARIO.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO_USUARIO[e] ?? e }));

export interface PersonaPreseleccionada {
  id: string;
  etiqueta: string;
  login: string;
}

interface EnlaceMostrado {
  enlace: EnlaceAcceso;
  login: string;
}

export function ClienteUsuarios(props: { actorId: string; personaInicial: PersonaPreseleccionada | null; usuarioInicial: string | null }) {
  const recargar = useRecargarListado();
  const roles = useRoles();
  // La persona preseleccionada (?persona=) solo se usa para la primera alta.
  const [precarga, setPrecarga] = useState(props.personaInicial);
  const [creando, setCreando] = useState(Boolean(props.personaInicial));
  const [seleccionado, setSeleccionado] = useState<string | null>(props.usuarioInicial);
  const [enlace, setEnlace] = useState<EnlaceMostrado | null>(null);

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios y accesos"
        descripcion="Cuentas de acceso, roles, suspensión y enlaces de activación de un solo uso. Todo queda en la bitácora."
        acciones={
          <Button onClick={() => setCreando(true)}>
            <UserPlus aria-hidden /> Nueva cuenta
          </Button>
        }
      />
      <DialogoFormulario
        titulo="Nueva cuenta de acceso"
        descripcion="La cuenta nace pendiente: el usuario define su contraseña con el enlace de activación."
        esquema={esquemaCrearUsuario}
        valores={{ personaId: precarga?.id ?? '', login: precarga?.login ?? '', roles: [], generarEnlace: true }}
        abierto={creando}
        alCambiarAbierto={setCreando}
        ancho="lg"
        textoEnviar="Crear cuenta"
        mensajeExito="Cuenta creada (pendiente de activación)"
        alEnviar={async (d) => {
          const r = await api.post<{ id: string; login: string; enlace: EnlaceAcceso | null }>(ENDPOINT, d);
          await recargar(ENDPOINT);
          setPrecarga(null);
          if (r.enlace) setEnlace({ enlace: r.enlace, login: r.login });
        }}
      >
        <CampoPersona
          nombre="personaId"
          etiqueta="Persona"
          perfil="sin_usuario"
          etiquetaInicial={precarga?.etiqueta}
          descripcion="Solo se listan personas sin cuenta. Si no existe, regístrela en Personas."
        />
        <CampoTexto nombre="login" etiqueta="Usuario (login)" autoComplete="off" descripcion="Se guarda en minúsculas. Ej.: rquispe" />
        <CampoRoles nombre="roles" etiqueta="Roles" />
        <CampoSwitch nombre="generarEnlace" etiqueta="Generar enlace de activación" descripcion="Se mostrará una sola vez para entregarlo al usuario." />
      </DialogoFormulario>

      <TablaDatos<FilaUsuario>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por login, nombre o documento…"
        filtros={[
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO },
          { nombre: 'rol', etiqueta: 'Rol', tipo: 'select', opciones: (roles.data ?? []).map((r) => ({ valor: r.codigo, etiqueta: r.nombre })) },
        ]}
        alSeleccionarFila={(f) => setSeleccionado(f.id)}
        columnas={[
          {
            clave: 'login',
            titulo: 'Usuario',
            celda: (f) => (
              <div className="min-w-0">
                <p className="font-mono text-sm">{f.login}</p>
                <p className="text-xs text-muted-foreground">
                  {f.apellidos}, {f.nombres}
                </p>
              </div>
            ),
          },
          {
            clave: 'roles',
            titulo: 'Roles',
            ocultarEnMovil: true,
            celda: (f) => (
              <div className="flex flex-wrap gap-1">
                {f.roles.length ? f.roles.map((r) => <Etiqueta key={r}>{r}</Etiqueta>) : <span className="text-muted-foreground">Sin roles</span>}
              </div>
            ),
          },
          { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
          { clave: 'ultimo_acceso', titulo: 'Último acceso', ocultarEnMovil: true, celda: (f) => formatoFechaHora(f.ultimo_acceso) },
          { clave: 'sesiones_activas', titulo: 'Sesiones', ocultarEnMovil: true, className: 'text-right tabular-nums', celda: (f) => f.sesiones_activas },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Gestionar ${f.login}`} onClick={() => setSeleccionado(f.id)}>
            <UserCog aria-hidden />
          </Button>
        )}
      />

      <Sheet open={seleccionado !== null} onOpenChange={(v) => !v && setSeleccionado(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {seleccionado ? (
            <FichaUsuario
              id={seleccionado}
              esUnoMismo={seleccionado === props.actorId}
              alGenerarEnlace={(e, login) => {
                setSeleccionado(null);
                setEnlace({ enlace: e, login });
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <DialogoEnlaceAcceso enlace={enlace?.enlace ?? null} login={enlace?.login} alCerrar={() => setEnlace(null)} />
    </>
  );
}

function FichaUsuario(props: { id: string; esUnoMismo: boolean; alGenerarEnlace: (e: EnlaceAcceso, login: string) => void }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const clave = ['usuario', props.id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetalleUsuario>(`${ENDPOINT}/${props.id}`) });
  const actividad = useQuery({
    queryKey: ['usuario-actividad', props.id],
    queryFn: () => api.get<RespuestaListado<FilaBitacora>>(conConsulta('/api/admin/identidad/bitacora', { usuarioId: props.id, porPagina: 8 })),
  });
  const u = consulta.data;
  const [roles, setRoles] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (u) setRoles(u.roles);
  }, [u]);

  const refrescar = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: clave }), qc.invalidateQueries({ queryKey: ['usuario-actividad', props.id] }), recargar(ENDPOINT)]);
  };

  if (consulta.isPending) {
    return (
      <div className="grid gap-3 p-4" aria-busy="true">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!u) {
    return (
      <div className="p-4">
        <SheetHeader className="px-0">
          <SheetTitle>Cuenta de acceso</SheetTitle>
        </SheetHeader>
        <EstadoVacio titulo="No se pudo cargar" descripcion={mensajeDeError(consulta.error)} />
      </div>
    );
  }

  const cambiado = [...roles].sort().join(',') !== [...u.roles].sort().join(',');
  const proposito = u.estado === 'pendiente' || !u.tiene_contrasena ? 'activacion' : 'recuperacion';

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-mono">{u.login}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <span>
            {u.apellidos}, {u.nombres}
          </span>
          <BadgeEstado estado={u.estado} />
          {props.esUnoMismo ? <Etiqueta tono="info">Su cuenta</Etiqueta> : null}
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 px-4 pb-6">
        <section aria-labelledby="acceso-usuario" className="grid gap-2">
          <h3 id="acceso-usuario" className="text-sm font-semibold">
            Acceso
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Contraseña</dt>
            <dd>{u.tiene_contrasena ? 'Definida' : 'Aún no definida'}</dd>
            <dt className="text-muted-foreground">Último acceso</dt>
            <dd>{formatoFechaHora(u.ultimo_acceso)}</dd>
            <dt className="text-muted-foreground">Sesiones abiertas</dt>
            <dd>{u.sesiones.length}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Confirmar
              titulo={proposito === 'activacion' ? '¿Generar enlace de activación?' : '¿Generar enlace de recuperación?'}
              descripcion="Se anularán los enlaces anteriores no usados. El nuevo enlace se mostrará una sola vez."
              textoConfirmar="Generar"
              mensajeExito="Enlace generado"
              alConfirmar={async () => {
                const r = await api.post<EnlaceAcceso>(`${ENDPOINT}/${u.id}/enlace`, { proposito });
                await refrescar();
                props.alGenerarEnlace(r, u.login);
              }}
              disparador={
                <Button size="sm" disabled={u.estado === 'suspendido'}>
                  <KeyRound aria-hidden /> {proposito === 'activacion' ? 'Enlace de activación' : 'Enlace de recuperación'}
                </Button>
              }
            />
            {u.estado === 'suspendido' ? (
              <Confirmar
                titulo="¿Reactivar la cuenta?"
                descripcion={u.tiene_contrasena ? 'La cuenta quedará activa.' : 'La cuenta no tiene contraseña: quedará pendiente hasta que se active con un enlace.'}
                pedirMotivo
                etiquetaMotivo="Motivo de la reactivación"
                textoConfirmar="Reactivar"
                mensajeExito="Cuenta reactivada"
                alConfirmar={async (motivo) => {
                  await api.post(`${ENDPOINT}/${u.id}/estado`, { estado: 'activo', motivo });
                  await refrescar();
                }}
                disparador={
                  <Button size="sm" variant="outline">
                    <RotateCcw aria-hidden /> Reactivar
                  </Button>
                }
              />
            ) : (
              <Confirmar
                titulo={`¿Suspender la cuenta ${u.login}?`}
                descripcion="Se cerrarán sus sesiones y se anularán sus enlaces pendientes. No podrá ingresar hasta ser reactivada."
                pedirMotivo
                etiquetaMotivo="Motivo de la suspensión"
                destructivo
                textoConfirmar="Suspender"
                mensajeExito="Cuenta suspendida"
                alConfirmar={async (motivo) => {
                  await api.post(`${ENDPOINT}/${u.id}/estado`, { estado: 'suspendido', motivo });
                  await refrescar();
                }}
                disparador={
                  <Button size="sm" variant="outline" disabled={props.esUnoMismo} title={props.esUnoMismo ? 'No puede suspender su propia cuenta' : undefined}>
                    <Ban aria-hidden /> Suspender
                  </Button>
                }
              />
            )}
            <Confirmar
              titulo="¿Cerrar todas las sesiones?"
              descripcion={props.esUnoMismo ? 'Se cerrarán sus otras sesiones; la actual se conserva.' : 'El usuario deberá iniciar sesión nuevamente en todos sus dispositivos.'}
              textoConfirmar="Cerrar sesiones"
              mensajeExito="Sesiones cerradas"
              alConfirmar={async () => {
                await api.delete(`${ENDPOINT}/${u.id}/sesiones`);
                await refrescar();
              }}
              disparador={
                <Button size="sm" variant="outline" disabled={u.sesiones.length === 0}>
                  <LogOut aria-hidden /> Cerrar sesiones
                </Button>
              }
            />
          </div>
          {u.estado === 'suspendido' ? <p className="text-xs text-muted-foreground">Reactive la cuenta para generar enlaces de acceso.</p> : null}
        </section>

        <section aria-labelledby="roles-usuario" className="grid gap-2">
          <h3 id="roles-usuario" className="text-sm font-semibold">
            Roles
          </h3>
          <ListaRoles seleccion={roles} alCambiar={setRoles} deshabilitado={guardando} />
          {props.esUnoMismo ? <p className="text-xs text-muted-foreground">No puede quitarse a sí mismo el permiso de gestionar usuarios.</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={!cambiado || guardando} onClick={() => setRoles(u.roles)}>
              Descartar
            </Button>
            <Button
              size="sm"
              disabled={!cambiado || guardando}
              onClick={async () => {
                setGuardando(true);
                try {
                  await api.put(`${ENDPOINT}/${u.id}/roles`, { roles });
                  toast.success('Roles actualizados');
                  await refrescar();
                } catch (e) {
                  toast.error(mensajeDeError(e));
                } finally {
                  setGuardando(false);
                }
              }}
            >
              {guardando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Guardar roles
            </Button>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Permisos efectivos ({u.permisos.length})</summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {u.permisos.map((p) => (
                <Etiqueta key={p} className="font-mono">
                  {p}
                </Etiqueta>
              ))}
            </div>
          </details>
        </section>

        {u.tokens.length > 0 ? (
          <section aria-labelledby="tokens-usuario" className="grid gap-2">
            <h3 id="tokens-usuario" className="text-sm font-semibold">
              Enlaces pendientes de uso
            </h3>
            <ul className="grid gap-1 text-sm">
              {u.tokens.map((t) => (
                <li key={t.id} className="rounded-md border px-3 py-2">
                  <span className="font-medium">{t.proposito === 'activacion' ? 'Activación' : 'Recuperación'}</span> · emitido {formatoFechaHora(t.emitido_en)}
                  {t.emisor ? ` por ${t.emisor}` : ''} · vence {formatoFechaHora(t.expira_en)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {u.sesiones.length > 0 ? (
          <section aria-labelledby="sesiones-usuario" className="grid gap-2">
            <h3 id="sesiones-usuario" className="text-sm font-semibold">
              Sesiones abiertas
            </h3>
            <ul className="grid gap-1 text-sm">
              {u.sesiones.map((s) => (
                <li key={s.id} className="rounded-md border px-3 py-2">
                  Desde {formatoFechaHora(s.creada_en)} · vence {formatoFechaHora(s.expira_en)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="actividad-usuario" className="grid gap-2">
          <h3 id="actividad-usuario" className="text-sm font-semibold">
            Actividad reciente
          </h3>
          {actividad.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : (actividad.data?.filas.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {actividad.data?.filas.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-2 rounded-md border px-3 py-2">
                  <span>
                    <span className="font-medium">{e.accion.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground"> · {e.actor_login ?? 'sistema'}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatoFechaHora(e.ocurrido_en)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
