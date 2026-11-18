import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import { leerRangoFechas, rangoFechas } from '@/lib/formato';
import type {
  DatosContrato,
  FilaContrato,
  FilaDocente,
  Modalidad,
  OpcionContrato,
  OpcionPersona,
} from '@/esquemas/planilla/contratos';
import { HOY_LIMA, isoRequerido, patron } from './comun';

// Repositorio: ÚNICO lugar con SQL para docentes, personas (alta mínima) y contratos docentes.

const NOMBRE_PERSONA = sql<string>`p.apellidos || ', ' || p.nombres`;

// ───────────── Docentes ─────────────

export async function listarDocentes(filtros: { q?: string; activo?: boolean }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('docentes as d').innerJoin('personas as p', 'p.id', 'd.persona_id');
    if (filtros.activo !== undefined) q = q.where('d.activo', '=', filtros.activo);
    if (filtros.q) {
      const t = patron(filtros.q);
      q = q.where((eb) =>
        eb.or([
          eb('d.codigo', 'ilike', t),
          eb(NOMBRE_PERSONA, 'ilike', t),
          eb(sql<string>`p.nombres || ' ' || p.apellidos`, 'ilike', t),
          eb.exists(
            eb
              .selectFrom('documentos_identidad as di')
              .select('di.id')
              .whereRef('di.persona_id', '=', 'p.id')
              .where('di.numero', 'ilike', t),
          ),
        ]),
      );
    }
    return q;
  };
  const total = await base()
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        'd.id',
        'd.persona_id',
        'd.codigo',
        'd.activo',
        'p.nombres',
        'p.apellidos',
        eb
          .selectFrom('documentos_identidad as di')
          .select('di.numero')
          .whereRef('di.persona_id', '=', 'p.id')
          .where('di.tipo', '=', 'DNI')
          .limit(1)
          .as('dni'),
        eb
          .selectFrom('contratos_docentes as c')
          .select((e) => e.fn.countAll<string>().as('n'))
          .whereRef('c.docente_id', '=', 'd.id')
          .as('contratos'),
        eb
          .selectFrom('contratos_docentes as c')
          .select('c.referencia')
          .whereRef('c.docente_id', '=', 'd.id')
          .where(sql<boolean>`c.vigencia @> ${HOY_LIMA}`)
          .limit(1)
          .as('contrato_vigente'),
      ])
      .orderBy('p.apellidos')
      .orderBy('p.nombres'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaDocente => ({
      id: f.id,
      persona_id: f.persona_id,
      codigo: f.codigo,
      activo: f.activo,
      nombres: f.nombres,
      apellidos: f.apellidos,
      dni: f.dni ?? null,
      contratos: Number(f.contratos ?? 0),
      contrato_vigente: f.contrato_vigente ?? null,
    })),
    total: Number(total.n),
  };
}

export async function obtenerDocente(id: string) {
  return db()
    .selectFrom('docentes as d')
    .innerJoin('personas as p', 'p.id', 'd.persona_id')
    .select(['d.id', 'd.persona_id', 'd.codigo', 'd.activo', 'p.nombres', 'p.apellidos'])
    .where('d.id', '=', id)
    .executeTakeFirst();
}

/** Personas sin perfil docente (para dar de alta a una persona existente). */
export async function buscarPersonasSinDocente(q: string): Promise<OpcionPersona[]> {
  const t = patron(q);
  const filas = await db()
    .selectFrom('personas as p')
    .select((eb) => [
      'p.id',
      'p.nombres',
      'p.apellidos',
      eb
        .selectFrom('documentos_identidad as di')
        .select('di.numero')
        .whereRef('di.persona_id', '=', 'p.id')
        .where('di.tipo', '=', 'DNI')
        .limit(1)
        .as('dni'),
    ])
    .where((eb) =>
      eb.and([
        eb.not(
          eb.exists(eb.selectFrom('docentes as d').select('d.id').whereRef('d.persona_id', '=', 'p.id')),
        ),
        eb.or([
          eb(NOMBRE_PERSONA, 'ilike', t),
          eb(sql<string>`p.nombres || ' ' || p.apellidos`, 'ilike', t),
          eb.exists(
            eb
              .selectFrom('documentos_identidad as di')
              .select('di.id')
              .whereRef('di.persona_id', '=', 'p.id')
              .where('di.numero', 'ilike', t),
          ),
        ]),
      ]),
    )
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .limit(20)
    .execute();
  return filas.map((f) => ({ id: f.id, nombres: f.nombres, apellidos: f.apellidos, dni: f.dni ?? null }));
}

export async function crearPersona(d: {
  nombres: string;
  apellidos: string;
  correo?: string | null;
  telefono?: string | null;
}) {
  return db()
    .insertInto('personas')
    .values({
      nombres: d.nombres,
      apellidos: d.apellidos,
      correo_contacto: d.correo ?? null,
      telefono: d.telefono ?? null,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function crearDni(personaId: string, numero: string) {
  return db()
    .insertInto('documentos_identidad')
    .values({ persona_id: personaId, tipo: 'DNI', pais_emisor: 'PE', numero })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function crearDocente(d: { personaId: string; codigo: string; activo: boolean }) {
  return db()
    .insertInto('docentes')
    .values({ persona_id: d.personaId, codigo: d.codigo, activo: d.activo })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarDocente(id: string, d: { codigo: string; activo: boolean }) {
  return db()
    .updateTable('docentes')
    .set({ codigo: d.codigo, activo: d.activo })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

// ───────────── Contratos ─────────────

export async function listarContratos(
  filtros: {
    q?: string;
    docenteId?: string;
    modalidad?: Modalidad;
    situacion?: 'vigente' | 'futuro' | 'vencido';
  },
  p: Paginacion | null,
) {
  const base = () => {
    let q = db()
      .selectFrom('contratos_docentes as c')
      .innerJoin('docentes as d', 'd.id', 'c.docente_id')
      .innerJoin('personas as p', 'p.id', 'd.persona_id');
    if (filtros.docenteId) q = q.where('c.docente_id', '=', filtros.docenteId);
    if (filtros.modalidad) q = q.where('c.modalidad', '=', filtros.modalidad);
    if (filtros.situacion === 'vigente') q = q.where(sql<boolean>`c.vigencia @> ${HOY_LIMA}`);
    if (filtros.situacion === 'futuro') q = q.where(sql<boolean>`lower(c.vigencia) > ${HOY_LIMA}`);
    if (filtros.situacion === 'vencido') q = q.where(sql<boolean>`upper(c.vigencia) <= ${HOY_LIMA}`);
    if (filtros.q) {
      const t = patron(filtros.q);
      q = q.where((eb) =>
        eb.or([eb('c.referencia', 'ilike', t), eb('d.codigo', 'ilike', t), eb(NOMBRE_PERSONA, 'ilike', t)]),
      );
    }
    return q;
  };
  const total = await base()
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('archivos as a', 'a.id', 'c.documento_id')
      .select((eb) => [
        'c.id',
        'c.docente_id',
        NOMBRE_PERSONA.as('docente'),
        'd.codigo as codigo_docente',
        'c.referencia',
        'c.vigencia',
        'c.modalidad',
        'c.sueldo_mensual',
        'c.tarifa_hora',
        'c.minutos_por_hora',
        'c.documento_id',
        'a.nombre_original as documento_nombre',
        'c.registrado_en',
        eb
          .selectFrom('horas_docentes as h')
          .select((e) => e.fn.countAll<string>().as('n'))
          .whereRef('h.contrato_id', '=', 'c.id')
          .as('horas'),
        eb
          .selectFrom('liquidaciones_docentes as l')
          .select((e) => e.fn.countAll<string>().as('n'))
          .whereRef('l.contrato_id', '=', 'c.id')
          .as('liquidaciones'),
      ])
      .orderBy(sql`lower(c.vigencia)`, 'desc')
      .orderBy('p.apellidos'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaContrato => {
      const r = leerRangoFechas(f.vigencia);
      return {
        id: f.id,
        docente_id: f.docente_id,
        docente: f.docente,
        codigo_docente: f.codigo_docente,
        referencia: f.referencia,
        inicio: r.inicio,
        fin: r.fin,
        modalidad: f.modalidad as Modalidad,
        sueldo_mensual: f.sueldo_mensual,
        tarifa_hora: f.tarifa_hora,
        minutos_por_hora: f.minutos_por_hora,
        documento_id: f.documento_id,
        documento_nombre: f.documento_nombre ?? null,
        horas: Number(f.horas ?? 0),
        liquidaciones: Number(f.liquidaciones ?? 0),
        registrado_en: isoRequerido(f.registrado_en),
      };
    }),
    total: Number(total.n),
  };
}

export async function obtenerContrato(id: string) {
  return db().selectFrom('contratos_docentes').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function opcionesContratos(filtros: {
  modalidad?: Modalidad;
  fecha?: string;
  mes?: string;
  docenteId?: string;
}): Promise<OpcionContrato[]> {
  let q = db()
    .selectFrom('contratos_docentes as c')
    .innerJoin('docentes as d', 'd.id', 'c.docente_id')
    .innerJoin('personas as p', 'p.id', 'd.persona_id')
    .select([
      'c.id',
      'c.docente_id',
      'c.referencia',
      'c.modalidad',
      'c.vigencia',
      NOMBRE_PERSONA.as('docente'),
      'd.codigo',
    ])
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .orderBy(sql`lower(c.vigencia)`, 'desc')
    .limit(500);
  if (filtros.modalidad) q = q.where('c.modalidad', '=', filtros.modalidad);
  if (filtros.docenteId) q = q.where('c.docente_id', '=', filtros.docenteId);
  if (filtros.fecha) q = q.where(sql<boolean>`c.vigencia @> ${filtros.fecha}::date`);
  if (filtros.mes)
    q = q.where(
      sql<boolean>`c.vigencia && daterange(${filtros.mes}::date, (${filtros.mes}::date + interval '1 month')::date, '[)')`,
    );
  const filas = await q.execute();
  return filas.map((f) => {
    const r = leerRangoFechas(f.vigencia);
    return {
      valor: f.id,
      etiqueta: `${f.docente} (${f.codigo}) · ${f.referencia}`,
      extra: { modalidad: f.modalidad as Modalidad, docenteId: f.docente_id, inicio: r.inicio, fin: r.fin },
    };
  });
}

export async function crearContrato(
  d: DatosContrato & { documentoId: string | null; registradoPor: string },
) {
  return db()
    .insertInto('contratos_docentes')
    .values({
      docente_id: d.docenteId,
      referencia: d.referencia,
      vigencia: rangoFechas(d.inicio, d.fin),
      modalidad: d.modalidad,
      sueldo_mensual: d.sueldoMensual,
      tarifa_hora: d.tarifaHora,
      minutos_por_hora: d.minutosPorHora,
      documento_id: d.documentoId,
      registrado_por: d.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/**
 * Actualiza el contrato. Si ya tiene horas o liquidaciones, el trigger `conservar_condiciones_contrato`
 * solo admite cambiar la vigencia (y que siga cubriéndolas): aquí no se replica esa regla.
 */
export async function actualizarContrato(id: string, d: DatosContrato & { documentoId?: string }) {
  return db()
    .updateTable('contratos_docentes')
    .set({
      docente_id: d.docenteId,
      referencia: d.referencia,
      vigencia: rangoFechas(d.inicio, d.fin),
      modalidad: d.modalidad,
      sueldo_mensual: d.sueldoMensual,
      tarifa_hora: d.tarifaHora,
      minutos_por_hora: d.minutosPorHora,
      ...(d.documentoId ? { documento_id: d.documentoId } : {}),
    })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

/** ¿En qué registros de planilla se usa el archivo? (para autorizar su descarga según el permiso). */
export async function usosDeArchivo(archivoId: string) {
  const fila = await db()
    .selectNoFrom((eb) => [
      eb
        .exists(eb.selectFrom('contratos_docentes').select('id').where('documento_id', '=', archivoId))
        .as('contrato'),
      eb
        .exists(eb.selectFrom('horas_docentes').select('id').where('evidencia_id', '=', archivoId))
        .as('hora'),
      eb
        .or([
          eb.exists(eb.selectFrom('pagos_docentes').select('id').where('evidencia_id', '=', archivoId)),
          eb.exists(
            eb.selectFrom('reversiones_pago_docente').select('id').where('evidencia_id', '=', archivoId),
          ),
        ])
        .as('pago'),
    ])
    .executeTakeFirstOrThrow();
  return { contrato: Boolean(fila.contrato), hora: Boolean(fila.hora), pago: Boolean(fila.pago) };
}
