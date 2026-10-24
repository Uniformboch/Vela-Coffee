// Arranque del menú público: carga los datos, dibuja y conecta la navegación.
import { el } from './ui/dom.mjs';
import { armarVista, formatoTelefono } from './logica/vista.mjs';
import { dibujarMenu } from './ui/render-menu.mjs';
import { iniciarNavegacion } from './ui/navegacion.mjs';

const contenedor = document.getElementById('menu');

async function pedirJson(ruta) {
  const r = await fetch(ruta, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

// La hoja de producto llega en la etapa 5; por ahora tocar un producto no hace nada.
function alElegir(producto, categoria) {
  document.dispatchEvent(new CustomEvent('menu:elegir', { detail: { producto, categoria } }));
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
