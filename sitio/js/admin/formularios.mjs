// Piezas de formulario del panel: campos con etiqueta, precios, casillas, listas de errores.
import { el } from '../ui/dom.mjs';

let contador = 0;
export const nuevoId = prefijo => `${prefijo}-${++contador}`;

export function campo(etiqueta, control, { nota, opcional = false } = {}) {
  if (!control.id) control.id = nuevoId('campo');
  let idNota = null;
  if (nota) {
    idNota = nuevoId('nota');
    control.setAttribute('aria-describedby', idNota);
  }
  return el('div', { class: 'campo' },
    el('label', { for: control.id }, etiqueta, opcional ? [' ', el('span', { class: 'opcional' }, 'Opcional')] : null),
    control,
    nota ? el('p', { class: 'nota', id: idNota }, nota) : null);
}

/** etiqueta: nombre para lectores de pantalla cuando el campo no tiene <label> visible. */
export function texto(valor, { max = 80, placeholder, etiqueta, alEscribir } = {}) {
  const input = el('input', { type: 'text', maxlength: max, placeholder, 'aria-label': etiqueta, autocomplete: 'off', oninput: alEscribir });
  input.value = valor ?? '';
  return input;
}

export function areaTexto(valor, { max = 400, filas = 3, placeholder, alEscribir } = {}) {
  const area = el('textarea', { rows: filas, maxlength: max, placeholder, oninput: alEscribir });
  area.value = valor ?? '';
  return area;
}

export function entradaPrecio(valor, atributos = {}) {
  const input = el('input', { type: 'text', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', class: 'entrada-precio', ...atributos });
  input.value = valor ?? '';
  return input;
}

/** null si está vacío, NaN si no es un entero de 1 a 9999. */
export function leerPrecio(valor) {
  const t = String(valor ?? '').trim().replace(/^\$/, '');
  if (!t) return null;
  return /^\d{1,4}$/.test(t) && Number(t) >= 1 ? Number(t) : NaN;
}

export function casilla(etiqueta, marcada, { interruptor = false, alCambiar, ariaLabel } = {}) {
  const input = el('input', {
    type: 'checkbox', checked: !!marcada, role: interruptor ? 'switch' : null, 'aria-label': ariaLabel,
    onchange: alCambiar
  });
  return { input, nodo: el('label', { class: interruptor ? 'interruptor' : 'opcion' }, input, el('span', { class: 'opcion-nombre' }, etiqueta)) };
}

/** Grupo de botones de opción. opciones: [{ valor, texto }] */
export function grupoRadios(leyenda, opciones, actual, alCambiar) {
  const nombre = nuevoId('radio');
  const inputs = opciones.map(o => el('input', { type: 'radio', name: nombre, value: o.valor, checked: o.valor === actual, onchange: () => alCambiar(o.valor) }));
  const nodo = el('fieldset', { class: 'grupo-opcion' },
    el('legend', {}, leyenda),
    opciones.map((o, i) => el('label', { class: 'opcion' }, inputs[i], el('span', { class: 'opcion-nombre' }, o.texto))));
  return { nodo, valor: () => inputs.find(i => i.checked)?.value ?? null };
}

export function selector(opciones, actual, atributos = {}) {
  const sel = el('select', atributos, opciones.map(o => el('option', { value: o.valor }, o.texto)));
  sel.value = actual;
  return sel;
}

/** Caja de errores: se llena con mostrarErrores(caja, lista) y recibe el foco. */
export function cajaErrores() {
  return el('div', { class: 'adm-errores', role: 'alert', tabindex: '-1', hidden: true });
}
export function mostrarErrores(caja, lista, titulo = 'Revisa esto:') {
  caja.replaceChildren(el('p', {}, el('strong', {}, titulo)), el('ul', {}, lista.map(e => el('li', {}, e))));
  caja.hidden = false;
  caja.scrollIntoView({ block: 'nearest' });
  caja.focus();
}
export function ocultarErrores(caja) {
  caja.hidden = true;
  caja.replaceChildren();
}
