// Cómo se organiza el menú en pantalla: grupos, columnas de precio, anclas y formatos. Sin DOM.
import { productosVisibles, tamanosDe, UNICO } from './catalogo.mjs';

export const GRUPOS = [
  { id: 'bebidas', nombre: 'Bebidas' },
  { id: 'comida', nombre: 'Comida' }
];

export const idAncla = categoria => `cat-${categoria.id}`;

export function formatoPrecio(n) {
  return '$' + n.toLocaleString('es-MX');
}

/** "524771358745" → "477 135 8745" (los últimos 10 dígitos, en grupos). */
export function formatoTelefono(numero) {
  const d = String(numero).replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
}

/**
 * Lo que se dibuja: la temporada (si está activa y tiene algo que mostrar) y los grupos con sus
 * categorías. Se omiten categorías sin productos visibles y grupos sin categorías.
 */
export function armarVista(menu, temporada) {
  const conProductos = c => productosVisibles(c).length > 0;
  const tCat = temporada?.activa && temporada.categoria && conProductos(temporada.categoria) ? temporada.categoria : null;
  const grupos = GRUPOS
    .map(g => ({ ...g, categorias: (menu.categorias ?? []).filter(c => c.grupo === g.id && conProductos(c)) }))
    .filter(g => g.categorias.length > 0);
  return { temporada: tCat, grupos };
}

/** Columnas de tamaño que usa una categoría, en el orden del menú. Vacío si todo es precio único. */
export function columnasDeCategoria(menu, categoria) {
  const usados = new Set();
  for (const p of productosVisibles(categoria)) for (const t of tamanosDe(menu, p)) if (t !== UNICO) usados.add(t);
  return Object.keys(menu.tamanos ?? {}).filter(t => usados.has(t));
}

/** "C caliente · F frío" para las columnas dadas. */
export function leyendaDeColumnas(menu, columnas) {
  return columnas.map(c => `${c} ${menu.tamanos[c].nombre.toLocaleLowerCase('es-MX')}`).join(' · ');
}

/**
 * A qué categoría y grupo lleva un "#cat-…". Devuelve null si no existe.
 * Para la temporada, grupo es null (se ve en los dos grupos).
 */
export function buscarAncla(vista, hash) {
  const id = decodeURIComponent(String(hash ?? '').replace(/^#/, ''));
  if (!id.startsWith('cat-')) return null;
  if (vista.temporada && idAncla(vista.temporada) === id) return { grupo: null, categoria: vista.temporada };
  for (const g of vista.grupos) {
    const categoria = g.categorias.find(c => idAncla(c) === id);
    if (categoria) return { grupo: g.id, categoria };
  }
  return null;
}
