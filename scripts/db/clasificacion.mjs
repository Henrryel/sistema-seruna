// Clasificación de los mensajes RAISE EXCEPTION (SQLSTATE P0001) de la base en errores de dominio.
// La usan generar-docs.mjs (documentación) y generar-errores.mjs (src/server/errores/mensajes-db.ts).

export function erroresDe(cuerpo) {
  const lista = [];
  for (const m of cuerpo.matchAll(/RAISE EXCEPTION\s+'((?:[^']|'')*)'/g)) {
    const msg = m[1].replace(/''/g, "'");
    if (!lista.includes(msg)) lista.push(msg);
  }
  return lista;
}

export function clasificar(msg) {
  const m = msg.toLowerCase();
  if (/no está autorizada|requiere un operador activo/.test(m)) return 'Forbidden';
  if (/ya identifica|ya corresponde|ya está conciliada|ya tiene otra/.test(m)) return 'Conflict';
  if (
    /inmutable|conservarse|debe conservar|solo inserción|sobrescribiría|registre un ajuste|nueva versión|reemplace|no se puede[n]? (modificar|cambiar)|no admite|reabra|transición|alteraría|está cerrado|publique el bimestre|cierre el bimestre|nuevas aplicaciones|solo se puede resolver|solo puede pasar|solo se permite cerrar|apruebe el borrador|debe empezar|empezar en borrador|primero|registre el listado/.test(
      m,
    )
  )
    return 'Conflict';
  return 'Validation';
}

export const HTTP = { Validation: 422, Conflict: 409, Forbidden: 403, NotFound: 404 };
