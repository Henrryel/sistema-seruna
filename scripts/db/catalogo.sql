-- Catálogo del esquema excelencia_seruna en un único JSON (lo consume scripts/db/generar-docs.mjs).
-- Uso: psql -At -f scripts/db/catalogo.sql -o docs/db/catalogo.json
with tbl as (
  select c.oid, c.relname, obj_description(c.oid, 'pg_class') as comentario
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'excelencia_seruna' and c.relkind in ('r','p')
), cols as (
  select a.attrelid, json_agg(json_build_object(
      'nombre', a.attname,
      'tipo', format_type(a.atttypid, a.atttypmod),
      'nulo', not a.attnotnull,
      'defecto', pg_get_expr(d.adbin, d.adrelid),
      'identidad', nullif(a.attidentity, ''),
      'generada', nullif(a.attgenerated, ''),
      'comentario', col_description(a.attrelid, a.attnum)
    ) order by a.attnum) as columnas
  from pg_attribute a
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and a.attrelid in (select oid from tbl)
  group by a.attrelid
), cons as (
  select conrelid, json_agg(json_build_object(
      'nombre', conname, 'tipo', contype,
      'def', pg_get_constraintdef(oid),
      'ref', case when contype = 'f' then confrelid::regclass::text end
    ) order by contype, conname) as restricciones
  from pg_constraint where conrelid in (select oid from tbl)
  group by conrelid
), idx as (
  select i.indrelid, json_agg(json_build_object('nombre', ci.relname, 'def', pg_get_indexdef(i.indexrelid)) order by ci.relname) as indices
  from pg_index i join pg_class ci on ci.oid = i.indexrelid
  where i.indrelid in (select oid from tbl)
    and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)
  group by i.indrelid
), trg as (
  select t.tgrelid, json_agg(json_build_object('nombre', t.tgname, 'def', pg_get_triggerdef(t.oid), 'funcion', p.proname) order by t.tgname) as triggers
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal and t.tgrelid in (select oid from tbl)
  group by t.tgrelid
)
select json_build_object(
  'tablas', (select json_agg(json_build_object(
      'nombre', t.relname, 'comentario', t.comentario,
      'filas', (xpath('/row/c/text()', query_to_xml(
                  format('select count(*) as c from excelencia_seruna.%I', t.relname), false, true, '')))[1]::text::bigint,
      'columnas', c.columnas, 'restricciones', coalesce(k.restricciones, '[]'),
      'indices', coalesce(i.indices, '[]'), 'triggers', coalesce(g.triggers, '[]')
    ) order by t.relname)
    from tbl t join cols c on c.attrelid = t.oid
    left join cons k on k.conrelid = t.oid left join idx i on i.indrelid = t.oid left join trg g on g.tgrelid = t.oid),
  'vistas', (select json_agg(json_build_object(
      'nombre', c.relname, 'def', pg_get_viewdef(c.oid, true),
      'columnas', (select json_agg(json_build_object('nombre', a.attname, 'tipo', format_type(a.atttypid, a.atttypmod)) order by a.attnum)
                   from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'excelencia_seruna' and c.relkind in ('v','m')),
  'funciones', (select json_agg(json_build_object(
      'nombre', p.proname,
      'args', pg_get_function_arguments(p.oid),
      'retorno', pg_get_function_result(p.oid),
      'lenguaje', l.lanname,
      'volatilidad', p.provolatile,
      'security_definer', p.prosecdef,
      'config', p.proconfig,
      'acl', p.proacl::text,
      'cuerpo', p.prosrc
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
    where n.nspname = 'excelencia_seruna'),
  'secuencias', (select json_agg(c.relname order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'excelencia_seruna' and c.relkind = 'S'),
  'semillas', json_build_object(
    'roles', (select json_agg(to_jsonb(r) order by r.id) from excelencia_seruna.roles r),
    'permisos', (select json_agg(to_jsonb(r) order by r.id) from excelencia_seruna.permisos r),
    'rol_permisos', (select json_agg(to_jsonb(r)) from excelencia_seruna.rol_permisos r),
    'niveles', (select json_agg(to_jsonb(r) order by r.id) from excelencia_seruna.niveles r),
    'grados', (select json_agg(to_jsonb(r) order by r.id) from excelencia_seruna.grados r),
    'conceptos_cobro', (select json_agg(to_jsonb(r)) from excelencia_seruna.conceptos_cobro r),
    'tipos_reporte', (select json_agg(to_jsonb(r)) from excelencia_seruna.tipos_reporte r)
  )
);
