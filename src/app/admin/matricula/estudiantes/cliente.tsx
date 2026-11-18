'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { SelectorPersona, PERSONA_VACIA } from '@/components/matricula/selector-persona';
import { EtiquetaBooleana } from '@/components/matricula/campos';
import { ENDPOINTS } from '@/components/matricula/utilidades';
import { api } from '@/lib/api';
import { esquemaEstudianteNuevo, type FilaEstudiante } from '@/esquemas/matricula/estudiantes';

export function ClienteEstudiantes() {
  const router = useRouter();
  const recargar = useRecargarListado();
  return (
    <>
      <EncabezadoPagina
        titulo="Estudiantes"
        descripcion="Alta de estudiantes con su persona y documento de identidad. Abra la ficha para gestionar apoderados, matrículas y expediente."
        acciones={
          <DialogoFormulario
            titulo="Nuevo estudiante"
            descripcion="El código interno y el código SIAGIE son únicos (la base lo valida)."
            esquema={esquemaEstudianteNuevo}
            valores={{ codigo: '', codigoSiagie: '', activo: true, persona: PERSONA_VACIA }}
            ancho="lg"
            alEnviar={async (d) => {
              const r = await api.post<{ id: string }>(ENDPOINTS.estudiantes, d);
              await recargar(ENDPOINTS.estudiantes);
              router.push(`/admin/matricula/estudiantes/${r.id}`);
            }}
            mensajeExito="Estudiante registrado"
            disparador={
              <Button>
                <UserPlus aria-hidden /> Nuevo estudiante
              </Button>
            }
          >
            <SelectorPersona titulo="Datos personales del estudiante" avisoEstudiante />
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto nombre="codigo" etiqueta="Código interno" autoComplete="off" />
              <CampoTexto nombre="codigoSiagie" etiqueta="Código SIAGIE" descripcion="Opcional" autoComplete="off" />
            </div>
            <CampoSwitch nombre="activo" etiqueta="Activo" descripcion="Un estudiante inactivo no puede solicitar matrícula." />
          </DialogoFormulario>
        }
      />
      <TablaDatos<FilaEstudiante>
        endpoint={ENDPOINTS.estudiantes}
        claveFila={(f) => f.id}
        placeholderBusqueda="Código, apellidos, SIAGIE o DNI…"
        filtros={[
          {
            nombre: 'activo',
            etiqueta: 'Activo',
            tipo: 'select',
            opciones: [
              { valor: 'true', etiqueta: 'Activos' },
              { valor: 'false', etiqueta: 'Inactivos' },
            ],
          },
        ]}
        alSeleccionarFila={(f) => router.push(`/admin/matricula/estudiantes/${f.id}`)}
        vacio={<EstadoVacio titulo="Sin estudiantes" descripcion="Registre un estudiante o ajuste la búsqueda." />}
        columnas={[
          { clave: 'codigo', titulo: 'Código', celda: (f) => <span className="font-mono text-xs">{f.codigo}</span> },
          {
            clave: 'nombre',
            titulo: 'Estudiante',
            celda: (f) => (
              <span className="font-medium">
                {f.apellidos}, {f.nombres}
              </span>
            ),
          },
          { clave: 'documento', titulo: 'Documento', celda: (f) => f.documento ?? '—', ocultarEnMovil: true },
          { clave: 'codigo_siagie', titulo: 'SIAGIE', celda: (f) => f.codigo_siagie ?? '—', ocultarEnMovil: true },
          {
            clave: 'ultima_matricula',
            titulo: 'Última matrícula',
            ocultarEnMovil: true,
            celda: (f) =>
              f.ultima_matricula ? (
                <span className="flex flex-wrap items-center gap-1">
                  {f.ultima_matricula} <BadgeEstado estado={f.estado_matricula} />
                </span>
              ) : (
                '—'
              ),
          },
          { clave: 'activo', titulo: 'Activo', celda: (f) => <EtiquetaBooleana valor={f.activo} si="Activo" no="Inactivo" /> },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/admin/matricula/estudiantes/${f.id}`} aria-label={`Ver ficha de ${f.apellidos}, ${f.nombres}`}>
              <Eye aria-hidden />
            </Link>
          </Button>
        )}
      />
    </>
  );
}
