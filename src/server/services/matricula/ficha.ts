import 'server-only';
import { transaccion } from '@/server/db';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/matricula/matriculas';
import * as repoPersonas from '@/server/repositories/matricula/personas';
import * as repoApoderados from '@/server/repositories/matricula/apoderados';
import { generarFichaMatriculaPdf } from '@/server/pdf/matricula/ficha';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { etiqueta } from '@/esquemas/matricula/comunes';
import type { Actor } from '@/server/auth/actor';
import { obtenerMatricula } from './matriculas';
import { hoy } from './comun';

/** Ficha de matrícula en PDF (datos de un menor: la descarga queda auditada). */
export async function fichaMatriculaPdf(actor: Actor, matriculaId: string) {
  const m = await obtenerMatricula(matriculaId);
  const [persona, documentos, ubicaciones, apoderados, responsables, movimientos] = [
    await repoPersonas.obtenerPersona(m.persona_id),
    await repoPersonas.documentosDePersona(m.persona_id),
    await repo.listarUbicaciones(matriculaId),
    await repoApoderados.listarApoderados(m.estudiante_id, true),
    await repo.listarResponsables({ matriculaId }),
    await repo.listarMovimientos(matriculaId),
  ];
  const dia = hoy();
  const actual = ubicaciones.find((u) => u.desde <= dia && dia <= u.hasta) ?? ubicaciones.at(-1);
  const responsable = responsables.find((r) => r.vigente) ?? responsables[0] ?? null;
  const buffer = await generarFichaMatriculaPdf({
    alumno: {
      codigo: m.codigo,
      codigoSiagie: m.codigo_siagie,
      apellidos: m.apellidos,
      nombres: m.nombres,
      fechaNacimiento: m.fecha_nacimiento ? formatoFecha(m.fecha_nacimiento) : null,
      documentos: documentos.map((d) => `${d.tipo} ${d.numero}${d.pais_emisor !== 'PE' ? ` (${d.pais_emisor})` : ''}`).join(', ') || '—',
      direccion: persona?.direccion ?? null,
      telefono: persona?.telefono ?? null,
      correo: persona?.correo_contacto ?? null,
    },
    matricula: {
      id: m.id,
      anio: m.anio,
      nivel: m.nivel,
      grado: m.grado,
      tipoIngreso: etiqueta(m.tipo_ingreso),
      estado: etiqueta(m.estado),
      solicitadaEn: formatoFechaHora(m.solicitada_en),
      confirmadaEn: m.confirmada_en ? formatoFechaHora(m.confirmada_en) : null,
      reglaVersion: m.regla_version,
      referenciaSiagie: m.referencia_siagie,
    },
    seccionActual: actual ? `${m.grado} "${actual.seccion}" · turno ${actual.turno}` : null,
    ubicaciones: ubicaciones.map((u) => [`${u.seccion} (${u.turno})`, formatoFecha(u.desde), formatoFecha(u.hasta), etiqueta(u.tipo_vacante)]),
    apoderados: apoderados.map((a) => [
      `${a.apellidos}, ${a.nombres}`,
      etiqueta(a.parentesco),
      a.documento ?? '—',
      a.telefono ?? '—',
      a.verificado_en ? formatoFecha(a.verificado_en) : 'No',
      [a.acceso_academico ? 'Académico' : null, a.acceso_economico ? 'Económico' : null].filter(Boolean).join(', ') || 'Ninguno',
    ]),
    responsable: responsable
      ? {
          nombre: responsable.nombre_razon_social,
          documento: `${responsable.tipo_documento} ${responsable.numero_documento}`,
          direccion: responsable.direccion,
          desde: formatoFecha(responsable.desde),
        }
      : null,
    movimientos: movimientos.map((mv) => [formatoFecha(mv.fecha_efectiva), etiqueta(mv.tipo), mv.motivo, mv.detalle ?? '']),
  });
  await transaccion(() =>
    registrarBitacora({ actorId: actor.usuarioId, accion: 'descargar_ficha', entidad: 'matriculas', registroId: matriculaId, resultado: 'ok' }),
  );
  return { buffer, nombre: `ficha-matricula-${m.anio}-${m.codigo}.pdf` };
}
