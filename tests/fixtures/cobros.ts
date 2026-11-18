// Fixtures del módulo de cobros. Usar SIEMPRE dentro de enPrueba() (todo se revierte).
import { randomBytes } from 'node:crypto';
import { db, sql } from '@/server/db';
import type { Actor } from '@/server/auth/actor';
import * as planes from '@/server/services/cobros/planes';
import * as caja from '@/server/services/cobros/caja';
import { crearAdmin, crearAnio, crearEstudiante, crearMatriculaActiva, gradoId, sufijo } from './base';

/** Documento institucional 'condiciones_economicas' publicado del año (con un archivo ficticio). */
export async function crearCondiciones(anioId: string, version = 1) {
  const archivo = await db()
    .insertInto('archivos')
    .values({
      clave_almacenamiento: `pruebas/condiciones-${sufijo()}.pdf`,
      nombre_original: 'condiciones.pdf',
      tipo_mime: 'application/pdf',
      bytes: 0,
      sha256: randomBytes(32),
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return db()
    .insertInto('documentos_institucionales')
    .values({
      anio_id: anioId,
      tipo: 'condiciones_economicas',
      version,
      archivo_id: archivo.id,
      publicado_en: sql`now()`,
      vigente_desde: '2000-01-01',
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/**
 * Plan publicado: matrícula (S/ 300, exigible desde 2025-01-01) y 10 pensiones de S/ 450 desde marzo de 2025
 * (fechas pasadas para que las cuotas ya sean exigibles al pagar).
 */
export async function crearPlanPublicado(actor: Actor, opciones: { anioId: string; gradoId: string; pension?: string; ingreso?: string }) {
  const pension = opciones.pension ?? '450.00';
  const plan = await planes.crearPlan(actor, { anioId: opciones.anioId, gradoId: opciones.gradoId, pensionReferencia: pension, vigenteDesde: '2025-01-01', condicionesId: undefined });
  await planes.crearTramo(actor, plan.id, { concepto: 'matricula', numero: 1, importe: '300.00', mesServicio: null, exigibleDesde: '2025-01-01', venceEn: '2025-02-28' });
  if (opciones.ingreso) {
    await planes.crearTramo(actor, plan.id, { concepto: 'ingreso', numero: 1, importe: opciones.ingreso, mesServicio: null, exigibleDesde: '2025-01-01', venceEn: '2025-02-28' });
  }
  await planes.generarPensiones(actor, plan.id, { mesInicio: '2025-03', cantidad: 10, importe: pension, diasGracia: 0 });
  await planes.publicarPlan(actor, plan.id);
  return plan;
}

/** Caja + serie propia (REC-XXXX aleatoria) + sesión abierta del actor. */
export async function prepararCaja(actor: Actor, opciones: { saldoInicial?: string; abrir?: boolean } = {}) {
  const c = await caja.crearCaja(actor, { nombre: `Caja prueba ${sufijo()}`, activa: true });
  const codigo = `REC-${sufijo().toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
  const serie = await caja.crearSerie(actor, { codigo, numeroInicial: 1, activa: true });
  const sesion = opciones.abrir === false ? null : await caja.abrirSesion(actor, { cajaId: c.id, saldoInicial: opciones.saldoInicial ?? '100.00' });
  return { cajaId: c.id, serieId: serie.id, codigo, sesionId: sesion?.id ?? null };
}

/** Otra matrícula activa en la misma sección (reutiliza la regla publicada del año/grado). */
export async function agregarMatricula(opciones: { anioId: string; gradoId: string; seccionId: string; inicio: string; fin: string; registradoPor: string }) {
  const { estudianteId } = await crearEstudiante();
  const regla = await db()
    .selectFrom('reglas_matricula')
    .select('id')
    .where('anio_id', '=', opciones.anioId)
    .where('grado_id', '=', opciones.gradoId)
    .where('tipo_ingreso', '=', 'nuevo')
    .executeTakeFirstOrThrow();
  const m = await db()
    .insertInto('matriculas')
    .values({
      estudiante_id: estudianteId,
      anio_id: opciones.anioId,
      grado_id: opciones.gradoId,
      regla_id: regla.id,
      tipo_ingreso: 'nuevo',
      estado: 'activa',
      confirmada_en: sql`now()`,
      registrado_por: opciones.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  await db()
    .insertInto('matricula_secciones')
    .values({
      matricula_id: m.id,
      seccion_id: opciones.seccionId,
      anio_id: opciones.anioId,
      grado_id: opciones.gradoId,
      vigencia: `[${opciones.inicio},${opciones.fin}]`,
      registrado_por: opciones.registradoPor,
    })
    .execute();
  return { matriculaId: m.id, estudianteId };
}

/** Escenario completo: admin, año, condiciones, plan publicado, matrícula activa y caja abierta. */
export async function escenarioCobros(opciones: { ingreso?: string; abrirCaja?: boolean } = {}) {
  const admin = await crearAdmin();
  const anio = await crearAnio();
  const grado = await gradoId('primaria', 1);
  await crearCondiciones(anio.anioId);
  const plan = await crearPlanPublicado(admin.actor, { anioId: anio.anioId, gradoId: grado, ingreso: opciones.ingreso });
  const matricula = await crearMatriculaActiva({ registradoPor: admin.usuarioId, anio, nivel: 'primaria', grado: 1 });
  const cajaPrueba = await prepararCaja(admin.actor, { abrir: opciones.abrirCaja });
  return { admin, anio, gradoId: grado, plan, matricula, caja: cajaPrueba };
}
