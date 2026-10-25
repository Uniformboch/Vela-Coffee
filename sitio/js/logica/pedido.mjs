// Datos del cliente, texto de cada línea y mensaje de WhatsApp. Sin DOM.
import { nombreEnPedido, nombreTamano, UNICO } from './catalogo.mjs';
import { formatoPrecio } from './vista.mjs';

export const ENTREGAS = { llevar: 'Para llevar', domicilio: 'A domicilio' };
export const LIMITES = { nombre: 60, direccion: 200, notas: 300 };

// Quita espacios de más y saltos de línea (el mensaje lleva un dato por renglón).
const limpio = t => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Errores del formulario por campo; {} si está completo. */
export function validarDatos(datos) {
  const errores = {};
  const nombre = limpio(datos.nombre), direccion = limpio(datos.direccion), notas = limpio(datos.notas);
  if (!nombre) errores.nombre = 'Escribe tu nombre.';
  else if (nombre.length > LIMITES.nombre) errores.nombre = `El nombre es muy largo (máximo ${LIMITES.nombre} letras).`;
  if (!ENTREGAS[datos.entrega]) errores.entrega = 'Elige para llevar o a domicilio.';
  if (datos.entrega === 'domicilio') {
    if (!direccion) errores.direccion = 'Escribe la dirección de entrega.';
    else if (direccion.length > LIMITES.direccion) errores.direccion = `La dirección es muy larga (máximo ${LIMITES.direccion} letras).`;
  }
  if (notas.length > LIMITES.notas) errores.notas = `Las notas son muy largas (máximo ${LIMITES.notas} letras).`;
  return errores;
}

/** "Molletes 2 pz", con el prefijo de la categoría si tiene. */
export function nombreLinea(r) {
  const nombre = nombreEnPedido(r.categoria, r.producto);
  return r.producto.detalle ? `${nombre} ${r.producto.detalle}` : nombre;
}

/** Lo que va entre paréntesis: tamaño (si no es precio único) y opciones elegidas. */
export function eleccionesLinea(menu, r) {
  return [r.tamano === UNICO ? null : nombreTamano(menu, r.tamano), ...r.valores.map(x => x.valor.nombre)].filter(Boolean);
}

/** "• 2 × Americano (Frío) + Leche vegetal — $134" */
export function textoLinea(menu, r) {
  const elecciones = eleccionesLinea(menu, r);
  return `• ${r.cantidad} × ${nombreLinea(r)}`
    + (elecciones.length ? ` (${elecciones.join(', ')})` : '')
    + (r.extras.length ? ` + ${r.extras.map(e => e.nombre).join(', ')}` : '')
    + ` — ${formatoPrecio(r.subtotal)}`;
}

/** Mensaje completo para WhatsApp. resumen viene de resumenCarrito(). */
export function armarMensaje(menu, resumen, datos) {
  const renglones = [
    `Hola, ${menu.config.negocio}. Quiero hacer un pedido:`,
    '',
    ...resumen.lineas.map(r => textoLinea(menu, r)),
    '',
    `*Total: ${formatoPrecio(resumen.total)}*`,
    '',
    `Nombre: ${limpio(datos.nombre)}`,
    `Entrega: ${ENTREGAS[datos.entrega]}`
  ];
  if (datos.entrega === 'domicilio') renglones.push(`Dirección: ${limpio(datos.direccion)}`, 'Envío: por confirmar');
  if (limpio(datos.notas)) renglones.push(`Notas: ${limpio(datos.notas)}`);
  return renglones.join('\n');
}

export function enlaceWhatsApp(numero, mensaje) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
