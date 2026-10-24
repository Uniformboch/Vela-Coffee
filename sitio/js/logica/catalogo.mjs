// Consultas sobre el menú. Sin DOM: se usa en el navegador, en las funciones y en las pruebas.

export const UNICO = 'unico';

/** Tamaños en que se vende un producto, en el orden del menú ("C", "F") o ["unico"]. */
export function tamanosDe(menu, producto) {
  const claves = Object.keys(producto.precios ?? {});
  if (claves.includes(UNICO)) return [UNICO];
  const orden = Object.keys(menu.tamanos ?? {});
  return orden.filter(t => claves.includes(t));
}

/** Nombre del tamaño para mostrar ("Caliente"), o null si es precio único. */
export function nombreTamano(menu, tamano) {
  return tamano === UNICO ? null : (menu.tamanos?.[tamano]?.nombre ?? tamano);
}

/** Categorías normales más la de temporada, si está activa. */
export function todasLasCategorias(menu, temporada) {
  const lista = [...(menu.categorias ?? [])];
  if (temporada?.activa && temporada.categoria) lista.unshift({ ...temporada.categoria, grupo: temporada.categoria.grupo ?? 'temporada', esTemporada: true });
  return lista;
}

/** Productos que se muestran (los de disponible:false se ocultan). */
export function productosVisibles(categoria) {
  return (categoria.productos ?? []).filter(p => p.disponible !== false);
}

/** Busca un producto por id en todas las categorías. */
export function buscarProducto(menu, temporada, productoId) {
  for (const categoria of todasLasCategorias(menu, temporada)) {
    const producto = categoria.productos?.find(p => p.id === productoId);
    if (producto) return { categoria, producto };
  }
  return null;
}

/**
 * Extras que se ofrecen en un producto. La lista del producto, si existe, sustituye a la de la categoría.
 * Si se indica tamaño, se quitan los extras limitados a otros tamaños (ej. la lata solo en frío).
 * Sin tamaño, se devuelven los que aplican en al menos uno de sus tamaños.
 */
export function extrasDeProducto(menu, categoria, producto, tamano) {
  const ids = producto.extrasPermitidos ?? categoria.extrasPermitidos ?? [];
  const tamanos = tamano ? [tamano] : tamanosDe(menu, producto);
  return ids
    .map(id => menu.extras?.find(e => e.id === id))
    .filter(e => e && (!e.tamanos || tamanos.some(t => e.tamanos.includes(t))));
}

/** Nombre con el que el producto aparece en el pedido (con el prefijo de la categoría, si tiene). */
export function nombreEnPedido(categoria, producto) {
  return categoria.prefijoPedido ? `${categoria.prefijoPedido} ${producto.nombre}` : producto.nombre;
}

/** Precio más bajo del producto, para mostrar "desde". */
export function precioMinimo(producto) {
  return Math.min(...Object.values(producto.precios ?? {}));
}
