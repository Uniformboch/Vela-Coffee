// Arranque del menú público: carga los datos, dibuja y conecta la navegación.
import { el } from './ui/dom.mjs';
import { armarVista, formatoTelefono } from './logica/vista.mjs';
import { dibujarMenu } from './ui/render-menu.mjs';
import { iniciarNavegacion } from './ui/navegacion.mjs';
import { crearHojaProducto } from './ui/hoja-producto.mjs';
import { crearCarrito } from './ui/carrito.mjs';

const contenedor = document.getElementById('menu');
const avisos = document.getElementById('avisos');
let datos = null; // { menu, temporada }

// Avisos para lectores de pantalla (se vacía y se vuelve a llenar para que siempre se lea).
function anunciar(texto) {
  avisos.textContent = '';
  setTimeout(() => { avisos.textContent = texto; }, 50);
}

async function pedirJson(ruta) {
  const r = await fetch(ruta, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

let hojaProducto = null;
function alElegir(producto, categoria, origen) {
  hojaProducto?.abrir(producto, categoria, origen);
}

function mostrarError() {
  contenedor.replaceChildren(
    el('p', { class: 'estado', role: 'alert' },
      'No se pudo cargar el menú. Revisa tu conexión.',
      el('button', { type: 'button', onclick: cargar }, 'Reintentar')));
}

async function cargar() {
  contenedor.replaceChildren(el('p', { class: 'estado', role: 'status' }, 'Cargando menú…'));
  let menu, temporada;
  try {
    [menu, temporada] = await Promise.all([
      pedirJson('/menu.json'),
      // Si la temporada falla, el menú se muestra sin ella.
      pedirJson('/menu-temporada.json').catch(() => ({ activa: false }))
    ]);
  } catch (e) {
    console.warn('No se pudo cargar el menú', e);
    return mostrarError();
  }

  datos = { menu, temporada };
  const carrito = crearCarrito({ datos: () => datos, anunciar });
  hojaProducto = crearHojaProducto({ datos: () => datos, alAgregar: linea => carrito.agregar(linea) });

  const vista = armarVista(menu, temporada);
  const secciones = dibujarMenu(contenedor, menu, vista, alElegir);
  iniciarNavegacion({
    vista, secciones,
    barra: document.getElementById('barra'),
    selector: document.getElementById('selector'),
    chips: document.getElementById('chips')
  });

  // El número del pie sale de los datos, para que coincida con el que el dueño configure.
  const pie = document.getElementById('pie-whatsapp');
  if (pie && menu.config?.whatsapp) {
    pie.href = `https://wa.me/${menu.config.whatsapp}`;
    pie.textContent = formatoTelefono(menu.config.whatsapp);
  }
}

cargar();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('Service worker', e)));
}
