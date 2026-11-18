/**
 * Semillas de DEMOSTRACIÓN (opcionales). NO modifican el esquema: solo insertan datos respetando
 * todos los CHECK, EXCLUDE y triggers de la base. Idempotentes y bloqueadas en producción.
 *
 *   npm run demo:sembrar -- --confirmar
 *
 * Crea (marcado con el prefijo DEMO): catálogo CNEB, año actual con 4 bimestres y calendario, 2 secciones,
 * planes y horarios, 1 admin, 2 docentes (fijo y por horas), 5 alumnos, 3 apoderados, matrículas, plan de
 * cobro, cuotas, pagos con recibo, asistencias variadas (presente, tarde, ausente, justificada),
 * calificaciones publicadas de los bimestres terminados y horas docentes.
 *
 * Cuentas demo: logins demo.* con la contraseña CONTRASENA_DEMO (solo para bases de prueba).
 */
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { db, kysely, sql, transaccion } from '@/server/db';
import { hashContrasena } from '@/server/auth/contrasenas';
import { guardarArchivo } from '@/server/almacenamiento';

export const CONTRASENA_DEMO = 'Demo2026!';

// ---------------------------------------------------------------- Catálogo CNEB
// Competencias del Currículo Nacional de la Educación Básica (verificar redacción y códigos contra el
// Programa Curricular vigente antes de usarlo en producción).
const AREAS: [string, string][] = [
  ['PS', 'Personal Social'],
  ['DPCC', 'Desarrollo Personal, Ciudadanía y Cívica'],
  ['CCSS', 'Ciencias Sociales'],
  ['EF', 'Educación Física'],
  ['AC', 'Arte y Cultura'],
  ['COM', 'Comunicación'],
  ['CSL', 'Castellano como Segunda Lengua'],
  ['ING', 'Inglés como Lengua Extranjera'],
  ['CYT', 'Ciencia y Tecnología'],
  ['MAT', 'Matemática'],
  ['EPT', 'Educación para el Trabajo'],
  ['ER', 'Educación Religiosa'],
];

const COMPETENCIAS: [string, string | null, string][] = [
  ['C01', 'PS', 'Construye su identidad'],
  ['C02', 'EF', 'Se desenvuelve de manera autónoma a través de su motricidad'],
  ['C03', 'EF', 'Asume una vida saludable'],
  ['C04', 'EF', 'Interactúa a través de sus habilidades sociomotrices'],
  ['C05', 'AC', 'Aprecia de manera crítica manifestaciones artístico-culturales'],
  ['C06', 'AC', 'Crea proyectos desde los lenguajes artísticos'],
  ['C07', 'COM', 'Se comunica oralmente en su lengua materna'],
  ['C08', 'COM', 'Lee diversos tipos de textos escritos en su lengua materna'],
  ['C09', 'COM', 'Escribe diversos tipos de textos en su lengua materna'],
  ['C10', 'CSL', 'Se comunica oralmente en castellano como segunda lengua'],
  ['C11', 'CSL', 'Lee diversos tipos de textos escritos en castellano como segunda lengua'],
  ['C12', 'CSL', 'Escribe diversos tipos de textos en castellano como segunda lengua'],
  ['C13', 'ING', 'Se comunica oralmente en inglés como lengua extranjera'],
  ['C14', 'ING', 'Lee diversos tipos de textos escritos en inglés como lengua extranjera'],
  ['C15', 'ING', 'Escribe diversos tipos de textos en inglés como lengua extranjera'],
  ['C16', 'PS', 'Convive y participa democráticamente en la búsqueda del bien común'],
  ['C17', 'PS', 'Construye interpretaciones históricas'],
  ['C18', 'PS', 'Gestiona responsablemente el espacio y el ambiente'],
  ['C19', 'PS', 'Gestiona responsablemente los recursos económicos'],
  ['C20', 'CYT', 'Indaga mediante métodos científicos para construir sus conocimientos'],
  ['C21', 'CYT', 'Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo'],
  ['C22', 'CYT', 'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno'],
  ['C23', 'MAT', 'Resuelve problemas de cantidad'],
  ['C24', 'MAT', 'Resuelve problemas de regularidad, equivalencia y cambio'],
  ['C25', 'MAT', 'Resuelve problemas de forma, movimiento y localización'],
  ['C26', 'MAT', 'Resuelve problemas de gestión de datos e incertidumbre'],
  ['C27', 'EPT', 'Gestiona proyectos de emprendimiento económico o social'],
  ['C28', null, 'Se desenvuelve en entornos virtuales generados por las TIC'],
  ['C29', null, 'Gestiona su aprendizaje de manera autónoma'],
  ['C30', 'ER', 'Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente'],
  ['C31', 'ER', 'Asume la experiencia del encuentro personal y comunitario con Dios'],
];

const CAPACIDADES_C23 = [
  'Traduce cantidades a expresiones numéricas',
  'Comunica su comprensión sobre los números y las operaciones',
  'Usa estrategias y procedimientos de estimación y cálculo',
  'Argumenta afirmaciones sobre las relaciones numéricas y las operaciones',
];

const TIPOS_DOCUMENTO: [string, string][] = [
  ['DNI_COPIA', 'Copia de DNI del estudiante'],
  ['PARTIDA', 'Partida o acta de nacimiento'],
  ['CERT_ESTUDIOS', 'Certificado de estudios'],
  ['FICHA_UNICA', 'Ficha única de matrícula'],
  ['RESOL_TRASLADO', 'Resolución de traslado'],
];

async function sembrarCatalogo() {
  for (const [codigo, nombre] of AREAS) {
    await db().insertInto('areas_curriculares').values({ codigo, nombre }).onConflict((oc) => oc.column('codigo').doNothing()).execute();
  }
  const areas = new Map((await db().selectFrom('areas_curriculares').select(['id', 'codigo']).execute()).map((a) => [a.codigo, a.id]));
  for (const [codigo, area, nombre] of COMPETENCIAS) {
    await db()
      .insertInto('competencias')
      .values({ codigo, nombre, version: 1, area_id: area ? (areas.get(area) ?? null) : null, reportable_siagie: true })
      .onConflict((oc) => oc.columns(['codigo', 'version']).doNothing())
      .execute();
  }
  const c23 = await db().selectFrom('competencias').select('id').where('codigo', '=', 'C23').where('version', '=', 1).executeTakeFirstOrThrow();
  for (const [i, nombre] of CAPACIDADES_C23.entries()) {
    await db()
      .insertInto('capacidades')
      .values({ competencia_id: c23.id, codigo: `C23.${i + 1}`, nombre })
      .onConflict((oc) => oc.columns(['competencia_id', 'codigo']).doNothing())
      .execute();
  }
  for (const [codigo, nombre] of TIPOS_DOCUMENTO) {
    await db().insertInto('tipos_documento').values({ codigo, nombre }).onConflict((oc) => oc.column('codigo').doNothing()).execute();
  }
}

// ---------------------------------------------------------------- Utilidades de fechas (America/Lima)
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const sumar = (f: string, d: number) => {
  const x = new Date(`${f}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};
const diaIso = (f: string) => ((new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
/** Instante en Lima (UTC−5, sin horario de verano). */
const enLima = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);

function diasLectivos(desde: string, hasta: string) {
  const r: string[] = [];
  for (let f = desde; f <= hasta; f = sumar(f, 1)) if (diaIso(f) <= 5) r.push(f);
  return r;
}

// PDF mínimo válido para los documentos institucionales de demostración.
const PDF_DEMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

// ---------------------------------------------------------------- Semilla principal
async function sembrarDemo() {
  const anio = Number(hoy.slice(0, 4));
  if (await db().selectFrom('estudiantes').select('id').where('codigo', '=', 'DEMO-E01').executeTakeFirst()) {
    console.log('Los datos de demostración ya existen (DEMO-E01). Nada que hacer.');
    return;
  }
  const otras = await db()
    .selectFrom('matriculas as m')
    .innerJoin('anios_academicos as a', 'a.id', 'm.anio_id')
    .select('m.id')
    .where('a.anio', '=', anio)
    .executeTakeFirst();
  if (otras) throw new Error(`El año ${anio} ya tiene matrículas reales: no se siembran datos de demostración encima.`);

  const hash = await hashContrasena(CONTRASENA_DEMO);
  const rol = new Map((await db().selectFrom('roles').select(['id', 'codigo']).execute()).map((r) => [r.codigo, r.id]));

  async function persona(nombres: string, apellidos: string, dni: string, nacimiento?: string) {
    const p = await db().insertInto('personas').values({ nombres, apellidos, fecha_nacimiento: nacimiento ?? null }).returning('id').executeTakeFirstOrThrow();
    await db().insertInto('documentos_identidad').values({ persona_id: p.id, tipo: 'DNI', pais_emisor: 'PE', numero: dni }).execute();
    return p.id;
  }
  async function usuario(personaId: string, login: string, roles: string[]) {
    const previo = await db().selectFrom('usuarios').select('id').where('login', '=', login).executeTakeFirst();
    const u = previo
      ? await db().updateTable('usuarios').set({ contrasena_hash: hash, estado: 'activo' }).where('id', '=', previo.id).returning('id').executeTakeFirstOrThrow()
      : await db().insertInto('usuarios').values({ persona_id: personaId, login, contrasena_hash: hash, estado: 'activo' }).returning('id').executeTakeFirstOrThrow();
    for (const r of roles) {
      await db().insertInto('usuario_roles').values({ usuario_id: u.id, rol_id: rol.get(r)! }).onConflict((oc) => oc.columns(['usuario_id', 'rol_id']).doNothing()).execute();
    }
    return u.id;
  }

  // Administrador (reutiliza demo.admin si ya fue creado con npm run admin:crear)
  const adminPrevio = await db().selectFrom('usuarios').select(['id', 'persona_id']).where('login', '=', 'demo.admin').executeTakeFirst();
  const adminPersona = adminPrevio?.persona_id ?? (await persona('Rosa', 'Quispe Demo', '70000001'));
  const admin = await usuario(adminPersona, 'demo.admin', ['admin']);

  // Año, bimestres y calendario
  const inicio = `${anio}-03-02`;
  const fin = `${anio}-12-18`;
  let anioId = (await db().selectFrom('anios_academicos').select('id').where('anio', '=', anio).executeTakeFirst())?.id;
  if (!anioId) {
    anioId = (await db().insertInto('anios_academicos').values({ anio, inicio, fin, estado: 'abierto' }).returning('id').executeTakeFirstOrThrow()).id;
  }
  const anioFila = await db().selectFrom('anios_academicos').select(['inicio', 'fin']).where('id', '=', anioId).executeTakeFirstOrThrow();
  const rangos: [string, string][] = [
    [anioFila.inicio, `${anio}-05-08`],
    [`${anio}-05-18`, `${anio}-07-17`],
    [`${anio}-08-03`, `${anio}-10-09`],
    [`${anio}-10-19`, anioFila.fin],
  ];
  for (const [i, [bi, bf]] of rangos.entries()) {
    await db().insertInto('bimestres').values({ anio_id: anioId, numero: i + 1, inicio: bi, fin: bf }).onConflict((oc) => oc.columns(['anio_id', 'numero']).doNothing()).execute();
  }
  const bimestres = await db().selectFrom('bimestres').select(['id', 'numero', 'inicio', 'fin']).where('anio_id', '=', anioId).orderBy('numero').execute();
  for (const f of diasLectivos(anioFila.inicio, anioFila.fin)) {
    await db().insertInto('calendario_escolar').values({ anio_id: anioId, fecha: f, tipo: 'lectivo' }).onConflict((oc) => oc.columns(['anio_id', 'fecha']).doNothing()).execute();
  }
  const vigenciaAnio = `[${anioFila.inicio},${anioFila.fin}]`;

  // Aulas y secciones
  const aula1 = (await db().insertInto('aulas').values({ codigo: 'DEMO-A1', nombre: 'Aula 1 (demo)', capacidad: 30 }).returning('id').executeTakeFirstOrThrow()).id;
  const aula2 = (await db().insertInto('aulas').values({ codigo: 'DEMO-A2', nombre: 'Aula 2 (demo)', capacidad: 30 }).returning('id').executeTakeFirstOrThrow()).id;
  const grado = async (nivel: string, numero: number) =>
    (await db().selectFrom('grados as g').innerJoin('niveles as n', 'n.id', 'g.nivel_id').select('g.id').where('n.codigo', '=', nivel).where('g.numero', '=', numero).executeTakeFirstOrThrow()).id;
  const gPri = await grado('primaria', 1);
  const gSec = await grado('secundaria', 1);
  const secPri = (await db().insertInto('secciones').values({ anio_id: anioId, grado_id: gPri, nombre: 'DEMO', turno: 'Mañana', cupo: 25, reserva: 2 }).returning('id').executeTakeFirstOrThrow()).id;
  const secSec = (await db().insertInto('secciones').values({ anio_id: anioId, grado_id: gSec, nombre: 'DEMO', turno: 'Mañana', cupo: 25, reserva: 2 }).returning('id').executeTakeFirstOrThrow()).id;

  // Docentes
  const d1Persona = await persona('Carlos', 'Mendoza Demo', '70000011');
  const d2Persona = await persona('Lucía', 'Huamán Demo', '70000012');
  const d1User = await usuario(d1Persona, 'demo.docente1', ['docente']);
  const d2User = await usuario(d2Persona, 'demo.docente2', ['docente']);
  const d1 = (await db().insertInto('docentes').values({ persona_id: d1Persona, codigo: 'DEMO-D01' }).returning('id').executeTakeFirstOrThrow()).id;
  const d2 = (await db().insertInto('docentes').values({ persona_id: d2Persona, codigo: 'DEMO-D02' }).returning('id').executeTakeFirstOrThrow()).id;

  // Currículo: asignaturas y planes publicados
  const comp = new Map((await db().selectFrom('competencias').select(['id', 'codigo']).where('version', '=', 1).execute()).map((c) => [c.codigo, c.id]));
  const areas = new Map((await db().selectFrom('areas_curriculares').select(['id', 'codigo']).execute()).map((a) => [a.codigo, a.id]));
  async function asignatura(codigo: string, nombre: string, area: string) {
    const previa = await db().selectFrom('asignaturas').select('id').where('codigo', '=', codigo).executeTakeFirst();
    return previa?.id ?? (await db().insertInto('asignaturas').values({ codigo, nombre, area_id: areas.get(area) ?? null }).returning('id').executeTakeFirstOrThrow()).id;
  }
  const aCom = await asignatura('DEMO-COM', 'Comunicación', 'COM');
  const aMat = await asignatura('DEMO-MAT', 'Matemática', 'MAT');
  const aPs = await asignatura('DEMO-PS', 'Personal Social', 'PS');
  const MAPA: Record<string, string[]> = { [aCom]: ['C07', 'C08', 'C09'], [aMat]: ['C23', 'C24', 'C25', 'C26'], [aPs]: ['C01', 'C16'] };

  async function plan(gradoId: string, asignaturas: string[]) {
    const p = (await db().insertInto('planes_estudio').values({ anio_id: anioId!, grado_id: gradoId, version: 1, publicado_en: sql`now()` }).returning('id').executeTakeFirstOrThrow()).id;
    for (const a of asignaturas) {
      await db().insertInto('plan_asignaturas').values({ plan_id: p, asignatura_id: a }).execute();
      for (const c of MAPA[a] ?? []) {
        const cid = comp.get(c)!;
        await db().insertInto('plan_competencias').values({ plan_id: p, competencia_id: cid }).onConflict((oc) => oc.columns(['plan_id', 'competencia_id']).doNothing()).execute();
        await db().insertInto('asignatura_competencias').values({ plan_id: p, asignatura_id: a, competencia_id: cid }).execute();
      }
    }
    return p;
  }
  const planPri = await plan(gPri, [aCom, aMat, aPs]);
  const planSec = await plan(gSec, [aCom, aMat]);

  async function cursos(seccionId: string, gradoId: string, planId: string, asignaturas: string[]) {
    const sp = (await db().insertInto('seccion_planes_estudio').values({ seccion_id: seccionId, plan_id: planId, anio_id: anioId!, grado_id: gradoId, vigencia: vigenciaAnio }).returning('id').executeTakeFirstOrThrow()).id;
    const r: Record<string, string> = {};
    for (const a of asignaturas) {
      r[a] = (await db().insertInto('cursos_seccion').values({ seccion_plan_id: sp, plan_id: planId, seccion_id: seccionId, asignatura_id: a }).returning('id').executeTakeFirstOrThrow()).id;
    }
    return r;
  }
  const cPri = await cursos(secPri, gPri, planPri, [aCom, aMat, aPs]);
  const cSec = await cursos(secSec, gSec, planSec, [aCom, aMat]);

  // Asignaciones y horario semanal (sin cruces de docente, sección ni aula)
  async function asignar(cursoId: string, docenteId: string) {
    return (await db().insertInto('asignaciones_docentes').values({ curso_id: cursoId, docente_id: docenteId, funcion: 'titular', vigencia: vigenciaAnio }).returning('id').executeTakeFirstOrThrow()).id;
  }
  const bloques: { curso: string; asignacion: string; seccion: string; docente: string; aula: string; dias: number[] }[] = [
    { curso: cPri[aCom]!, asignacion: await asignar(cPri[aCom]!, d1), seccion: secPri, docente: d1, aula: aula1, dias: [2, 4] },
    { curso: cPri[aPs]!, asignacion: await asignar(cPri[aPs]!, d1), seccion: secPri, docente: d1, aula: aula1, dias: [5] },
    { curso: cPri[aMat]!, asignacion: await asignar(cPri[aMat]!, d2), seccion: secPri, docente: d2, aula: aula1, dias: [1, 3] },
    { curso: cSec[aCom]!, asignacion: await asignar(cSec[aCom]!, d1), seccion: secSec, docente: d1, aula: aula2, dias: [1, 3] },
    { curso: cSec[aMat]!, asignacion: await asignar(cSec[aMat]!, d2), seccion: secSec, docente: d2, aula: aula2, dias: [2, 4] },
  ];
  const bloqueIds: { id: string; b: (typeof bloques)[number]; dia: number }[] = [];
  for (const b of bloques) {
    for (const dia of b.dias) {
      const r = await db()
        .insertInto('bloques_horario')
        .values({ curso_id: b.curso, asignacion_id: b.asignacion, seccion_id: b.seccion, docente_id: b.docente, aula_id: b.aula, dia_iso: dia, hora_inicio: '08:00', hora_fin: '09:30', vigencia: vigenciaAnio })
        .returning('id')
        .executeTakeFirstOrThrow();
      bloqueIds.push({ id: r.id, b, dia });
    }
  }

  // Alumnos, apoderados y matrículas
  const alumnos: { codigo: string; nombres: string; apellidos: string; dni: string; nac: string; seccion: string; grado: string }[] = [
    { codigo: 'DEMO-E01', nombres: 'Mateo', apellidos: 'Flores Demo', dni: '80000001', nac: `${anio - 6}-04-12`, seccion: secPri, grado: gPri },
    { codigo: 'DEMO-E02', nombres: 'Valentina', apellidos: 'Flores Demo', dni: '80000002', nac: `${anio - 6}-08-03`, seccion: secPri, grado: gPri },
    { codigo: 'DEMO-E03', nombres: 'Santiago', apellidos: 'Rojas Demo', dni: '80000003', nac: `${anio - 6}-01-25`, seccion: secPri, grado: gPri },
    { codigo: 'DEMO-E04', nombres: 'Camila', apellidos: 'Torres Demo', dni: '80000004', nac: `${anio - 12}-06-30`, seccion: secSec, grado: gSec },
    { codigo: 'DEMO-E05', nombres: 'Diego', apellidos: 'Torres Demo', dni: '80000005', nac: `${anio - 12}-11-09`, seccion: secSec, grado: gSec },
  ];
  const reglas = new Map<string, string>();
  for (const g of [gPri, gSec]) {
    reglas.set(
      g,
      (
        await db()
          .insertInto('reglas_matricula')
          .values({ anio_id: anioId, grado_id: g, tipo_ingreso: 'nuevo', version: 1, solicitudes_inicio: `${anio - 1}-11-01`, solicitudes_fin: `${anio}-03-31`, referencia_normativa: 'Reglamento interno (demo)', publicada_en: sql`now()` })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id,
    );
  }
  const mats: { id: string; ms: string; estudianteId: string; personaId: string; seccion: string; grado: string; usuario: string; nombre: string }[] = [];
  for (const [i, a] of alumnos.entries()) {
    const p = await persona(a.nombres, a.apellidos, a.dni, a.nac);
    const u = await usuario(p, `demo.alumno${i + 1}`, ['alumno']);
    const e = (await db().insertInto('estudiantes').values({ persona_id: p, codigo: a.codigo }).returning('id').executeTakeFirstOrThrow()).id;
    const m = (
      await db()
        .insertInto('matriculas')
        .values({ estudiante_id: e, anio_id: anioId, grado_id: a.grado, regla_id: reglas.get(a.grado)!, tipo_ingreso: 'nuevo', solicitada_en: enLima(`${anio}-02-10`, '09:00'), confirmada_en: enLima(`${anio}-02-15`, '09:00'), estado: 'activa', registrado_por: admin })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await db().insertInto('movimientos_matricula').values({ matricula_id: m, tipo: 'confirmacion', fecha_efectiva: anioFila.inicio, motivo: 'Matrícula de demostración', registrado_por: admin }).execute();
    const ms = (await db().insertInto('matricula_secciones').values({ matricula_id: m, seccion_id: a.seccion, anio_id: anioId, grado_id: a.grado, vigencia: vigenciaAnio, registrado_por: admin }).returning('id').executeTakeFirstOrThrow()).id;
    mats.push({ id: m, ms, estudianteId: e, personaId: p, seccion: a.seccion, grado: a.grado, usuario: u, nombre: `${a.nombres} ${a.apellidos}` });
  }
  const apoderados: { nombres: string; apellidos: string; dni: string; hijos: number[]; academico: boolean; economico: boolean; parentesco: string }[] = [
    { nombres: 'Jorge', apellidos: 'Flores Demo', dni: '70000021', hijos: [0, 1], academico: true, economico: true, parentesco: 'padre' },
    { nombres: 'María', apellidos: 'Rojas Demo', dni: '70000022', hijos: [2], academico: true, economico: false, parentesco: 'madre' },
    { nombres: 'Elena', apellidos: 'Torres Demo', dni: '70000023', hijos: [3, 4], academico: true, economico: true, parentesco: 'madre' },
  ];
  const usuariosApoderado: string[] = [];
  for (const [i, ap] of apoderados.entries()) {
    const p = await persona(ap.nombres, ap.apellidos, ap.dni);
    usuariosApoderado.push(await usuario(p, `demo.padre${i + 1}`, ['apoderado']));
    for (const h of ap.hijos) {
      await db()
        .insertInto('estudiante_apoderado')
        .values({ estudiante_id: mats[h]!.estudianteId, persona_id: p, parentesco: ap.parentesco, vigencia: `[${anio}-01-01,)`, verificado_por: admin, verificado_en: sql`now()`, acceso_academico: ap.academico, acceso_economico: ap.economico })
        .execute();
      await db().insertInto('responsables_economicos').values({ matricula_id: mats[h]!.id, persona_id: p, tipo_documento: 'DNI', numero_documento: ap.dni, nombre_razon_social: `${ap.nombres} ${ap.apellidos}`, vigencia: `[${anio}-01-01,)` }).execute();
    }
  }

  // Cobros: condiciones económicas, plan publicado, cuotas, pagos y recibos
  const archivo = await guardarArchivo({ contenido: PDF_DEMO, nombreOriginal: 'condiciones-economicas-demo.pdf', tipoMime: 'application/pdf' });
  const condiciones = (
    await db()
      .insertInto('documentos_institucionales')
      .values({ anio_id: anioId, tipo: 'condiciones_economicas', version: 1, archivo_id: archivo.id, vigente_desde: `${anio}-01-01`, publicado_en: sql`now()` })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  const caja = (await db().insertInto('cajas').values({ nombre: 'Caja principal (demo)' }).returning('id').executeTakeFirstOrThrow()).id;
  const serie = (await db().insertInto('series_recibos').values({ codigo: 'REC-DEMO', numero_inicial: 1, siguiente_numero: 1 }).returning('id').executeTakeFirstOrThrow()).id;
  const sesionCaja = (await db().insertInto('sesiones_caja').values({ caja_id: caja, operador_id: admin, saldo_inicial: '100.00' }).returning('id').executeTakeFirstOrThrow()).id;

  const cuotasPorMatricula = new Map<string, { id: string; importe: string; exigible: string; concepto: string }[]>();
  for (const g of [gPri, gSec]) {
    const pensión = g === gPri ? '450.00' : '520.00';
    const planCobro = (
      await db()
        .insertInto('planes_cobro')
        .values({ anio_id: anioId, grado_id: g, version: 1, condiciones_id: condiciones, pension_referencia: pensión, vigente_desde: `${anio}-01-01`, publicado_en: sql`now()` })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const tramos = [
      { concepto: 'matricula', numero: 1, importe: '300.00', mes_servicio: null as string | null, exigible_desde: `${anio}-01-15`, vence_en: `${anio}-02-28` },
      ...Array.from({ length: 10 }, (_, i) => {
        const mes = i + 3;
        const ultimo = ultimoDia(anio, mes);
        return { concepto: 'pension', numero: i + 1, importe: pensión, mes_servicio: `${anio}-${String(mes).padStart(2, '0')}-01`, exigible_desde: ultimo, vence_en: ultimo };
      }),
    ];
    for (const t of tramos) {
      const tramo = (await db().insertInto('tramos_plan_cobro').values({ plan_id: planCobro, anio_id: anioId, grado_id: g, ...t }).returning('id').executeTakeFirstOrThrow()).id;
      for (const m of mats.filter((x) => x.grado === g)) {
        const c = await db()
          .insertInto('cuotas')
          .values({ matricula_id: m.id, estudiante_id: m.estudianteId, tramo_id: tramo, anio_id: anioId, grado_id: g, ...t })
          .returning(['id', 'importe', 'exigible_desde', 'concepto'])
          .executeTakeFirstOrThrow();
        cuotasPorMatricula.set(m.id, [...(cuotasPorMatricula.get(m.id) ?? []), { id: c.id, importe: c.importe, exigible: c.exigible_desde, concepto: c.concepto }]);
      }
    }
  }
  async function pagar(m: (typeof mats)[number], cuota: { id: string; importe: string; exigible: string }, importe: string, medio: 'transferencia' | 'efectivo', fecha: string) {
    const pago = (
      await db()
        .insertInto('pagos')
        .values({
          clave_idempotencia: randomUUID(),
          sesion_caja_id: medio === 'efectivo' ? sesionCaja : null,
          registrado_por: admin,
          pagante_nombre: `Apoderado de ${m.nombre}`,
          importe,
          medio,
          referencia: medio === 'transferencia' ? `Yape: ${Math.floor(100000 + Math.random() * 900000)}` : null,
          pagado_en: medio === 'efectivo' ? sql`now()` : enLima(fecha, '10:00'),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await db().insertInto('aplicaciones_pago').values({ pago_id: pago, cuota_id: cuota.id, importe, imputacion: 'eleccion_pagante' }).execute();
    await sql`select * from emitir_recibo_caja(${pago}::bigint, ${serie}::bigint, ${admin}::bigint)`.execute(db());
  }
  // Perfiles de pago variados: al día, parcial, moroso.
  const meses = [Infinity, 6, 0, 9, 1];
  for (const [i, m] of mats.entries()) {
    const cuotas = cuotasPorMatricula.get(m.id) ?? [];
    for (const [j, c] of cuotas.entries()) {
      if (c.exigible > hoy) break;
      if (j === 0 || j <= (meses[i] ?? 0)) await pagar(m, c, c.importe, i === 4 ? 'efectivo' : 'transferencia', c.exigible);
      else if (i === 1 && j === (meses[1] ?? 0) + 1) await pagar(m, c, '200.00', 'transferencia', c.exigible);
    }
  }

  // Asistencia: políticas, jornadas de las últimas 2 semanas y marcaciones manuales
  const vigPolitica = `[${anioFila.inicio},${sumar(anioFila.fin, 1)})`;
  const polAlumno = (await db().insertInto('politicas_asistencia').values({ anio_id: anioId, alcance: 'alumno', turno: 'Mañana', vigencia: vigPolitica, tolerancia_minutos: 10, ventana_entrada_minutos: 60, ventana_salida_minutos: 90 }).returning('id').executeTakeFirstOrThrow()).id;
  const polDocente = (await db().insertInto('politicas_asistencia').values({ anio_id: anioId, alcance: 'docente', turno: 'Mañana', vigencia: vigPolitica, tolerancia_minutos: 5, ventana_entrada_minutos: 60, ventana_salida_minutos: 120 }).returning('id').executeTakeFirstOrThrow()).id;
  await db().insertInto('lectores_qr').values({ codigo: 'DEMO-PUERTA', nombre: 'Puerta principal (demo)' }).execute();

  const fechasAsistencia = diasLectivos(sumar(hoy, -15), sumar(hoy, -1)).filter((f) => f >= anioFila.inicio && f <= anioFila.fin);
  async function marcar(personaId: string, tipo: 'entrada' | 'salida', fecha: string, hora: string) {
    const r = await sql<{ id: string }>`select id from registrar_marcacion(${randomUUID()}::uuid, ${tipo}, ${admin}::bigint, null, null, ${personaId}::bigint, ${enLima(fecha, hora)}::timestamptz, 'Registro manual (demo)')`.execute(db());
    return r.rows[0]!.id;
  }
  const patron = ['presente', 'presente', 'tarde', 'presente', 'ausente', 'presente', 'presente', 'tarde', 'presente', 'presente'];
  let justificada = false;
  for (const [k, fecha] of fechasAsistencia.entries()) {
    for (const seccion of [secPri, secSec]) {
      const gradoSec = seccion === secPri ? gPri : gSec;
      const jornada = (await db().insertInto('jornadas_seccion').values({ seccion_id: seccion, anio_id: anioId, grado_id: gradoSec, politica_id: polAlumno, fecha, entrada: '07:45', salida: '13:30' }).returning('id').executeTakeFirstOrThrow()).id;
      for (const [i, m] of mats.filter((x) => x.seccion === seccion).entries()) {
        const estado = patron[(k + i * 3) % patron.length]!;
        const entrada = estado === 'ausente' ? null : await marcar(m.personaId, 'entrada', fecha, estado === 'tarde' ? '08:02' : '07:38');
        const salida = estado === 'ausente' ? null : await marcar(m.personaId, 'salida', fecha, '13:35');
        const a = await db()
          .insertInto('asistencia_estudiantes')
          .values({ matricula_id: m.id, matricula_seccion_id: m.ms, jornada_id: jornada, estado, entrada_id: entrada, salida_id: salida, registrado_por: admin, motivo: 'Registro de demostración' })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (estado === 'ausente' && !justificada && m.seccion === secPri) {
          justificada = true;
          const j = (await db().insertInto('justificaciones_asistencia').values({ asistencia_estudiante_id: a.id, solicitada_por: usuariosApoderado[0]!, motivo: 'Cita médica (demo)' }).returning('id').executeTakeFirstOrThrow()).id;
          await db().updateTable('justificaciones_asistencia').set({ estado: 'aprobada', resuelta_por: admin, resuelta_en: sql`clock_timestamp()`, decision: 'Sustento conforme' }).where('id', '=', j).execute();
        }
      }
    }
    for (const [docente, personaId, tarde] of [[d1, d1Persona, k % 4 === 1], [d2, d2Persona, false]] as const) {
      const jornada = (await db().insertInto('jornadas_docente').values({ docente_id: docente, anio_id: anioId, politica_id: polDocente, fecha, entrada: '07:30', salida: '14:00' }).returning('id').executeTakeFirstOrThrow()).id;
      const entrada = await marcar(personaId, 'entrada', fecha, tarde ? '07:52' : '07:20');
      const salida = await marcar(personaId, 'salida', fecha, '14:05');
      await db().insertInto('asistencia_docentes').values({ jornada_id: jornada, estado: tarde ? 'tarde' : 'presente', entrada_id: entrada, salida_id: salida, registrado_por: admin, motivo: 'Registro de demostración' }).execute();
    }
  }

  // Evaluación: bimestres ya terminados cerrados y publicados
  const NIVELES = ['A', 'AD', 'B', 'A', 'C', 'A', 'B', 'AD'];
  let n = 0;
  for (const b of bimestres.filter((x) => x.fin < hoy)) {
    for (const [seccion, gradoSec, planId, autor] of [[secPri, gPri, planPri, d1User], [secSec, gSec, planSec, d2User]] as const) {
      const cierre = (await db().insertInto('cierres_evaluacion').values({ seccion_id: seccion, bimestre_id: b.id, anio_id: anioId, grado_id: gradoSec, responsable_id: admin }).returning('id').executeTakeFirstOrThrow()).id;
      const competencias = await db().selectFrom('plan_competencias').select('competencia_id').where('plan_id', '=', planId).execute();
      for (const m of mats.filter((x) => x.seccion === seccion)) {
        for (const c of competencias) {
          const nivel = NIVELES[n++ % NIVELES.length]!;
          const conclusion = nivel === 'B' || nivel === 'C' ? 'Requiere acompañamiento para consolidar los desempeños de esta competencia (demo).' : nivel === 'AD' ? 'Supera lo esperado en los desempeños de la competencia (demo).' : null;
          await db()
            .insertInto('calificaciones_competencia')
            .values({ matricula_id: m.id, bimestre_id: b.id, competencia_id: c.competencia_id, plan_id: planId, cierre_id: cierre, anio_id: anioId, grado_id: gradoSec, estado: 'evaluada', nivel_logro: nivel, conclusion, autor_id: autor })
            .execute();
        }
      }
      await db().updateTable('cierres_evaluacion').set({ estado: 'cerrado', cerrado_en: sql`clock_timestamp()` }).where('id', '=', cierre).execute();
      await db().updateTable('cierres_evaluacion').set({ estado: 'publicado', publicado_en: sql`clock_timestamp()` }).where('id', '=', cierre).execute();
    }
  }

  // Planilla: contratos (fijo y por horas), sesiones realizadas y horas del mes anterior
  await db().insertInto('contratos_docentes').values({ docente_id: d1, referencia: 'DEMO-CF-01', vigencia: vigenciaAnio, modalidad: 'fijo', sueldo_mensual: '3500.00', registrado_por: admin }).execute();
  const contrato2 = (await db().insertInto('contratos_docentes').values({ docente_id: d2, referencia: 'DEMO-CH-01', vigencia: vigenciaAnio, modalidad: 'por_horas', tarifa_hora: '30.0000', minutos_por_hora: 45, registrado_por: admin }).returning('id').executeTakeFirstOrThrow()).id;
  const mesAnterior = `${sumar(`${hoy.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
  if (mesAnterior >= anioFila.inicio.slice(0, 7) + '-01') {
    await db().insertInto('periodos_liquidacion').values({ mes: mesAnterior, registrado_por: admin }).onConflict((oc) => oc.column('mes').doNothing()).execute();
    const finMes = sumar(`${hoy.slice(0, 7)}-01`, -1);
    for (const fecha of diasLectivos(mesAnterior, finMes).filter((f) => f >= anioFila.inicio)) {
      for (const bl of bloqueIds.filter((x) => x.b.docente === d2 && x.dia === diaIso(fecha))) {
        const sesion = (
          await db()
            .insertInto('sesiones_clase')
            .values({ curso_id: bl.b.curso, seccion_id: bl.b.seccion, bloque_id: bl.id, asignacion_id: bl.b.asignacion, docente_id: d2, aula_id: bl.b.aula, fecha, hora_inicio: '08:00', hora_fin: '09:30', estado: 'realizada' })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;
        const h = (
          await db()
            .insertInto('horas_docentes')
            .values({ contrato_id: contrato2, sesion_id: sesion, fecha, hora_inicio: '08:00', hora_fin: '09:30', motivo: 'Dictado de clase (demo)', registrado_por: admin })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;
        await db().updateTable('horas_docentes').set({ estado: 'aprobada', resuelto_por: admin, resuelto_en: sql`clock_timestamp()`, decision: 'Conforme' }).where('id', '=', h).execute();
      }
    }
  }

  console.log(`\nDatos de demostración creados para ${anio}.`);
  console.log('Cuentas: demo.admin, demo.docente1, demo.docente2, demo.alumno1..5, demo.padre1..3');
  console.log('Contraseña de todas: ver CONTRASENA_DEMO en scripts/sembrar-demo.ts (solo bases de prueba).\n');
}

async function main() {
  const { values } = parseArgs({ options: { confirmar: { type: 'boolean' }, 'solo-catalogo': { type: 'boolean' } } });
  if (process.env.NODE_ENV === 'production') throw new Error('Las semillas de demostración no se ejecutan en producción.');
  if (!values.confirmar) throw new Error('Agregue --confirmar para sembrar en la base de DATABASE_URL (solo bases de desarrollo o prueba).');
  await transaccion(async () => {
    await sembrarCatalogo();
    console.log('Catálogo CNEB y tipos de documento: listo (idempotente).');
    if (!values['solo-catalogo']) await sembrarDemo();
  });
}

main()
  .catch((e) => {
    console.error('Error:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => kysely().destroy());
