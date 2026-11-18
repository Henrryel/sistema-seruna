import 'server-only';
import { transaccion } from '@/server/db';
import { aErrorDominio, ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as ctx from '@/server/repositories/evaluacion/contexto';
import * as repo from '@/server/repositories/evaluacion/cierre-anual';
import { evaluarCriterios, leerCriterios, type EvaluacionCriterios, type ResultadoParaCriterio } from '@/esquemas/evaluacion/criterios';
import type { Actor } from '@/server/auth/actor';
import type { NivelLogro } from '@/esquemas/comunes';
import type { AprobarCierre, DetalleCierreAnual, Etapa, ResultadoGeneracion } from '@/esquemas/evaluacion/cierre-anual';
import type { ResultadoLote } from '@/esquemas/evaluacion/cierres';

// Cierre anual por matrícula. La base valida (controlar_cierre_anual / controlar_resultado_anual) la regla
// aprobada, la fecha de corte (fin del 4.º bimestre), la sección y el plan al corte, los bimestres publicados,
// la completitud de resultados, la coherencia con los últimos logros publicados y la trayectoria de versiones.
// La base NO decide la situación final: la app la SUGIERE aplicando los criterios de la regla aprobada.

type Cierre = NonNullable<Awaited<ReturnType<typeof repo.obtenerCierreAnual>>>;

async function exigirCierre(id: string): Promise<Cierre> {
  const c = await repo.obtenerCierreAnual(id);
  if (!c) throw new NotFoundError('El cierre anual no existe');
  return c;
}

function criteriosDe(valor: unknown) {
  const r = leerCriterios(valor);
  if (!r.ok) throw new ValidationError(`Los criterios de la regla no cumplen el esquema: ${r.error}`);
  return r.criterios;
}

/**
 * Reconstruye los resultados del borrador desde su fuente (últimos logros publicados o, en la etapa de
 * recuperación, las evaluaciones aprobadas / el resultado anterior) y fija la situación sugerida.
 * `pendientesForzados` reemplaza las competencias marcadas como pendientes (solo etapas lectivas).
 */
async function sincronizarResultados(
  cierre: { id: string; matricula_id: string; plan_id: string; etapa: string; anterior_id: string | null },
  criteriosJson: unknown,
  pendientesForzados?: Set<string>,
): Promise<EvaluacionCriterios> {
  const criterios = criteriosDe(criteriosJson);
  const competencias = await ctx.competenciasDePlan(cierre.plan_id);
  const area = new Map(competencias.map((k) => [k.id, k.area_codigo ?? k.area ?? null]));
  await repo.borrarResultados(cierre.id);

  type Fila = Parameters<typeof repo.insertarResultado>[0];
  const filas: Omit<Fila, 'requiereRecuperacion'>[] = [];
  const requiereFijo = new Map<string, boolean>();

  if (cierre.etapa !== 'recuperacion') {
    const logros = new Map((await repo.ultimosLogros(cierre.matricula_id)).map((l) => [l.competencia_id, l]));
    for (const k of competencias) {
      const l = logros.get(k.id);
      if (!l?.calificacion_id || !l.nivel_logro) continue; // sin logro publicado: la base reportará el faltante
      filas.push({ cierreId: cierre.id, planId: cierre.plan_id, competenciaId: k.id, nivel: l.nivel_logro, conclusion: l.conclusion, calificacionId: l.calificacion_id });
    }
  } else {
    if (!cierre.anterior_id) throw new ValidationError('La etapa de recuperación requiere el cierre anterior');
    const anteriores = await repo.resultadosDe(cierre.anterior_id);
    const recuperadas = new Map((await repo.recuperacionesAprobadas(cierre.anterior_id)).map((e) => [e.resultado_origen_id, e]));
    for (const r of anteriores) {
      const rec = r.requiere_recuperacion ? recuperadas.get(r.id) : undefined;
      if (rec) {
        filas.push({ cierreId: cierre.id, planId: cierre.plan_id, competenciaId: r.competencia_id, nivel: rec.nivel_logro, conclusion: rec.conclusion, recuperacionId: rec.id });
        requiereFijo.set(r.competencia_id, false);
      } else {
        // Sin evaluación aprobada la competencia sigue pendiente (la base no permite resolverla de otro modo).
        filas.push({ cierreId: cierre.id, planId: cierre.plan_id, competenciaId: r.competencia_id, nivel: r.nivel_logro, conclusion: r.conclusion, resultadoAnteriorId: r.id });
        requiereFijo.set(r.competencia_id, r.requiere_recuperacion);
      }
    }
  }

  const evaluacion = evaluarCriterios(
    criterios,
    filas.map((f): ResultadoParaCriterio => ({ competenciaId: f.competenciaId, areaCodigo: area.get(f.competenciaId) ?? null, nivel: f.nivel as NivelLogro })),
    { etapa: cierre.etapa as Etapa },
  );
  const pendientes = pendientesForzados ?? new Set(evaluacion.pendientes);
  for (const f of filas) {
    const requiere = cierre.etapa === 'recuperacion' ? (requiereFijo.get(f.competenciaId) ?? false) : pendientes.has(f.competenciaId);
    await repo.insertarResultado({ ...f, requiereRecuperacion: requiere });
  }
  await repo.fijarSituacion(cierre.id, evaluacion.situacion);
  return evaluacion;
}

export const listarCierresAnuales = repo.listarCierresAnuales;

export async function detalleCierreAnual(id: string): Promise<DetalleCierreAnual> {
  const c = await exigirCierre(id);
  const [resultados, competencias, tray] = await Promise.all([repo.resultadosDe(id), ctx.competenciasDePlan(c.plan_id), repo.trayectoria(c.matricula_id)]);
  const conResultado = new Set(resultados.map((r) => r.competencia_id));
  const lectura = leerCriterios(c.criterios);
  const sugerencia: DetalleCierreAnual['sugerencia'] = lectura.ok
    ? evaluarCriterios(
        lectura.criterios,
        resultados.map((r) => ({ competenciaId: r.competencia_id, areaCodigo: r.area_codigo ?? r.area ?? null, nivel: r.nivel_logro as NivelLogro })),
        { etapa: c.etapa as Etapa },
      )
    : { error: lectura.error };
  const recuperaciones = c.estado === 'aprobado' ? await repo.recuperacionesAprobadas(id) : [];
  return {
    id: c.id,
    matricula_id: c.matricula_id,
    estudiante_id: c.estudiante_id,
    codigo: c.codigo,
    alumno: c.alumno,
    seccion: c.seccion,
    grado: c.grado,
    nivel: c.nivel,
    version: c.version,
    etapa: c.etapa as Etapa,
    estado: c.estado as 'borrador' | 'aprobado',
    situacion: c.situacion as DetalleCierreAnual['situacion'],
    fecha_corte: c.fecha_corte,
    aprobado_en: c.aprobado_en ? c.aprobado_en.toISOString() : null,
    resultados: resultados.length,
    pendientes: resultados.filter((r) => r.requiere_recuperacion).length,
    versiones: Number(c.versiones ?? 0),
    regla: { id: c.regla_id, version: c.regla_version, referencia: c.referencia_normativa },
    sustento: c.sustento,
    motivo_revision: c.motivo_revision,
    anterior_id: c.anterior_id,
    resultados_detalle: resultados.map((r) => ({
      id: r.id,
      competencia_id: r.competencia_id,
      competencia: r.competencia,
      codigo: r.codigo,
      area: r.area,
      area_codigo: r.area_codigo,
      nivel_logro: r.nivel_logro,
      conclusion: r.conclusion,
      requiere_recuperacion: r.requiere_recuperacion,
      fuente: r.calificacion_id ? 'calificacion' : r.recuperacion_id ? 'recuperacion' : 'anterior',
      bimestre: r.bimestre ?? null,
    })),
    faltantes: competencias.filter((k) => !conResultado.has(k.id)).map((k) => ({ competencia_id: k.id, competencia: `${k.codigo} · ${k.nombre}`, area: k.area })),
    sugerencia,
    trayectoria: tray.map((t) => ({ ...t, etapa: t.etapa as Etapa, aprobado_en: t.aprobado_en ? t.aprobado_en.toISOString() : null })),
    recuperacionesAprobadas: recuperaciones.length,
  };
}

/** Genera los borradores ordinarios (versión 1) de las matrículas ubicadas al corte que aún no tienen cierre. */
export async function generarBorradores(actor: Actor, datos: { anioId: string; seccionId?: string }): Promise<ResultadoGeneracion> {
  const fechaCorte = await ctx.finCuartoBimestre(datos.anioId);
  if (!fechaCorte) throw new ValidationError('Configure los cuatro bimestres, la sección y el plan al cierre del cuarto bimestre');
  const candidatos = await repo.candidatosCierre(datos.anioId, fechaCorte, datos.seccionId);
  const resultado: ResultadoGeneracion = { creados: 0, omitidos: [] };
  const planes = new Map<string, string | null>();
  const reglas = new Map<string, Awaited<ReturnType<typeof ctx.reglaAprobadaVigente>> | null>();
  for (const m of candidatos) {
    if (!planes.has(m.seccion_id)) planes.set(m.seccion_id, await ctx.planDeSeccionEn(m.seccion_id, fechaCorte));
    if (!reglas.has(m.grado_id)) reglas.set(m.grado_id, (await ctx.reglaAprobadaVigente(datos.anioId, m.grado_id)) ?? null);
    const planId = planes.get(m.seccion_id);
    const regla = reglas.get(m.grado_id);
    if (!regla) {
      resultado.omitidos.push({ matriculaId: m.matricula_id, alumno: m.alumno, motivo: 'No hay una regla de evaluación aprobada para el grado' });
      continue;
    }
    if (!planId) {
      resultado.omitidos.push({ matriculaId: m.matricula_id, alumno: m.alumno, motivo: 'La sección no tiene plan de estudios vigente al corte' });
      continue;
    }
    try {
      await transaccion(async () => {
        const nuevo = await repo.insertarCierreAnual({
          matriculaId: m.matricula_id,
          anioId: m.anio_id,
          gradoId: m.grado_id,
          seccionId: m.seccion_id,
          planId,
          reglaId: regla.id,
          version: 1,
          etapa: 'ordinario',
          anteriorId: null,
          fechaCorte,
          motivoRevision: null,
          registradoPor: actor.usuarioId,
        });
        await sincronizarResultados({ id: nuevo.id, matricula_id: m.matricula_id, plan_id: planId, etapa: 'ordinario', anterior_id: null }, regla.criterios);
        await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'cierres_anuales', registroId: nuevo.id, resultado: 'ok' });
      });
      resultado.creados++;
    } catch (e) {
      resultado.omitidos.push({ matriculaId: m.matricula_id, alumno: m.alumno, motivo: aErrorDominio(e).message });
    }
  }
  return resultado;
}

/** Vuelve a tomar los resultados desde su fuente (p. ej. tras rectificar notas publicadas). Solo en borrador. */
export async function actualizarBorrador(actor: Actor, id: string) {
  const c = await exigirCierre(id);
  return transaccion(async () => {
    // Si el cierre está aprobado, la base rechaza el reemplazo de resultados (controlar_resultado_anual).
    const evaluacion = await sincronizarResultados(c, c.criterios);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'cierres_anuales', registroId: id, resultado: 'ok' });
    return evaluacion;
  });
}

export async function aprobarCierreAnual(actor: Actor, id: string, datos: AprobarCierre) {
  const c = await exigirCierre(id);
  return transaccion(async () => {
    if (c.estado === 'borrador' && c.etapa !== 'recuperacion') {
      let forzados: Set<string> | undefined = datos.pendientes ? new Set(datos.pendientes) : undefined;
      if (!forzados) {
        const actuales = await repo.resultadosDe(id);
        const marcadas = actuales.filter((r) => r.requiere_recuperacion);
        if (datos.situacion === 'recuperacion' && !marcadas.length) {
          // La situación elegida difiere de la sugerida: se marcan los niveles pendientes según la regla.
          const niveles = criteriosDe(c.criterios).recuperacion.nivelesPendientes as string[];
          forzados = new Set(actuales.filter((r) => niveles.includes(r.nivel_logro)).map((r) => r.competencia_id));
        } else if (datos.situacion !== 'recuperacion' && marcadas.length) {
          forzados = new Set();
        }
      }
      if (forzados) await sincronizarResultados(c, c.criterios, forzados);
    }
    // La base verifica todo lo demás y audita la aprobación (auditar_cierre_anual).
    const r = await repo.aprobarCierreAnual(id, actor.usuarioId, datos.situacion, datos.sustento);
    if (!r) throw new NotFoundError('El cierre anual no existe');
    return r;
  });
}

/** Aprueba varios borradores con la situación sugerida por la regla. */
export async function aprobarLote(actor: Actor, datos: { ids: string[]; sustento: string }): Promise<ResultadoLote[]> {
  const salida: ResultadoLote[] = [];
  for (const id of datos.ids) {
    try {
      const d = await detalleCierreAnual(id);
      if ('error' in d.sugerencia && d.sugerencia.error) throw new ValidationError(d.sugerencia.error);
      const sugerencia = d.sugerencia as EvaluacionCriterios;
      await aprobarCierreAnual(actor, id, { situacion: sugerencia.situacion, sustento: datos.sustento });
      salida.push({ id, ok: true, mensaje: `Aprobado: ${sugerencia.situacion}` });
    } catch (e) {
      salida.push({ id, ok: false, mensaje: aErrorDominio(e).message });
    }
  }
  return salida;
}

/** Nueva versión (rectificación o recuperación) a partir del último cierre aprobado de la matrícula. */
export async function nuevaVersion(actor: Actor, id: string, datos: { etapa: 'rectificacion' | 'recuperacion'; motivo: string }) {
  const anterior = await exigirCierre(id);
  if (!anterior.es_ultimo) throw new ConflictError('Solo se puede versionar el último cierre de la matrícula');
  const regla = await ctx.reglaAprobadaVigente(anterior.anio_id, anterior.grado_id);
  if (!regla) throw new ValidationError('Se requiere una regla de evaluación aprobada');
  const planId =
    datos.etapa === 'recuperacion' ? anterior.plan_id : ((await ctx.planDeSeccionEn(anterior.seccion_id, anterior.fecha_corte)) ?? anterior.plan_id);
  return transaccion(async () => {
    const nuevo = await repo.insertarCierreAnual({
      matriculaId: anterior.matricula_id,
      anioId: anterior.anio_id,
      gradoId: anterior.grado_id,
      seccionId: anterior.seccion_id,
      planId,
      reglaId: regla.id,
      version: anterior.version + 1,
      etapa: datos.etapa,
      anteriorId: anterior.id,
      fechaCorte: anterior.fecha_corte,
      motivoRevision: datos.motivo,
      registradoPor: actor.usuarioId,
    });
    const evaluacion = await sincronizarResultados(
      { id: nuevo.id, matricula_id: anterior.matricula_id, plan_id: planId, etapa: datos.etapa, anterior_id: anterior.id },
      regla.criterios,
    );
    await registrarBitacora({ actorId: actor.usuarioId, accion: datos.etapa, entidad: 'cierres_anuales', registroId: nuevo.id, motivo: datos.motivo, resultado: 'ok' });
    return { id: nuevo.id, situacionSugerida: evaluacion.situacion };
  });
}

export async function descartarBorrador(actor: Actor, id: string) {
  await exigirCierre(id);
  return transaccion(async () => {
    // Un cierre aprobado no se borra: lo impiden controlar_resultado_anual y controlar_cierre_anual.
    await repo.borrarResultados(id);
    await repo.eliminarCierreAnual(id);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'cierres_anuales', registroId: id, resultado: 'ok' });
    return { ok: true };
  });
}
