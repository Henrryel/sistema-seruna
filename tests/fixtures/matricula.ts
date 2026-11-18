// Fixtures del módulo de matrícula. Usar SIEMPRE dentro de enPrueba() (todo se revierte).
import { db, sql } from '@/server/db';
import { crearAdmin, crearAnio, crearEstudiante, crearPersona, crearSeccion, gradoId, sufijo } from './base';

/** Escenario: admin, año con 4 bimestres, grado (1.º primaria por defecto), sección(es) y regla publicada. */
export async function escenarioMatricula(opciones: { cupo?: number; reserva?: number; secciones?: number; nivel?: 'primaria' | 'secundaria'; grado?: number } = {}) {
  const admin = await crearAdmin();
  const anio = await crearAnio();
  const grado = await gradoId(opciones.nivel ?? 'primaria', opciones.grado ?? 1);
  const secciones: string[] = [];
  for (let i = 0; i < (opciones.secciones ?? 1); i++) {
    const s = await crearSeccion(anio.anioId, grado, { nombre: String.fromCharCode(65 + i), cupo: opciones.cupo ?? 30, reserva: opciones.reserva ?? 2 });
    secciones.push(s.id);
  }
  const regla = await crearRegla({ anioId: anio.anioId, gradoId: grado });
  return { admin, actor: admin.actor, anio, gradoId: grado, secciones, seccionId: secciones[0] as string, reglaId: regla.id };
}

/** Regla de matrícula (publicada por defecto) con ventana amplia. */
export async function crearRegla(o: {
  anioId: string;
  gradoId: string;
  tipoIngreso?: 'nuevo' | 'continuidad' | 'traslado';
  version?: number;
  publicada?: boolean;
  inicio?: string;
  fin?: string;
  corteEdad?: string | null;
  edadMinima?: number | null;
  edadMaxima?: number | null;
}) {
  return db()
    .insertInto('reglas_matricula')
    .values({
      anio_id: o.anioId,
      grado_id: o.gradoId,
      tipo_ingreso: o.tipoIngreso ?? 'nuevo',
      version: o.version ?? 1,
      solicitudes_inicio: o.inicio ?? '2000-01-01',
      solicitudes_fin: o.fin ?? '2200-12-31',
      corte_edad: o.corteEdad ?? null,
      edad_minima: o.edadMinima ?? null,
      edad_maxima: o.edadMaxima ?? null,
      publicada_en: o.publicada === false ? null : sql`now()`,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Estudiante con fecha de nacimiento (para reglas de edad). */
export async function crearEstudianteConEdad(fechaNacimiento: string) {
  const p = await crearPersona({ fechaNacimiento });
  return crearEstudiante({ personaId: p.id });
}

export async function crearTipoDocumento(nombre = 'Partida de nacimiento') {
  return db().insertInto('tipos_documento').values({ codigo: `TD_${sufijo()}`.toUpperCase(), nombre }).returning(['id']).executeTakeFirstOrThrow();
}

/** Archivo en memoria con el formato que entrega `archivoDeFormulario`. */
export function archivoPrueba(nombre = 'evidencia.pdf', tipoMime = 'application/pdf') {
  return { contenido: Buffer.from(`%PDF-1.4\n% prueba ${sufijo()}\n`), nombreOriginal: nombre, tipoMime };
}

export async function movimientosDe(matriculaId: string) {
  return db().selectFrom('movimientos_matricula').select(['tipo', 'fecha_efectiva', 'motivo', 'evidencia_id']).where('matricula_id', '=', matriculaId).orderBy('id').execute();
}

export async function ubicacionesDe(matriculaId: string) {
  return db()
    .selectFrom('matricula_secciones')
    .select(['seccion_id', 'tipo_vacante', sql<string>`lower(vigencia)`.as('desde'), sql<string>`upper(vigencia) - 1`.as('hasta')])
    .where('matricula_id', '=', matriculaId)
    .orderBy(sql`lower(vigencia)`)
    .execute();
}
