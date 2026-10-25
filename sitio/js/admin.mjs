// Panel del dueño: entrar, pestañas, listas de productos, guardar, respaldos.
import { el } from './ui/dom.mjs';
import { crearHoja } from './ui/hoja.mjs';
import { formatoPrecio, formatoTelefono } from './logica/vista.mjs';
import { productosVisibles } from './logica/catalogo.mjs';
import { api, ErrorSesion } from './admin/api.mjs';
import { campo, texto, areaTexto, casilla, nuevoId, cajaErrores, mostrarErrores, ocultarErrores } from './admin/formularios.mjs';
import { crearEditores } from './admin/editores.mjs';

const app = document.getElementById('app');
const avisos = document.getElementById('avisos');
const botonSalir = document.getElementById('salir');
const barraGuardar = document.getElementById('barra-guardar');
const botonGuardar = document.getElementById('guardar');
const botonDescartar = document.getElementById('descartar');

const PESTANAS = [
  { id: 'bebidas', nombre: 'Bebidas' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'temporada', nombre: 'Temporada' },
  { id: 'extras', nombre: 'Extras' },
  { id: 'ajustes', nombre: 'Ajustes' }
];

let datos = null;      // { menu, temporada } en edición
let original = '';     // lo último guardado, para saber si hay cambios
let version = null;    // versión del servidor (para detectar si otro dispositivo guardó)
let pestana = 'bebidas';
let guardando = false;

const hayCambios = () => datos !== null && JSON.stringify(datos) !== original;

function anunciar(textoAviso) {
  avisos.textContent = '';
  setTimeout(() => { avisos.textContent = textoAviso; }, 50);
}

let temporizadorToast;
function toast(textoAviso) {
  let nodo = document.querySelector('.adm-toast');
  if (!nodo) { nodo = el('div', { class: 'adm-toast' }); document.body.append(nodo); }
  nodo.textContent = textoAviso;
  nodo.classList.add('visible');
  anunciar(textoAviso);
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => nodo.classList.remove('visible'), 4000);
}

// ---------- Entrar ----------
function formularioEntrar({ mensaje, alEntrar }) {
  // Sin mayúscula automática ni autocorrector: en algunos teclados de celular cambiaban la contraseña.
  const input = el('input', {
    type: 'password', id: nuevoId('contrasena'), autocomplete: 'current-password', maxlength: 200, required: true,
    autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false'
  });
  const error = el('p', { class: 'error', role: 'alert', hidden: true });
  const boton = el('button', { type: 'submit', class: 'boton-principal' }, 'Entrar');
  let cuenta;
  function mostrarError(t) { error.textContent = t; error.hidden = false; }
  async function enviar(ev) {
    ev.preventDefault();
    if (!input.value) { mostrarError('Escribe la contraseña.'); input.focus(); return; }
    boton.disabled = true;
    boton.textContent = 'Entrando…';
    try {
      await api.entrar(input.value);
      input.value = '';
      await alEntrar();
    } catch (e) {
      mostrarError(e.errores?.join(' ') ?? 'No se pudo entrar. Intenta de nuevo.');
      input.select();
      if (e.datos?.espera) {
        // Cuenta regresiva del bloqueo
        let s = e.datos.espera;
        clearInterval(cuenta);
        boton.disabled = true;
        cuenta = setInterval(() => {
          s--;
          boton.textContent = s > 0 ? `Espera ${s} s` : 'Entrar';
          if (s <= 0) { clearInterval(cuenta); boton.disabled = false; }
        }, 1000);
        boton.textContent = `Espera ${s} s`;
        return;
      }
    }
    boton.disabled = false;
    boton.textContent = 'Entrar';
  }
  const form = el('form', { class: 'adm-login', onsubmit: enviar },
    mensaje ? el('p', {}, mensaje) : null,
    campo('Contraseña', input), error, boton);
  return { form, input };
}

function mostrarEntrada() {
  botonSalir.hidden = true;
  barraGuardar.hidden = true;
  const { form, input } = formularioEntrar({ alEntrar: cargar });
  app.replaceChildren(el('section', { class: 'adm-tarjeta' }, el('h2', {}, 'Entrar al panel'), form));
  input.focus();
}

// Si la sesión vence a media edición, se pide entrar sin perder los cambios y se reintenta.
const hojaEntrar = crearHoja({ clase: 'hoja-entrar' });
hojaEntrar.titulo.textContent = 'Entra otra vez';
hojaEntrar.pie.remove();
function pedirEntrar(reintentar) {
  const { form, input } = formularioEntrar({
    mensaje: 'Tu sesión venció. Tus cambios siguen aquí: entra otra vez para continuar.',
    alEntrar: async () => { hojaEntrar.cerrar(); await reintentar?.(); }
  });
  hojaEntrar.cuerpo.replaceChildren(form);
  hojaEntrar.abrir();
  input.focus();
}

// ---------- Cargar y guardar ----------
async function cargar() {
  app.replaceChildren(el('p', { class: 'estado' }, 'Cargando menú…'));
  try {
    const r = await api.leerMenu();
    datos = { menu: r.menu, temporada: r.temporada };
    original = JSON.stringify(datos);
    version = r.version;
    botonSalir.hidden = false;
    dibujarPanel();
  } catch (e) {
    if (e instanceof ErrorSesion) return mostrarEntrada();
    app.replaceChildren(el('div', { class: 'adm-tarjeta' },
      el('p', { role: 'alert' }, e.errores?.join(' ') ?? 'No se pudo cargar el menú.'),
      el('button', { type: 'button', class: 'boton-principal', onclick: cargar }, 'Reintentar')));
  }
}

function actualizarBarra() {
  barraGuardar.hidden = !hayCambios();
  document.documentElement.classList.toggle('con-barra-guardar', !barraGuardar.hidden);
}

async function guardar() {
  if (guardando || !hayCambios()) return;
  guardando = true;
  botonGuardar.disabled = true;
  botonGuardar.textContent = 'Guardando…';
  ocultarErrores(mensajes);
  try {
    const r = await api.guardarMenu({ menu: datos.menu, temporada: datos.temporada, version });
    version = r.version;
    original = JSON.stringify(datos);
    actualizarBarra();
    toast('Guardado. El menú ya está actualizado.');
  } catch (e) {
    if (e instanceof ErrorSesion) pedirEntrar(guardar);
    else if (e.datos?.conflicto) mostrarConflicto();
    else mostrarErrores(mensajes, e.errores ?? ['No se pudo guardar.'], 'No se guardó. Corrige esto:');
  } finally {
    guardando = false;
    botonGuardar.disabled = false;
    botonGuardar.textContent = 'Guardar';
  }
}

function descartar() {
  if (!confirm('¿Descartar todos los cambios sin guardar?')) return;
  datos = JSON.parse(original);
  ocultarErrores(mensajes);
  dibujarPestana();
  actualizarBarra();
  toast('Cambios descartados.');
}

function mostrarConflicto() {
  mensajes.replaceChildren(
    el('p', {}, el('strong', {}, 'El menú se cambió desde otro dispositivo.')),
    el('p', {}, 'Para no borrar esos cambios, recarga el menú. Lo que no hayas guardado aquí se perderá.'),
    el('button', { type: 'button', class: 'boton-principal', onclick: () => { if (!hayCambios() || confirm('Se perderán tus cambios sin guardar. ¿Recargar?')) cargar(); } }, 'Recargar el menú'));
  mensajes.hidden = false;
  mensajes.focus();
}

botonGuardar.addEventListener('click', guardar);
botonDescartar.addEventListener('click', descartar);
addEventListener('beforeunload', e => { if (hayCambios()) { e.preventDefault(); e.returnValue = ''; } });

botonSalir.addEventListener('click', async () => {
  if (hayCambios() && !confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return;
  await api.salir().catch(() => {});
  datos = null;
  mostrarEntrada();
});

// ---------- Panel ----------
const mensajes = cajaErrores();
const editores = crearEditores({
  trabajo: () => datos,
  alCambiar: () => { dibujarPestana(); actualizarBarra(); },
  alSesionVencida: () => pedirEntrar()
});
let pestanasNodo, panel;

function dibujarPanel() {
  const botones = PESTANAS.map(p => el('button', {
    type: 'button', role: 'tab', id: `tab-${p.id}`, 'aria-controls': 'adm-panel',
    onclick: () => cambiarPestana(p.id),
    onkeydown: e => {
      const i = PESTANAS.findIndex(x => x.id === pestana);
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); cambiarPestana(PESTANAS[(i + d + PESTANAS.length) % PESTANAS.length].id, true); }
    }
  }, p.nombre));
  pestanasNodo = el('div', { class: 'adm-pestanas', role: 'tablist', 'aria-label': 'Secciones del panel' }, botones);
  panel = el('section', { class: 'adm-panel', id: 'adm-panel', role: 'tabpanel', tabindex: '-1' });
  app.replaceChildren(pestanasNodo, mensajes, panel);
  cambiarPestana(pestana);
  actualizarBarra();
}

function cambiarPestana(id, enfocar = false) {
  pestana = id;
  for (const b of pestanasNodo.children) {
    const activa = b.id === `tab-${id}`;
    b.setAttribute('aria-selected', String(activa));
    b.tabIndex = activa ? 0 : -1;
    if (activa && enfocar) b.focus();
  }
  panel.setAttribute('aria-labelledby', `tab-${id}`);
  dibujarPestana();
}

function dibujarPestana() {
  if (!panel) return;
  const y = scrollY;
  const contenido = { bebidas: () => vistaGrupo('bebidas'), comida: () => vistaGrupo('comida'), temporada: vistaTemporada, extras: vistaExtras, ajustes: vistaAjustes }[pestana]();
  panel.replaceChildren(...[contenido].flat(Infinity).filter(Boolean));
  scrollTo(0, y);
}

function resumenPrecios(menu, p) {
  if ('unico' in p.precios) return formatoPrecio(p.precios.unico);
  return Object.keys(menu.tamanos).filter(t => p.precios[t] != null).map(t => `${menu.tamanos[t].nombre} ${formatoPrecio(p.precios[t])}`).join(' · ');
}

function filaProducto(categoria, p, esTemporada = false) {
  const fila = el('li', { class: `adm-prod${p.agotado ? ' agotado' : ''}` });
  const interruptor = casilla('Agotado', p.agotado, {
    interruptor: true, ariaLabel: `Agotado: ${p.nombre}`,
    alCambiar: e => {
      if (e.target.checked) p.agotado = true; else delete p.agotado;
      fila.classList.toggle('agotado', e.target.checked);
      actualizarBarra();
    }
  });
  fila.append(
    el('button', {
      type: 'button', class: 'adm-prod-abrir',
      onclick: e => esTemporada ? editores.productoTemporada(p, e.currentTarget) : editores.producto(categoria, p, e.currentTarget)
    },
    el('span', { class: 'adm-prod-nombre' }, p.nombre, p.detalle ? el('span', { class: 'detalle' }, ` ${p.detalle}`) : null,
      p.disponible === false ? el('span', { class: 'etiqueta' }, 'Oculto') : null),
    el('span', { class: 'adm-prod-precio' }, resumenPrecios(datos.menu, p))),
    interruptor.nodo);
  return fila;
}

function vistaGrupo(grupo) {
  const categorias = datos.menu.categorias.filter(c => c.grupo === grupo);
  return [
    el('p', { class: 'nota adm-ayuda' }, 'Toca un producto para editarlo. El interruptor "Agotado" lo marca en gris en el menú. Nada se publica hasta tocar "Guardar".'),
    categorias.length ? categorias.map(c => el('section', { class: 'adm-cat' },
      el('div', { class: 'adm-cat-cabecera' },
        el('h2', {}, c.nombre),
        el('button', { type: 'button', class: 'boton-sec boton-chico', onclick: e => editores.categoria(grupo, c, e.currentTarget) }, 'Editar categoría')),
      c.descripcion ? el('p', { class: 'nota' }, c.descripcion) : null,
      c.productos.length ? el('ul', { class: 'adm-lista' }, c.productos.map(p => filaProducto(c, p))) : el('p', { class: 'nota' }, 'Sin productos. Esta categoría no se ve en el menú hasta que tenga alguno.'),
      el('button', { type: 'button', class: 'boton-sec adm-agregar', onclick: e => editores.producto(c, null, e.currentTarget) }, '+ Agregar producto')))
      : el('p', { class: 'nota' }, 'No hay categorías en esta sección.'),
    el('button', { type: 'button', class: 'boton-sec adm-agregar adm-agregar-cat', onclick: e => editores.categoria(grupo, null, e.currentTarget) }, '+ Agregar categoría')
  ];
}

function vistaTemporada() {
  const t = datos.temporada;
  const c = t.categoria;
  const activa = casilla('Mostrar la temporada en el menú', t.activa, {
    interruptor: true,
    alCambiar: e => { t.activa = e.target.checked; actualizarBarra(); dibujarPestana(); }
  });
  const sinProductos = t.activa && productosVisibles(c).length === 0;
  return [
    el('section', { class: 'adm-cat' },
      activa.nodo,
      sinProductos ? el('p', { class: 'aviso-info' }, 'La sección no se verá en el menú hasta que tenga al menos un producto visible.') : null,
      campo('Título de la sección', texto(c.nombre, { max: 80, alEscribir: e => { c.nombre = e.target.value; actualizarBarra(); } })),
      campo('Descripción', areaTexto(c.descripcion, { max: 200, filas: 2, placeholder: 'Ej. Solo por tiempo limitado', alEscribir: e => { if (e.target.value.trim()) c.descripcion = e.target.value; else delete c.descripcion; actualizarBarra(); } }), { opcional: true })),
    el('section', { class: 'adm-cat' },
      el('h2', {}, 'Productos de temporada'),
      c.productos.length ? el('ul', { class: 'adm-lista' }, c.productos.map(p => filaProducto(c, p, true))) : el('p', { class: 'nota' }, 'Aún no hay productos de temporada.'),
      el('button', { type: 'button', class: 'boton-sec adm-agregar', onclick: e => editores.productoTemporada(null, e.currentTarget) }, '+ Agregar producto de temporada'))
  ];
}

function vistaExtras() {
  const { menu } = datos;
  const nombreTamanos = e => e.tamanos ? ` · solo ${e.tamanos.map(t => t === 'unico' ? 'precio único' : menu.tamanos[t]?.nombre.toLowerCase()).join(', ')}` : '';
  return [
    el('p', { class: 'nota adm-ayuda' }, 'Los extras se suman al precio del producto. Toca uno para cambiar su precio o dónde se ofrece.'),
    el('ul', { class: 'adm-lista' }, menu.extras.map(e => {
      const cats = menu.categorias.filter(c => (c.extrasPermitidos ?? []).includes(e.id)).map(c => c.nombre);
      return el('li', { class: 'adm-prod' },
        el('button', { type: 'button', class: 'adm-prod-abrir', onclick: ev => editores.extra(e, ev.currentTarget) },
          el('span', { class: 'adm-prod-nombre' }, e.nombre),
          el('span', { class: 'adm-prod-precio' }, `+${formatoPrecio(e.precio)}${nombreTamanos(e)}`),
          el('span', { class: 'adm-prod-detalle' }, cats.length ? `En: ${cats.join(', ')}` : 'En ninguna categoría (solo productos con lista propia)')));
    })),
    el('button', { type: 'button', class: 'boton-sec adm-agregar', onclick: e => editores.extra(null, e.currentTarget) }, '+ Agregar extra')
  ];
}

function vistaAjustes() {
  const { config } = datos.menu;
  const negocio = texto(config.negocio, { max: 80, alEscribir: e => { config.negocio = e.target.value; actualizarBarra(); } });
  const errorTel = el('p', { class: 'error', hidden: true, id: 'error-whatsapp' });
  const telefono = el('input', {
    type: 'tel', inputmode: 'numeric', maxlength: 10, autocomplete: 'off', 'aria-describedby': 'error-whatsapp',
    oninput: e => {
      const d = e.target.value.replace(/\D/g, '');
      if (/^\d{10}$/.test(d)) {
        config.whatsapp = `52${d}`;
        errorTel.hidden = true;
      } else {
        errorTel.textContent = 'Escribe los 10 dígitos del número (sin el 52).';
        errorTel.hidden = false;
      }
      actualizarBarra();
    }
  });
  telefono.value = config.whatsapp.replace(/^52/, '');
  telefono.id = nuevoId('whatsapp');

  const listaRespaldos = el('div', {}, el('p', { class: 'nota' }, 'Cargando respaldos…'));
  cargarRespaldos(listaRespaldos);

  return [
    el('section', { class: 'adm-cat' },
      el('h2', {}, 'Datos del café'),
      campo('Nombre del negocio (aparece en el mensaje de WhatsApp)', negocio),
      el('div', { class: 'campo' },
        el('label', { for: telefono.id }, 'WhatsApp para pedidos'),
        el('div', { class: 'adm-telefono' }, el('span', { 'aria-hidden': 'true' }, '+52'), telefono),
        el('p', { class: 'nota' }, `Ahora: ${formatoTelefono(config.whatsapp)}. Los pedidos llegarán a este número.`),
        errorTel)),
    el('section', { class: 'adm-cat' },
      el('h2', {}, 'Respaldos'),
      el('p', { class: 'nota' }, 'Cada vez que guardas, se guarda una copia de la versión anterior (las últimas 60). Si algo salió mal, restaura una.'),
      listaRespaldos),
    el('section', { class: 'adm-cat' },
      el('h2', {}, 'Sesión'),
      el('button', { type: 'button', class: 'boton-sec', onclick: () => botonSalir.click() }, 'Cerrar sesión'))
  ];
}

const formatoFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' });

async function cargarRespaldos(contenedor) {
  try {
    const { respaldos } = await api.respaldos();
    contenedor.replaceChildren(respaldos.length
      ? el('ul', { class: 'adm-lista' }, respaldos.map(r => el('li', { class: 'adm-prod' },
        el('span', { class: 'adm-prod-nombre adm-respaldo' }, formatoFecha.format(new Date(r.fecha))),
        el('button', { type: 'button', class: 'boton-sec boton-chico', onclick: () => restaurar(r) }, 'Restaurar'))))
      : el('p', { class: 'nota' }, 'Aún no hay respaldos: se crean al guardar.'));
  } catch (e) {
    if (e instanceof ErrorSesion) return pedirEntrar(() => cargarRespaldos(contenedor));
    contenedor.replaceChildren(el('p', { class: 'error' }, e.errores?.join(' ') ?? 'No se pudieron cargar los respaldos.'));
  }
}

async function restaurar(respaldo) {
  if (hayCambios()) { mostrarErrores(mensajes, ['Guarda o descarta tus cambios antes de restaurar un respaldo.'], 'Antes de restaurar:'); return; }
  if (!confirm(`¿Restaurar el menú como estaba el ${formatoFecha.format(new Date(respaldo.fecha))}? El menú actual quedará respaldado.`)) return;
  try {
    const r = await api.restaurar(respaldo.id, version);
    datos = { menu: r.menu, temporada: r.temporada };
    original = JSON.stringify(datos);
    version = r.version;
    dibujarPestana();
    actualizarBarra();
    toast('Respaldo restaurado. El menú ya está actualizado.');
  } catch (e) {
    if (e instanceof ErrorSesion) pedirEntrar(() => restaurar(respaldo));
    else if (e.datos?.conflicto) mostrarConflicto();
    else mostrarErrores(mensajes, e.errores ?? ['No se pudo restaurar.']);
  }
}

// ---------- Inicio ----------
(async () => {
  try {
    const s = await api.sesion();
    if (!s.configurado) {
      app.replaceChildren(el('section', { class: 'adm-tarjeta' },
        el('h2', {}, s.problemas ? 'La contraseña del panel quedó mal configurada' : 'El panel aún no tiene contraseña'),
        s.problemas
          ? el('ul', {}, s.problemas.map(p => el('li', {}, p)))
          : el('p', {}, 'Falta configurar la contraseña del panel en Netlify. Sigue la guía de instalación.')));
      return;
    }
    if (s.sesion) await cargar(); else mostrarEntrada();
  } catch (e) {
    app.replaceChildren(el('section', { class: 'adm-tarjeta' }, el('p', { role: 'alert' }, e.errores?.join(' ') ?? 'No se pudo abrir el panel.')));
  }
})();
