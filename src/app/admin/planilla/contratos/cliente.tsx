'use client';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { FileText, Pencil, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { CampoArchivo, cuerpoConArchivo, urlArchivo } from '@/components/planilla/campo-archivo';
import { SelectorPersona } from '@/components/planilla/selector-persona';
import { api } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, hoyLima, nombreCompleto } from '@/lib/formato';
import {
  esquemaActualizarDocente,
  esquemaContrato,
  esquemaDocente,
  NOMBRE_MODALIDAD,
  OPCIONES_MODALIDAD,
  textoRemuneracion,
  type FilaContrato,
  type FilaDocente,
} from '@/esquemas/planilla/contratos';

const EP_DOCENTES = '/api/admin/planilla/docentes';
const EP_CONTRATOS = '/api/admin/planilla/contratos';

const OPCIONES_SITUACION = [
  { valor: 'vigente', etiqueta: 'Vigente hoy' },
  { valor: 'futuro', etiqueta: 'Por iniciar' },
  { valor: 'vencido', etiqueta: 'Vencido' },
];

export function ClienteContratos() {
  const recargar = useRecargarListado();
  const [nuevoDocente, setNuevoDocente] = useState(false);
  const [editandoDocente, setEditandoDocente] = useState<FilaDocente | null>(null);
  const [contrato, setContrato] = useState<{ fila: FilaContrato | null; docenteId?: string } | null>(null);
  const [pestana, setPestana] = useState('contratos');

  const refrescar = async () => {
    await Promise.all([recargar(EP_DOCENTES), recargar(EP_CONTRATOS)]);
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Docentes y contratos"
        descripcion="Perfil docente y contratos fijos o por horas. La base impide vigencias solapadas y, si el contrato ya tiene horas o liquidaciones, solo admite cambiar su vigencia."
        acciones={
          <>
            <Button variant="outline" onClick={() => setNuevoDocente(true)}>
              <UserPlus aria-hidden /> Nuevo docente
            </Button>
            <Button onClick={() => setContrato({ fila: null })}>
              <Plus aria-hidden /> Nuevo contrato
            </Button>
          </>
        }
      />

      <Tabs value={pestana} onValueChange={setPestana}>
        <TabsList className="mb-3">
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="docentes">Docentes</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos">
          <TablaDatos<FilaContrato>
            endpoint={EP_CONTRATOS}
            claveFila={(f) => f.id}
            placeholderBusqueda="Docente, código o referencia…"
            filtros={[
              { nombre: 'modalidad', etiqueta: 'Modalidad', tipo: 'select', opciones: OPCIONES_MODALIDAD },
              { nombre: 'situacion', etiqueta: 'Situación', tipo: 'select', opciones: OPCIONES_SITUACION },
            ]}
            columnas={[
              {
                clave: 'docente',
                titulo: 'Docente',
                celda: (f) => (
                  <div className="min-w-40">
                    <div className="font-medium">{f.docente}</div>
                    <div className="text-muted-foreground text-xs">
                      {f.codigo_docente} · {f.referencia}
                    </div>
                  </div>
                ),
              },
              {
                clave: 'modalidad',
                titulo: 'Modalidad',
                celda: (f) => (
                  <Etiqueta tono={f.modalidad === 'fijo' ? 'info' : 'neutro'}>
                    {NOMBRE_MODALIDAD[f.modalidad]}
                  </Etiqueta>
                ),
              },
              {
                clave: 'remuneracion',
                titulo: 'Remuneración',
                celda: (f) => <span className="tabular-nums">{textoRemuneracion(f)}</span>,
                ocultarEnMovil: true,
              },
              {
                clave: 'vigencia',
                titulo: 'Vigencia',
                celda: (f) => <EtiquetaVigencia inicio={f.inicio} fin={f.fin} />,
              },
              {
                clave: 'uso',
                titulo: 'Uso',
                ocultarEnMovil: true,
                celda: (f) => (
                  <span className="text-muted-foreground text-sm">
                    {f.horas} hora(s) · {f.liquidaciones} liquidación(es)
                  </span>
                ),
              },
            ]}
            acciones={(f) => (
              <>
                {f.documento_id ? (
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a
                      href={urlArchivo(f.documento_id)}
                      aria-label={`Descargar documento del contrato ${f.referencia}`}
                      title={f.documento_nombre ?? 'Documento'}
                    >
                      <FileText aria-hidden />
                    </a>
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar contrato ${f.referencia}`}
                  onClick={() => setContrato({ fila: f })}
                >
                  <Pencil aria-hidden />
                </Button>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="docentes">
          <TablaDatos<FilaDocente>
            endpoint={EP_DOCENTES}
            claveFila={(f) => f.id}
            placeholderBusqueda="Nombre, código o DNI…"
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
                clave: 'docente',
                titulo: 'Docente',
                celda: (f) => <span className="font-medium">{nombreCompleto(f)}</span>,
              },
              { clave: 'codigo', titulo: 'Código' },
              { clave: 'dni', titulo: 'DNI', celda: (f) => f.dni ?? '—', ocultarEnMovil: true },
              {
                clave: 'contrato_vigente',
                titulo: 'Contrato vigente',
                celda: (f) =>
                  f.contrato_vigente ?? <span className="text-muted-foreground">Sin contrato vigente</span>,
                ocultarEnMovil: true,
              },
              {
                clave: 'activo',
                titulo: 'Estado',
                celda: (f) => <BadgeEstado estado={f.activo ? 'activo' : 'inactivo'} />,
              },
            ]}
            acciones={(f) => (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Nuevo contrato para ${nombreCompleto(f)}`}
                  onClick={() => {
                    setContrato({ fila: null, docenteId: f.id });
                  }}
                >
                  <Plus aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar docente ${nombreCompleto(f)}`}
                  onClick={() => setEditandoDocente(f)}
                >
                  <Pencil aria-hidden />
                </Button>
              </>
            )}
          />
        </TabsContent>
      </Tabs>

      <DialogoFormulario
        titulo="Nuevo docente"
        descripcion="Cree el perfil docente de una persona ya registrada o de una persona nueva."
        esquema={esquemaDocente}
        valores={{ origen: 'nueva', codigo: '', activo: true }}
        abierto={nuevoDocente}
        alCambiarAbierto={setNuevoDocente}
        alEnviar={async (d) => {
          await api.post(EP_DOCENTES, d);
          await refrescar();
          setPestana('docentes');
        }}
        mensajeExito="Docente registrado"
        ancho="lg"
      >
        <CamposDocente />
      </DialogoFormulario>

      <DialogoFormulario
        titulo={`Editar docente ${editandoDocente ? nombreCompleto(editandoDocente) : ''}`}
        esquema={esquemaActualizarDocente}
        valores={editandoDocente ? { codigo: editandoDocente.codigo, activo: editandoDocente.activo } : {}}
        abierto={editandoDocente !== null}
        alCambiarAbierto={(v) => !v && setEditandoDocente(null)}
        alEnviar={async (d) => {
          await api.put(`${EP_DOCENTES}/${editandoDocente?.id}`, d);
          await refrescar();
        }}
        mensajeExito="Docente actualizado"
      >
        <div className="grid gap-4">
          <CampoTexto nombre="codigo" etiqueta="Código" />
          <CampoSwitch
            nombre="activo"
            etiqueta="Activo"
            descripcion="Un docente inactivo no accede a su portal ni registra marcaciones."
          />
        </div>
      </DialogoFormulario>

      {contrato ? (
        <DialogoContrato
          fila={contrato.fila}
          docenteId={contrato.docenteId}
          alCerrar={() => setContrato(null)}
          alGuardar={async () => {
            await refrescar();
            setPestana('contratos');
          }}
        />
      ) : null}
    </>
  );
}

function EtiquetaVigencia({ inicio, fin }: { inicio: string | null; fin: string | null }) {
  const hoy = hoyLima();
  const estado = inicio && inicio > hoy ? 'Por iniciar' : fin && fin < hoy ? 'Vencido' : 'Vigente';
  return (
    <div className="min-w-32 text-sm">
      <div className="tabular-nums">
        {formatoFecha(inicio)} – {formatoFecha(fin)}
      </div>
      <Etiqueta tono={estado === 'Vigente' ? 'exito' : estado === 'Vencido' ? 'neutro' : 'info'}>
        {estado}
      </Etiqueta>
    </div>
  );
}

function CamposDocente() {
  const { watch } = useFormContext();
  const origen = watch('origen') as string;
  return (
    <div className="grid gap-4">
      <CampoSelect
        nombre="origen"
        etiqueta="Persona"
        opciones={[
          { valor: 'nueva', etiqueta: 'Registrar persona nueva' },
          { valor: 'existente', etiqueta: 'Persona ya registrada' },
        ]}
      />
      {origen === 'existente' ? (
        <SelectorPersona nombre="personaId" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="nombres" etiqueta="Nombres" autoComplete="off" />
          <CampoTexto nombre="apellidos" etiqueta="Apellidos" autoComplete="off" />
          <CampoTexto nombre="dni" etiqueta="DNI" descripcion="Opcional, 8 dígitos" autoComplete="off" />
          <CampoTexto
            nombre="telefono"
            etiqueta="Teléfono"
            tipo="tel"
            descripcion="Opcional"
            autoComplete="off"
          />
          <CampoTexto
            nombre="correo"
            etiqueta="Correo de contacto"
            tipo="email"
            descripcion="Opcional"
            className="sm:col-span-2"
            autoComplete="off"
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto nombre="codigo" etiqueta="Código docente" placeholder="DOC-0001" autoComplete="off" />
        <CampoSwitch nombre="activo" etiqueta="Activo" />
      </div>
    </div>
  );
}

function CamposContrato({ bloqueado, editando }: { bloqueado: boolean; editando: boolean }) {
  const { watch } = useFormContext();
  const modalidad = watch('modalidad') as string;
  const docentes = useCatalogo('docentes');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect
        nombre="docenteId"
        etiqueta="Docente"
        className="sm:col-span-2"
        opciones={docentes.data ?? []}
        placeholder={docentes.isPending ? 'Cargando…' : 'Seleccione el docente'}
        deshabilitado={editando}
      />
      <CampoTexto
        nombre="referencia"
        etiqueta="Referencia del contrato"
        placeholder="CT-2026-001"
        deshabilitado={bloqueado}
      />
      <CampoSelect
        nombre="modalidad"
        etiqueta="Modalidad"
        opciones={OPCIONES_MODALIDAD}
        deshabilitado={bloqueado}
      />
      <CampoTexto nombre="inicio" etiqueta="Inicio" tipo="date" />
      <CampoTexto nombre="fin" etiqueta="Fin" tipo="date" descripcion="Inclusive" />
      {modalidad === 'por_horas' ? (
        <>
          <CampoTexto
            nombre="tarifaHora"
            etiqueta="Tarifa por hora (S/)"
            tipo="number"
            paso="0.0001"
            deshabilitado={bloqueado}
          />
          <CampoTexto
            nombre="minutosPorHora"
            etiqueta="Minutos por hora pedagógica"
            tipo="number"
            paso="1"
            descripcion="Entre 1 y 60 (p. ej. 45)"
            deshabilitado={bloqueado}
          />
        </>
      ) : (
        <CampoTexto
          nombre="sueldoMensual"
          etiqueta="Sueldo mensual (S/)"
          tipo="number"
          paso="0.01"
          deshabilitado={bloqueado}
        />
      )}
    </div>
  );
}

function DialogoContrato(props: {
  fila: FilaContrato | null;
  docenteId?: string;
  alCerrar: () => void;
  alGuardar: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const f = props.fila;
  const bloqueado = Boolean(f && (f.horas > 0 || f.liquidaciones > 0));
  const anio = new Date().getFullYear();
  return (
    <DialogoFormulario
      titulo={f ? `Editar contrato ${f.referencia}` : 'Nuevo contrato'}
      descripcion={
        bloqueado
          ? 'Este contrato ya tiene horas o liquidaciones: la base solo permite cambiar la vigencia y siempre que siga cubriéndolas.'
          : 'Fijo: sueldo mensual. Por horas: tarifa por hora y minutos de la hora pedagógica.'
      }
      esquema={esquemaContrato}
      valores={
        f
          ? {
              docenteId: f.docente_id,
              referencia: f.referencia,
              inicio: f.inicio ?? '',
              fin: f.fin ?? '',
              modalidad: f.modalidad,
              sueldoMensual: f.sueldo_mensual,
              tarifaHora: f.tarifa_hora,
              minutosPorHora: f.minutos_por_hora,
            }
          : {
              docenteId: props.docenteId ?? '',
              referencia: '',
              inicio: `${anio}-03-01`,
              fin: `${anio}-12-31`,
              modalidad: 'fijo',
              sueldoMensual: '',
              tarifaHora: '',
              minutosPorHora: 45,
            }
      }
      abierto={abierto}
      alCambiarAbierto={(v) => {
        setAbierto(v);
        if (!v) props.alCerrar();
      }}
      alEnviar={async (d) => {
        const cuerpo = cuerpoConArchivo(d, archivo);
        if (f) await api.put(`${EP_CONTRATOS}/${f.id}`, cuerpo);
        else await api.post(EP_CONTRATOS, cuerpo);
        await props.alGuardar();
      }}
      mensajeExito={f ? 'Contrato actualizado' : 'Contrato registrado'}
      ancho="lg"
    >
      <CamposContrato bloqueado={bloqueado} editando={Boolean(f)} />
      {!bloqueado ? (
        <CampoArchivo
          etiqueta={f?.documento_id ? 'Reemplazar documento del contrato' : 'Documento del contrato'}
          descripcion={
            f?.documento_nombre
              ? `Actual: ${f.documento_nombre}. Opcional, PDF o imagen (máx. 15 MB).`
              : undefined
          }
          archivo={archivo}
          alCambiar={setArchivo}
        />
      ) : null}
    </DialogoFormulario>
  );
}
