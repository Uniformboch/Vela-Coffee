// Hoja de producto: tamaño, opciones obligatorias, extras y cantidad, con el precio en vivo.
import { el } from './dom.mjs';
import { crearHoja } from './hoja.mjs';
import { tamanosDe, extrasDeProducto, nombreTamano } from '../logica/catalogo.mjs';
import { CANTIDAD_MAX, erroresSeleccion, precioSeleccion, tamanoEfectivo } from '../logica/carrito.mjs';
import { formatoPrecio } from '../logica/vista.mjs';

/**
 * datos(): { menu, temporada } actuales.
 * alAgregar(linea, producto): se llama con la línea lista para el carrito.
 */
export function crearHojaProducto({ datos, alAgregar }) {
  const hoja = crearHoja({ clase: 'hoja-producto' });
  const boton = el('button', { type: 'button', class: 'boton-principal', onclick: agregar }, 'Agregar');
  hoja.pie.append(boton);

  let estado = null;      // { producto, categoria, tamano, opciones, extras:Set, cantidad }
  let grupos = {};        // fieldsets por clave ('tamano' | id de opción) para mostrar errores
  let zonaExtras = null;
  let salidaCantidad = null, menos = null, mas = null;

  const seleccion = () => ({
    productoId: estado.producto.id, tamano: estado.tamano, opciones: { ...estado.opciones },
    extras: [...estado.extras], cantidad: estado.cantidad
  });

  function grupoRadios({ clave, leyenda, nombre, valores, alCambiar }) {
    const error = el('p', { class: 'error', id: `error-${clave}`, hidden: true });
    const fieldset = el('fieldset', { class: 'grupo-opcion', 'aria-describedby': `error-${clave}` },
      el('legend', {}, leyenda, el('span', { class: 'obligatorio' }, 'Obligatorio')),
      valores.map(v => el('label', { class: 'opcion' },
        el('input', { type: 'radio', name: nombre, value: v.id, onchange: () => { alCambiar(v.id); ocultarError(clave); } }),
        el('span', { class: 'opcion-nombre' }, v.nombre),
        v.precio != null ? el('span', { class: 'opcion-precio' }, v.precio) : null)),
      error);
    grupos[clave] = { fieldset, error };
    return fieldset;
  }

  function ocultarError(clave) {
    const g = grupos[clave];
    if (g) { g.error.hidden = true; g.error.textContent = ''; }
  }

  function dibujarExtras() {
    const { menu } = datos();
    const { producto, categoria } = estado;
    const tamano = tamanoEfectivo(menu, producto, estado.tamano);
    // Sin tamaño elegido solo se ven los extras que valen en cualquier tamaño (la lata aparece al elegir frío).
    const lista = tamano
      ? extrasDeProducto(menu, categoria, producto, tamano)
      : extrasDeProducto(menu, categoria, producto).filter(e => !e.tamanos);
    for (const id of [...estado.extras]) if (!lista.some(e => e.id === id)) estado.extras.delete(id);

    zonaExtras.replaceChildren(...(lista.length ? [el('fieldset', { class: 'grupo-opcion' },
      el('legend', {}, 'Extras', el('span', { class: 'opcional' }, 'Opcional')),
      lista.map(e => el('label', { class: 'opcion' },
        el('input', {
          type: 'checkbox', value: e.id, checked: estado.extras.has(e.id),
          onchange: ev => { ev.target.checked ? estado.extras.add(e.id) : estado.extras.delete(e.id); actualizarBoton(); }
        }),
        el('span', { class: 'opcion-nombre' }, e.nombre),
        el('span', { class: 'opcion-precio' }, `+${formatoPrecio(e.precio)}`))))] : []));
  }

  function actualizarBoton() {
    const { menu, temporada } = datos();
    const precio = precioSeleccion(menu, temporada, seleccion());
    boton.textContent = precio == null ? 'Agregar' : `Agregar · ${formatoPrecio(precio)}`;
    salidaCantidad.textContent = String(estado.cantidad);
    menos.disabled = estado.cantidad <= 1;
    mas.disabled = estado.cantidad >= CANTIDAD_MAX;
  }

  function dibujar() {
    const { menu } = datos();
    const { producto } = estado;
    const tamanos = tamanosDe(menu, producto);
    grupos = {};
    zonaExtras = el('div');
    salidaCantidad = el('output', { class: 'cantidad-valor', 'aria-live': 'polite' }, '1');
    menos = el('button', { type: 'button', class: 'boton-cantidad', 'aria-label': 'Quitar uno', onclick: () => { estado.cantidad--; actualizarBoton(); } }, '−');
    mas = el('button', { type: 'button', class: 'boton-cantidad', 'aria-label': 'Agregar uno', onclick: () => { estado.cantidad++; actualizarBoton(); } }, '+');

    // replaceChildren no acepta listas ni null: se aplanan y filtran.
    hoja.cuerpo.replaceChildren(...[
      producto.descripcion ? el('p', { class: 'hoja-desc' }, producto.descripcion) : null,
      tamanos.length > 1
        ? grupoRadios({
          clave: 'tamano', leyenda: 'Tamaño', nombre: 'tamano',
          valores: tamanos.map(t => ({ id: t, nombre: nombreTamano(menu, t), precio: formatoPrecio(producto.precios[t]) })),
          alCambiar: t => { estado.tamano = t; dibujarExtras(); actualizarBoton(); }
        })
        : tamanos[0] !== 'unico' ? el('p', { class: 'hoja-nota' }, `Solo ${nombreTamano(menu, tamanos[0]).toLocaleLowerCase('es-MX')} · ${formatoPrecio(producto.precios[tamanos[0]])}`) : null,
      (producto.opciones ?? []).map(o => grupoRadios({
        clave: o.id, leyenda: o.nombre, nombre: `opcion-${o.id}`,
        valores: o.valores.map(v => ({ id: v.id, nombre: v.nombre, precio: v.precio ? `+${formatoPrecio(v.precio)}` : null })),
        alCambiar: id => { estado.opciones[o.id] = id; actualizarBoton(); }
      })),
      zonaExtras,
      el('div', { class: 'cantidad', role: 'group', 'aria-label': 'Cantidad' },
        el('span', { class: 'cantidad-etiqueta' }, 'Cantidad'), menos, salidaCantidad, mas)
    ].flat().filter(Boolean));
    dibujarExtras();
    actualizarBoton();
  }

  function agregar() {
    const { menu, temporada } = datos();
    const errores = erroresSeleccion(menu, temporada, seleccion());
    if (errores.producto) { hoja.cerrar(); return; }
    const pendientes = [
      ...(errores.tamano ? [['tamano', errores.tamano]] : []),
      ...Object.entries(errores.opciones ?? {})
    ];
    for (const [clave, texto] of pendientes) {
      const g = grupos[clave];
      g.error.textContent = texto;
      g.error.hidden = false;
    }
    if (pendientes.length) {
      const primero = grupos[pendientes[0][0]].fieldset;
      primero.scrollIntoView({ block: 'center', behavior: 'smooth' });
      primero.querySelector('input')?.focus({ preventScroll: true });
      return;
    }
    const linea = seleccion();
    linea.tamano = tamanoEfectivo(menu, estado.producto, estado.tamano);
    // Los extras se guardan en el orden del menú.
    const orden = extrasDeProducto(menu, estado.categoria, estado.producto, linea.tamano).map(e => e.id);
    linea.extras.sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
    alAgregar(linea, estado.producto);
    hoja.cerrar();
  }

  return {
    abrir(producto, categoria, origen) {
      estado = { producto, categoria, tamano: null, opciones: {}, extras: new Set(), cantidad: 1 };
      hoja.titulo.replaceChildren(...[producto.nombre, producto.detalle ? el('span', { class: 'detalle' }, producto.detalle) : null].filter(Boolean));
      dibujar();
      hoja.abrir(origen);
    }
  };
}
