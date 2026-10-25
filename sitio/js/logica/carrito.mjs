// Carrito: líneas del pedido, precios, sumas y limpieza contra el menú actual. Sin DOM.
// Una línea guardada es: { productoId, tamano, opciones: { opcionId: valorId }, extras: [extraId], cantidad }
import { buscarProducto, tamanosDe, extrasDeProducto, nombreTamano } from './catalogo.mjs';

export const CANTIDAD_MAX = 20;

const minusculas = t => t.toLocaleLowerCase('es-MX');

/** Identifica una combinación: mismo producto, tamaño, opciones y extras (sin importar el orden). */
export function claveLinea(l) {
  const opciones = Object.keys(l.opciones ?? {}).sort().map(k => `${k}=${l.opciones[k]}`).join('&');
  const extras = [...(l.extras ?? [])].sort().join('+');
  return [l.productoId, l.tamano, opciones, extras].join('|');
}

/** Si el producto tiene un solo tamaño, es ese; si tiene varios, el elegido (o null si falta). */
export function tamanoEfectivo(menu, producto, tamano) {
  const tamanos = tamanosDe(menu, producto);
  if (tamanos.length === 1) return tamanos[0];
  return tamanos.includes(tamano) ? tamano : null;
}

/**
 * Lo que falta elegir en la hoja de producto. Devuelve {} si se puede agregar.
 * Forma: { producto?: texto, tamano?: texto, opciones?: { opcionId: texto } }
 */
export function erroresSeleccion(menu, temporada, sel) {
  const hallado = buscarProducto(menu, temporada, sel.productoId);
  if (!hallado || hallado.producto.disponible === false) return { producto: 'Este producto ya no está disponible.' };
  const { producto } = hallado;
  if (producto.agotado) return { producto: 'Este producto está agotado.' };

  const errores = {};
  if (!tamanoEfectivo(menu, producto, sel.tamano)) {
    const nombres = tamanosDe(menu, producto).map(t => minusculas(nombreTamano(menu, t)));
    errores.tamano = `Elige ${nombres.join(' o ')} para continuar.`;
  }
  for (const o of producto.opciones ?? []) {
    if (!o.valores.some(v => v.id === sel.opciones?.[o.id])) (errores.opciones ??= {})[o.id] = `Elige ${minusculas(o.nombre)} para continuar.`;
  }
  return errores;
}

/** Precio de lo elegido en la hoja (por la cantidad), o null si aún no hay tamaño. */
export function precioSeleccion(menu, temporada, sel) {
  const hallado = buscarProducto(menu, temporada, sel.productoId);
  if (!hallado) return null;
  const { producto, categoria } = hallado;
  const tamano = tamanoEfectivo(menu, producto, sel.tamano);
  if (!tamano) return null;
  let unitario = producto.precios[tamano];
  for (const o of producto.opciones ?? []) unitario += o.valores.find(v => v.id === sel.opciones?.[o.id])?.precio ?? 0;
  const permitidos = extrasDeProducto(menu, categoria, producto, tamano);
  for (const id of sel.extras ?? []) unitario += permitidos.find(e => e.id === id)?.precio ?? 0;
  return unitario * (sel.cantidad ?? 1);
}

/**
 * Revisa una línea contra el menú actual y calcula su precio.
 * Devuelve null si ya no se puede pedir (producto retirado o agotado, tamaño, opción o extra que ya no existe…).
 */
export function resolverLinea(menu, temporada, l) {
  if (!l || typeof l !== 'object') return null;
  const hallado = buscarProducto(menu, temporada, l.productoId);
  if (!hallado) return null;
  const { producto, categoria } = hallado;
  if (producto.agotado || producto.disponible === false) return null;
  if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > CANTIDAD_MAX) return null;
  if (!tamanosDe(menu, producto).includes(l.tamano)) return null;

  const elegidas = l.opciones ?? {};
  const opciones = producto.opciones ?? [];
  if (typeof elegidas !== 'object' || Object.keys(elegidas).length !== opciones.length) return null;
  const valores = [];
  for (const o of opciones) {
    const valor = o.valores.find(v => v.id === elegidas[o.id]);
    if (!valor) return null;
    valores.push({ opcion: o, valor });
  }

  const permitidos = extrasDeProducto(menu, categoria, producto, l.tamano);
  const ids = l.extras ?? [];
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return null;
  if (ids.some(id => !permitidos.some(e => e.id === id))) return null;
  const extras = permitidos.filter(e => ids.includes(e.id)); // en el orden del menú

  const precioUnitario = producto.precios[l.tamano]
    + valores.reduce((s, x) => s + (x.valor.precio ?? 0), 0)
    + extras.reduce((s, e) => s + e.precio, 0);
  return {
    clave: claveLinea(l), producto, categoria, tamano: l.tamano, valores, extras,
    cantidad: l.cantidad, precioUnitario, subtotal: precioUnitario * l.cantidad
  };
}

function copiaLinea(l, cantidad) {
  return { productoId: l.productoId, tamano: l.tamano, opciones: { ...(l.opciones ?? {}) }, extras: [...(l.extras ?? [])], cantidad };
}

/** Agrega una línea; si la combinación ya existe, suma la cantidad (con tope). */
export function agregarLinea(lineas, nueva) {
  const clave = claveLinea(nueva);
  const i = lineas.findIndex(l => claveLinea(l) === clave);
  const suma = (i < 0 ? 0 : lineas[i].cantidad) + nueva.cantidad;
  const linea = copiaLinea(nueva, Math.min(suma, CANTIDAD_MAX));
  const resultado = i < 0 ? [...lineas, linea] : lineas.map((l, j) => j === i ? linea : l);
  return { lineas: resultado, topado: suma > CANTIDAD_MAX };
}

/** Suma o resta a una línea; si llega a 0, se quita. */
export function cambiarCantidad(lineas, clave, delta) {
  return lineas
    .map(l => claveLinea(l) === clave ? copiaLinea(l, Math.min(l.cantidad + delta, CANTIDAD_MAX)) : l)
    .filter(l => l.cantidad > 0);
}

/** Quita del carrito guardado lo que ya no se puede pedir. */
export function limpiarCarrito(menu, temporada, lineas) {
  if (!Array.isArray(lineas)) return { lineas: [], quitadas: 0 };
  const validas = lineas.filter(l => resolverLinea(menu, temporada, l)).map(l => copiaLinea(l, l.cantidad));
  return { lineas: validas, quitadas: lineas.length - validas.length };
}

/** Líneas con precio, total y número de piezas. */
export function resumenCarrito(menu, temporada, lineas) {
  const resueltas = lineas.map(l => resolverLinea(menu, temporada, l)).filter(Boolean);
  return {
    lineas: resueltas,
    total: resueltas.reduce((s, r) => s + r.subtotal, 0),
    piezas: resueltas.reduce((s, r) => s + r.cantidad, 0)
  };
}
