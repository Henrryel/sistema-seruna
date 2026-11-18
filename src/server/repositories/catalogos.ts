import 'server-only';
import { db, sql } from '@/server/db';

// Catálogos livianos para selects (id + etiqueta). Sin datos personales salvo `docentes` (solo admin).

export interface Opcion {
  valor: string;
  etiqueta: string;
  extra?: Record<string, string | number | boolean | null>;
}

const NIVEL = sql<string>`(select n.nombre from niveles n where n.id = g.nivel_id)`;

export const CATALOGOS = {
  async anios(): Promise<Opcion[]> {
    const f = await db().selectFrom('anios_academicos').select(['id', 'anio', 'estado', 'inicio', 'fin']).orderBy('anio', 'desc').execute();
    return f.map((a) => ({ valor: a.id, etiqueta: String(a.anio), extra: { estado: a.estado, inicio: a.inicio, fin: a.fin } }));
  },
  async bimestres(p: Record<string, string | undefined>): Promise<Opcion[]> {
    let q = db().selectFrom('bimestres').select(['id', 'numero', 'anio_id', 'inicio', 'fin']).orderBy('numero');
    if (p.anioId) q = q.where('anio_id', '=', p.anioId);
    const f = await q.execute();
    return f.map((b) => ({ valor: b.id, etiqueta: `${b.numero}.º bimestre`, extra: { anioId: b.anio_id, numero: b.numero, inicio: b.inicio, fin: b.fin } }));
  },
  async niveles(): Promise<Opcion[]> {
    const f = await db().selectFrom('niveles').select(['id', 'codigo', 'nombre']).orderBy('id').execute();
    return f.map((n) => ({ valor: n.id, etiqueta: n.nombre, extra: { codigo: n.codigo } }));
  },
  async grados(): Promise<Opcion[]> {
    const f = await db()
      .selectFrom('grados as g')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
      .select(['g.id', 'g.numero', 'n.nombre as nivel', 'n.codigo as nivel_codigo'])
      .orderBy('n.id')
      .orderBy('g.numero')
      .execute();
    return f.map((g) => ({ valor: g.id, etiqueta: `${g.numero}.º ${g.nivel}`, extra: { numero: g.numero, nivel: g.nivel_codigo } }));
  },
  async secciones(p: Record<string, string | undefined>): Promise<Opcion[]> {
    let q = db()
      .selectFrom('secciones as s')
      .innerJoin('grados as g', 'g.id', 's.grado_id')
      .select(['s.id', 's.nombre', 's.turno', 's.anio_id', 's.grado_id', 'g.numero', NIVEL.as('nivel')])
      .where('s.activa', '=', true)
      .orderBy('g.nivel_id')
      .orderBy('g.numero')
      .orderBy('s.nombre');
    if (p.anioId) q = q.where('s.anio_id', '=', p.anioId);
    if (p.gradoId) q = q.where('s.grado_id', '=', p.gradoId);
    const f = await q.execute();
    return f.map((s) => ({ valor: s.id, etiqueta: `${s.numero}.º ${s.nombre} ${s.nivel} (${s.turno})`, extra: { anioId: s.anio_id, gradoId: s.grado_id } }));
  },
  async aulas(): Promise<Opcion[]> {
    const f = await db().selectFrom('aulas').select(['id', 'codigo', 'nombre']).where('activa', '=', true).orderBy('codigo').execute();
    return f.map((a) => ({ valor: a.id, etiqueta: `${a.codigo} · ${a.nombre}` }));
  },
  async areas(): Promise<Opcion[]> {
    const f = await db().selectFrom('areas_curriculares').select(['id', 'codigo', 'nombre']).orderBy('nombre').execute();
    return f.map((a) => ({ valor: a.id, etiqueta: a.nombre, extra: { codigo: a.codigo } }));
  },
  async competencias(p: Record<string, string | undefined>): Promise<Opcion[]> {
    let q = db().selectFrom('competencias').select(['id', 'codigo', 'nombre', 'version', 'area_id']).orderBy('codigo');
    if (p.areaId) q = q.where('area_id', '=', p.areaId);
    const f = await q.execute();
    return f.map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}`, extra: { version: c.version, areaId: c.area_id } }));
  },
  async asignaturas(): Promise<Opcion[]> {
    const f = await db().selectFrom('asignaturas').select(['id', 'codigo', 'nombre']).orderBy('nombre').execute();
    return f.map((a) => ({ valor: a.id, etiqueta: `${a.nombre} (${a.codigo})` }));
  },
  async planes(p: Record<string, string | undefined>): Promise<Opcion[]> {
    let q = db()
      .selectFrom('planes_estudio as pe')
      .innerJoin('grados as g', 'g.id', 'pe.grado_id')
      .select(['pe.id', 'pe.version', 'pe.publicado_en', 'pe.anio_id', 'pe.grado_id', 'g.numero', NIVEL.as('nivel')])
      .orderBy('g.nivel_id')
      .orderBy('g.numero')
      .orderBy('pe.version', 'desc');
    if (p.anioId) q = q.where('pe.anio_id', '=', p.anioId);
    if (p.gradoId) q = q.where('pe.grado_id', '=', p.gradoId);
    const f = await q.execute();
    return f.map((x) => ({
      valor: x.id,
      etiqueta: `${x.numero}.º ${x.nivel} · v${x.version}${x.publicado_en ? '' : ' (borrador)'}`,
      extra: { publicado: Boolean(x.publicado_en), anioId: x.anio_id, gradoId: x.grado_id },
    }));
  },
  async docentes(): Promise<Opcion[]> {
    const f = await db()
      .selectFrom('docentes as d')
      .innerJoin('personas as p', 'p.id', 'd.persona_id')
      .select(['d.id', 'd.codigo', 'd.activo', 'p.nombres', 'p.apellidos'])
      .orderBy('p.apellidos')
      .execute();
    return f.map((d) => ({ valor: d.id, etiqueta: `${d.apellidos}, ${d.nombres} (${d.codigo})`, extra: { activo: d.activo } }));
  },
  async cajas(): Promise<Opcion[]> {
    const f = await db().selectFrom('cajas').select(['id', 'nombre']).where('activa', '=', true).orderBy('nombre').execute();
    return f.map((c) => ({ valor: c.id, etiqueta: c.nombre }));
  },
  async series(): Promise<Opcion[]> {
    const f = await db().selectFrom('series_recibos').select(['id', 'codigo']).where('activa', '=', true).orderBy('codigo').execute();
    return f.map((s) => ({ valor: s.id, etiqueta: s.codigo }));
  },
  async lectores(): Promise<Opcion[]> {
    const f = await db().selectFrom('lectores_qr').select(['id', 'codigo', 'nombre']).where('activo', '=', true).orderBy('codigo').execute();
    return f.map((l) => ({ valor: l.id, etiqueta: `${l.codigo} · ${l.nombre}` }));
  },
  async conceptos(): Promise<Opcion[]> {
    const f = await db().selectFrom('conceptos_cobro').select(['codigo', 'nombre']).execute();
    return f.map((c) => ({ valor: c.codigo, etiqueta: c.nombre }));
  },
  async 'tipos-documento'(): Promise<Opcion[]> {
    const f = await db().selectFrom('tipos_documento').select(['id', 'codigo', 'nombre']).orderBy('nombre').execute();
    return f.map((t) => ({ valor: t.id, etiqueta: t.nombre, extra: { codigo: t.codigo } }));
  },
  async 'tipos-reporte'(): Promise<Opcion[]> {
    const f = await db().selectFrom('tipos_reporte').select(['codigo', 'nombre', 'permiso']).execute();
    return f.map((t) => ({ valor: t.codigo, etiqueta: t.nombre, extra: { permiso: t.permiso } }));
  },
  async politicas(p: Record<string, string | undefined>): Promise<Opcion[]> {
    let q = db().selectFrom('politicas_asistencia').select(['id', 'alcance', 'turno', 'anio_id', 'tolerancia_minutos']).orderBy('alcance');
    if (p.anioId) q = q.where('anio_id', '=', p.anioId);
    if (p.alcance) q = q.where('alcance', '=', p.alcance);
    const f = await q.execute();
    return f.map((x) => ({ valor: x.id, etiqueta: `${x.alcance} · ${x.turno} (tolerancia ${x.tolerancia_minutos} min)`, extra: { anioId: x.anio_id, alcance: x.alcance } }));
  },
} satisfies Record<string, (p: Record<string, string | undefined>) => Promise<Opcion[]>>;

export type TipoCatalogo = keyof typeof CATALOGOS;
export const TIPOS_CATALOGO = Object.keys(CATALOGOS) as TipoCatalogo[];
