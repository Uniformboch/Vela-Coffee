// Dibuja las categorías del menú: tablas de bebidas, listas de comida y tarjetas de temporada.
import { el } from './dom.mjs';
import { productosVisibles, tamanosDe, UNICO } from '../logica/catalogo.mjs';
import { columnasDeCategoria, leyendaDeColumnas, formatoPrecio, idAncla } from '../logica/vista.mjs';

const etiquetaAgotado = p => p.agotado ? el('span', { class: 'etiqueta' }, 'Agotado') : null;
const detalle = p => p.detalle ? el('span', { class: 'detalle' }, p.detalle) : null;

function encabezado(categoria, extra) {
  return [
    el('h2', { id: `${idAncla(categoria)}-titulo` }, categoria.nombre),
    categoria.descripcion ? el('p', { class: 'cat-desc' }, categoria.descripcion) : null,
    extra
  ];
}

// Precio único: una sola columna. Con tamaños: una columna por tamaño usado en la categoría.
function tablaBebidas(menu, categoria, alElegir) {
  const columnas = columnasDeCategoria(menu, categoria);
  const conTamanos = columnas.length > 0;
  const titulos = conTamanos ? columnas : ['Precio'];

  const filas = productosVisibles(categoria).map(p => {
    const precios = conTamanos
      ? (tamanosDe(menu, p)[0] === UNICO
        ? [el('td', { class: 'precio', colspan: columnas.length }, formatoPrecio(p.precios.unico))]
        : columnas.map(c => p.precios[c] != null
          ? el('td', { class: 'precio' }, formatoPrecio(p.precios[c]))
          : el('td', { class: 'precio no-hay' }, el('span', { 'aria-hidden': 'true' }, '—'), el('span', { class: 'oculto' }, 'no disponible'))))
      : [el('td', { class: 'precio' }, formatoPrecio(p.precios.unico))];

    return el('tr', { class: p.agotado ? 'agotado' : null },
      el('td', {},
        el('button', {
          type: 'button', class: 'fila-boton', disabled: !!p.agotado,
          onclick: e => alElegir(p, categoria, e.currentTarget)
        },
        p.nombre, detalle(p), etiquetaAgotado(p),
        p.descripcion ? el('span', { class: 'fila-desc' }, p.descripcion) : null)),
      precios);
  });

  return el('table', { class: 'precios' },
    el('thead', { class: conTamanos ? null : 'oculto' },
      el('tr', {}, el('th', { scope: 'col' }, 'Producto'), titulos.map(t => el('th', { scope: 'col' }, t)))),
    el('tbody', {}, filas));
}

function listaComida(categoria, alElegir) {
  return el('ul', { class: 'platillos' }, productosVisibles(categoria).map(p =>
    el('li', {},
      el('button', { type: 'button', class: 'platillo', disabled: !!p.agotado, onclick: e => alElegir(p, categoria, e.currentTarget) },
        el('span', { class: 'linea' },
          el('span', {}, p.nombre, detalle(p), etiquetaAgotado(p)),
          el('span', { class: 'precio' }, formatoPrecio(Math.min(...Object.values(p.precios))))),
        p.descripcion ? el('span', { class: 'desc' }, p.descripcion) : null))));
}

function tarjetasTemporada(categoria, alElegir) {
  return el('div', { class: 'tarjetas' }, productosVisibles(categoria).map(p =>
    el('button', { type: 'button', class: 'tarjeta', disabled: !!p.agotado, onclick: e => alElegir(p, categoria, e.currentTarget) },
      p.imagen
        ? el('img', { class: 'tarjeta-foto', src: `/${p.imagen}`, alt: '', loading: 'lazy', decoding: 'async', width: 400, height: 300 })
        : null,
      el('span', { class: 'tarjeta-texto' },
        el('span', { class: 'linea' },
          el('span', {}, p.nombre, etiquetaAgotado(p)),
          el('span', { class: 'precio' }, formatoPrecio(p.precios.unico))),
        p.descripcion ? el('span', { class: 'desc' }, p.descripcion) : null))));
}

/** Sección de una categoría. grupo: 'bebidas' | 'comida' | 'temporada'. */
export function seccionCategoria(menu, categoria, grupo, alElegir) {
  const columnas = grupo === 'bebidas' ? columnasDeCategoria(menu, categoria) : [];
  const cuerpo = grupo === 'temporada' ? tarjetasTemporada(categoria, alElegir)
    : grupo === 'bebidas' ? tablaBebidas(menu, categoria, alElegir)
      : listaComida(categoria, alElegir);
  return el('section', { class: 'categoria', id: idAncla(categoria), 'aria-labelledby': `${idAncla(categoria)}-titulo` },
    encabezado(categoria, columnas.length ? el('p', { class: 'leyenda' }, leyendaDeColumnas(menu, columnas)) : null),
    cuerpo);
}

/** Dibuja todo el menú dentro de "contenedor". Devuelve las secciones por grupo. */
export function dibujarMenu(contenedor, menu, vista, alElegir) {
  const secciones = { temporada: null, grupos: {} };
  const nodos = [];
  if (vista.temporada) {
    secciones.temporada = seccionCategoria(menu, vista.temporada, 'temporada', alElegir);
    nodos.push(secciones.temporada);
  }
  for (const g of vista.grupos) {
    const lista = g.categorias.map(c => seccionCategoria(menu, c, g.id, alElegir));
    secciones.grupos[g.id] = { contenedor: el('div', { class: 'grupo', dataset: { grupo: g.id } }, lista), lista };
    nodos.push(secciones.grupos[g.id].contenedor);
  }
  contenedor.replaceChildren(...nodos);
  return secciones;
}
