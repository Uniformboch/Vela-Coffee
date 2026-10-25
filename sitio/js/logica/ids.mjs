// Identificadores internos: se crean a partir del nombre y no cambian aunque el nombre cambie.

/** "Café de Olla" → "cafe-de-olla" */
export function aId(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 50).replace(/-+$/, '') || 'nuevo';
}

/** Un id que no esté en "usados" (Set): "latte", "latte-2", "latte-3"… */
export function idUnico(texto, usados) {
  const base = aId(texto);
  let id = base, n = 2;
  while (usados.has(id)) id = `${base}-${n++}`;
  return id;
}

/** Todos los ids de producto del menú y la temporada (no se pueden repetir entre ambos). */
export function idsDeProductos(menu, temporada) {
  return new Set([...(menu.categorias ?? []), temporada?.categoria].filter(Boolean).flatMap(c => (c.productos ?? []).map(p => p.id)));
}

export function idsDeCategorias(menu, temporada) {
  return new Set([...(menu.categorias ?? []).map(c => c.id), temporada?.categoria?.id].filter(Boolean));
}
