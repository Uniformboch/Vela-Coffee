// Carrito: barra y hoja en celular, panel fijo a la derecha en computadora; formulario y envío por WhatsApp.
import { el } from './dom.mjs';
import { crearHoja } from './hoja.mjs';
import { CANTIDAD_MAX, agregarLinea, cambiarCantidad, limpiarCarrito, resumenCarrito } from '../logica/carrito.mjs';
import { ENTREGAS, LIMITES, validarDatos, nombreLinea, eleccionesLinea, armarMensaje, enlaceWhatsApp } from '../logica/pedido.mjs';
import { formatoPrecio } from '../logica/vista.mjs';
import { estaAbierto, HORARIO } from '../logica/horario.mjs';

const CLAVE_CARRITO = 'vela-carrito-v1';
const CLAVE_CLIENTE = 'vela-cliente-v1';

// El almacenamiento del navegador puede no estar disponible (modo privado, bloqueado): nunca debe romper la página.
function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}

/**
 * datos(): { menu, temporada } actuales.  anunciar(texto): aviso para lectores de pantalla.
 */
export function crearCarrito({ datos, anunciar }) {
  const { menu, temporada } = datos();
  const limpio = limpiarCarrito(menu, temporada, leer(CLAVE_CARRITO)?.lineas);
  let lineas = limpio.lineas;
  let avisoQuitadas = limpio.quitadas;
  const guardadoCliente = leer(CLAVE_CLIENTE) ?? {};
  const cliente = { nombre: '', entrega: '', direccion: '', notas: '' };
  for (const k of Object.keys(cliente)) if (typeof guardadoCliente[k] === 'string') cliente[k] = guardadoCliente[k];
  if (!ENTREGAS[cliente.entrega]) cliente.entrega = '';
  if (avisoQuitadas) guardar(CLAVE_CARRITO, { lineas });

  // ---------- Estructura ----------
  const zonaAviso = el('div');
  const zonaLineas = el('div');
  const zonaTotal = el('div');
  const formulario = crearFormulario();
  const vacio = el('p', { class: 'carrito-vacio' }, 'Tu pedido está vacío. Toca un producto del menú para agregarlo.');
  const contenido = el('div', { class: 'carrito' }, zonaAviso, vacio, zonaLineas, zonaTotal, formulario.nodo);

  const tituloPanel = el('h2', { class: 'panel-titulo', id: 'panel-carrito-titulo' }, 'Tu pedido');
  const panel = el('aside', { class: 'panel-carrito', 'aria-labelledby': 'panel-carrito-titulo' }, tituloPanel);
  const hoja = crearHoja({ clase: 'hoja-carrito' });
  hoja.titulo.textContent = 'Tu pedido';
  hoja.pie.remove();

  const barraTexto = el('span', { class: 'barra-carrito-texto' });
  const barraTotal = el('span', { class: 'barra-carrito-total' });
  const barra = el('button', { type: 'button', class: 'barra-carrito', hidden: true, onclick: () => hoja.abrir(barra) }, barraTexto, barraTotal);
  document.body.append(panel, barra);

  const confirmar = crearConfirmacion();

  // En computadora el carrito vive en el panel; en celular, dentro de la hoja.
  const escritorio = matchMedia('(min-width: 1024px)');
  function ubicar() {
    if (escritorio.matches) { hoja.cerrar(); panel.append(contenido); }
    else hoja.cuerpo.append(contenido);
    dibujar();
  }
  escritorio.addEventListener('change', ubicar);

  // ---------- Dibujo ----------
  function dibujar({ foco } = {}) {
    const { menu, temporada } = datos();
    const resumen = resumenCarrito(menu, temporada, lineas);
    const hayAlgo = resumen.lineas.length > 0;

    zonaAviso.replaceChildren(...(avisoQuitadas ? [el('p', { class: 'aviso-info', role: 'status' },
      avisoQuitadas === 1 ? 'Se quitó 1 producto que ya no está disponible.' : `Se quitaron ${avisoQuitadas} productos que ya no están disponibles.`)] : []));

    vacio.hidden = hayAlgo;
    formulario.nodo.hidden = !hayAlgo;

    zonaLineas.replaceChildren(...(hayAlgo ? [el('ul', { class: 'lineas' }, resumen.lineas.map(r => {
      const nombre = nombreLinea(r);
      const elecciones = eleccionesLinea(menu, r);
      return el('li', { class: 'linea-pedido' },
        el('div', { class: 'linea-texto' },
          el('span', { class: 'linea-nombre' }, nombre),
          elecciones.length ? el('span', { class: 'linea-detalle' }, elecciones.join(', ')) : null,
          r.extras.length ? el('span', { class: 'linea-detalle' }, `+ ${r.extras.map(e => e.nombre).join(', ')}`) : null),
        el('div', { class: 'linea-controles' },
          el('button', {
            type: 'button', class: 'boton-cantidad', dataset: { foco: `menos|${r.clave}` },
            'aria-label': r.cantidad === 1 ? `Quitar ${nombre} del pedido` : `Quitar uno: ${nombre}`,
            onclick: () => cambiar(r.clave, -1)
          }, '−'),
          el('span', { class: 'linea-cantidad', 'aria-label': `${r.cantidad} en el pedido` }, String(r.cantidad)),
          el('button', {
            type: 'button', class: 'boton-cantidad', dataset: { foco: `mas|${r.clave}` },
            'aria-label': `Agregar uno: ${nombre}`, disabled: r.cantidad >= CANTIDAD_MAX,
            onclick: () => cambiar(r.clave, +1)
          }, '+'),
          el('span', { class: 'linea-precio' }, formatoPrecio(r.subtotal))));
    }))] : []));

    zonaTotal.replaceChildren(...(hayAlgo ? [el('div', { class: 'total' },
      el('span', {}, 'Total'), el('span', { class: 'total-precio' }, formatoPrecio(resumen.total)))] : []));
    formulario.actualizar();

    // Barra del celular
    barra.hidden = !hayAlgo || escritorio.matches;
    document.documentElement.classList.toggle('con-barra-carrito', !barra.hidden);
    barraTexto.textContent = `${resumen.piezas} · Ver pedido`;
    barraTotal.textContent = formatoPrecio(resumen.total);
    barra.setAttribute('aria-label', `Ver pedido: ${resumen.piezas} ${resumen.piezas === 1 ? 'producto' : 'productos'}, total ${formatoPrecio(resumen.total)}`);

    // Si la hoja quedó vacía en el celular, se cierra.
    if (!hayAlgo && hoja.abierta) hoja.cerrar();

    if (foco) {
      const destino = contenido.querySelector(`[data-foco="${CSS.escape(foco)}"]`);
      if (destino && !destino.disabled) destino.focus();
      else (contenido.querySelector('.boton-cantidad:not(:disabled)') ?? (escritorio.matches ? tituloPanel : hoja.titulo)).focus?.();
    }
    return resumen;
  }

  function cambiar(clave, delta) {
    const antes = lineas.length;
    lineas = cambiarCantidad(lineas, clave, delta);
    avisoQuitadas = 0;
    guardar(CLAVE_CARRITO, { lineas });
    const signo = delta < 0 ? 'menos' : 'mas';
    dibujar({ foco: `${signo}|${clave}` });
    if (lineas.length < antes) anunciar('Producto quitado del pedido.');
  }

  // ---------- Formulario ----------
  function crearFormulario() {
    const campos = {};
    const errores = {};
    const mensajeError = clave => (errores[clave] = el('p', { class: 'error', id: `error-${clave}-pedido`, hidden: true }));

    const alEscribir = clave => ev => {
      cliente[clave] = ev.target.value;
      guardar(CLAVE_CLIENTE, cliente);
      ocultar(clave);
    };
    function ocultar(clave) {
      errores[clave].hidden = true;
      errores[clave].textContent = '';
      campos[clave]?.removeAttribute?.('aria-invalid');
    }

    campos.nombre = el('input', {
      id: 'pedido-nombre', type: 'text', autocomplete: 'name', maxlength: LIMITES.nombre, required: true,
      'aria-describedby': 'error-nombre-pedido', oninput: alEscribir('nombre')
    });
    campos.nombre.value = cliente.nombre;

    const radios = Object.entries(ENTREGAS).map(([valor, texto]) => {
      const input = el('input', {
        type: 'radio', name: 'entrega', value: valor, checked: cliente.entrega === valor,
        onchange: () => { cliente.entrega = valor; guardar(CLAVE_CLIENTE, cliente); ocultar('entrega'); actualizar(); }
      });
      return { input, label: el('label', { class: 'opcion' }, input, el('span', { class: 'opcion-nombre' }, texto)) };
    });
    campos.entrega = radios[0].input;

    campos.direccion = el('textarea', {
      id: 'pedido-direccion', rows: 2, autocomplete: 'street-address', maxlength: LIMITES.direccion,
      'aria-describedby': 'nota-envio error-direccion-pedido', oninput: alEscribir('direccion')
    });
    campos.direccion.value = cliente.direccion;
    const bloqueDireccion = el('div', { class: 'campo' },
      el('label', { for: 'pedido-direccion' }, 'Dirección de entrega'),
      campos.direccion,
      el('p', { class: 'nota', id: 'nota-envio' }, 'El costo de envío se confirma por WhatsApp.'),
      mensajeError('direccion'));

    campos.notas = el('textarea', {
      id: 'pedido-notas', rows: 2, maxlength: LIMITES.notas, placeholder: 'Ej. sin azúcar, leche deslactosada…',
      'aria-describedby': 'error-notas-pedido', oninput: alEscribir('notas')
    });
    campos.notas.value = cliente.notas;

    const avisoHorario = el('p', { class: 'aviso-horario', hidden: true },
      `Ahora estamos cerrados (${HORARIO.texto}). Puedes enviar tu pedido y te responderemos al abrir.`);

    const nodo = el('form', { class: 'formulario', novalidate: true, onsubmit: enviar },
      el('h3', { class: 'formulario-titulo' }, 'Tus datos'),
      el('div', { class: 'campo' },
        el('label', { for: 'pedido-nombre' }, 'Nombre'),
        campos.nombre, mensajeError('nombre')),
      el('fieldset', { class: 'grupo-opcion', 'aria-describedby': 'error-entrega-pedido' },
        el('legend', {}, 'Entrega'),
        radios.map(r => r.label),
        mensajeError('entrega')),
      bloqueDireccion,
      el('div', { class: 'campo' },
        el('label', { for: 'pedido-notas' }, 'Notas ', el('span', { class: 'opcional' }, 'Opcional')),
        campos.notas, mensajeError('notas')),
      avisoHorario,
      el('button', { type: 'submit', class: 'boton-principal boton-whatsapp' }, 'Enviar pedido por WhatsApp'));

    function actualizar() {
      bloqueDireccion.hidden = cliente.entrega !== 'domicilio';
      avisoHorario.hidden = estaAbierto();
    }

    function mostrarErrores(lista) {
      for (const [clave, texto] of Object.entries(lista)) {
        errores[clave].textContent = texto;
        errores[clave].hidden = false;
        if (clave !== 'entrega') campos[clave].setAttribute('aria-invalid', 'true');
      }
      // El cursor va al primer campo con error, en el orden del formulario.
      const primero = ['nombre', 'entrega', 'direccion', 'notas'].find(c => lista[c]);
      if (primero) {
        const destino = primero === 'entrega' ? (radios.find(r => r.input.checked) ?? radios[0]).input : campos[primero];
        destino.focus();
      }
    }

    return { nodo, actualizar, mostrarErrores };
  }

  function enviar(ev) {
    ev.preventDefault();
    const errores = validarDatos(cliente);
    if (Object.keys(errores).length) { formulario.mostrarErrores(errores); return; }
    const { menu, temporada } = datos();
    const resumen = resumenCarrito(menu, temporada, lineas);
    if (!resumen.lineas.length) return;
    const url = enlaceWhatsApp(menu.config.whatsapp, armarMensaje(menu, resumen, cliente));
    window.open(url, '_blank', 'noopener');
    confirmar.abrir(url);
  }

  // ---------- "¿Ya enviaste tu pedido?" ----------
  function crearConfirmacion() {
    const h = crearHoja({ clase: 'hoja-confirmar' });
    h.titulo.textContent = '¿Ya enviaste tu pedido?';
    h.pie.remove();
    let url = '';
    h.cuerpo.append(
      el('p', {}, 'Si WhatsApp no se abrió, toca «Abrir WhatsApp».'),
      el('div', { class: 'botones-confirmar' },
        el('button', { type: 'button', class: 'boton-principal', onclick: nuevoPedido }, 'Sí, empezar otro pedido'),
        el('button', { type: 'button', class: 'boton-sec', onclick: () => window.open(url, '_blank', 'noopener') }, 'Abrir WhatsApp'),
        el('button', { type: 'button', class: 'boton-sec', onclick: () => h.cerrar() }, 'Volver a mi pedido')));

    function nuevoPedido() {
      lineas = [];
      avisoQuitadas = 0;
      cliente.notas = '';
      guardar(CLAVE_CARRITO, { lineas });
      guardar(CLAVE_CLIENTE, cliente);
      formulario.nodo.querySelector('#pedido-notas').value = '';
      h.cerrar();
      hoja.cerrar();
      dibujar();
      anunciar('Listo. Puedes empezar otro pedido.');
      document.getElementById('menu')?.focus();
    }

    return { abrir(nuevaUrl) { url = nuevaUrl; h.abrir(); } };
  }

  ubicar();

  return {
    agregar(linea) {
      const r = agregarLinea(lineas, linea);
      lineas = r.lineas;
      avisoQuitadas = 0;
      guardar(CLAVE_CARRITO, { lineas });
      dibujar();
      anunciar(r.topado ? `Se agregó al pedido (máximo ${CANTIDAD_MAX} por producto).` : 'Se agregó al pedido.');
      // Pequeño aviso visual en la barra del celular.
      barra.classList.remove('rebote');
      void barra.offsetWidth;
      barra.classList.add('rebote');
    }
  };
}
