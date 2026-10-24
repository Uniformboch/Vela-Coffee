// Selector Bebidas | Comida, chips de categorías, sección visible y enlaces #cat-….
import { el } from './dom.mjs';
import { idAncla, buscarAncla } from '../logica/vista.mjs';

export function iniciarNavegacion({ vista, secciones, barra, selector, chips }) {
  let grupoActual = vista.grupos[0]?.id;
  let enlaces = [];       // chips del grupo actual: { a, seccion }
  let marcada = null;

  // El alto real de la barra fija define dónde "empieza" la pantalla al saltar a una categoría.
  const medirBarra = () => document.documentElement.style.setProperty('--alto-barra', `${barra.offsetHeight}px`);
  new ResizeObserver(medirBarra).observe(barra);
  medirBarra();

  // Selector: solo aparece si hay más de un grupo.
  const botonesGrupo = vista.grupos.map(g =>
    el('button', { type: 'button', 'aria-pressed': 'false', dataset: { grupo: g.id }, onclick: () => cambiarGrupo(g.id, { alInicio: true }) }, g.nombre));
  selector.replaceChildren(...botonesGrupo);
  selector.hidden = vista.grupos.length < 2;

  function seccionesVisibles() {
    return [secciones.temporada, ...(secciones.grupos[grupoActual]?.lista ?? [])].filter(Boolean);
  }

  function cambiarGrupo(id, { alInicio = false } = {}) {
    if (!secciones.grupos[id]) return;
    grupoActual = id;
    for (const b of botonesGrupo) b.setAttribute('aria-pressed', String(b.dataset.grupo === id));
    for (const [g, s] of Object.entries(secciones.grupos)) s.contenedor.hidden = g !== id;

    enlaces = seccionesVisibles().map(seccion => {
      const categoria = seccion === secciones.temporada ? vista.temporada : vista.grupos.find(g => g.id === id).categorias.find(c => idAncla(c) === seccion.id);
      return { a: el('a', { class: 'chip', href: `#${idAncla(categoria)}` }, categoria.nombre), seccion };
    });
    chips.replaceChildren(...enlaces.map(e => e.a));
    marcada = null;

    if (alInicio) {
      // Al cambiar de grupo con la barra ya pegada arriba, se regresa al inicio de las categorías.
      const primera = seccionesVisibles()[0];
      if (primera && barra.getBoundingClientRect().top <= 0) primera.scrollIntoView({ behavior: 'instant', block: 'start' });
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }
    actualizarMarcada();
  }

  // Marca el chip de la última sección cuyo inicio ya pasó por debajo de la barra.
  function actualizarMarcada() {
    const lista = seccionesVisibles();
    if (!lista.length) return;
    const tope = barra.getBoundingClientRect().bottom + 16;
    let activa = lista[0];
    for (const s of lista) { if (s.getBoundingClientRect().top <= tope) activa = s; else break; }
    const final = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (final) activa = lista.at(-1);
    if (activa === marcada) return;
    marcada = activa;
    for (const e of enlaces) {
      if (e.seccion === activa) {
        e.a.setAttribute('aria-current', 'true');
        // Solo desplaza la fila de chips (de lado), nunca la página.
        chips.scrollTo({ left: e.a.offsetLeft - chips.clientWidth / 2 + e.a.offsetWidth / 2, behavior: 'smooth' });
      } else e.a.removeAttribute('aria-current');
    }
  }

  let pendiente = false;
  addEventListener('scroll', () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; actualizarMarcada(); });
  }, { passive: true });
  addEventListener('resize', actualizarMarcada);

  // "#cat-…": cambia al grupo correcto y lleva a la categoría (también si el menú cargó después).
  function irAlAncla(comportamiento) {
    const destino = buscarAncla(vista, location.hash);
    if (!destino) return false;
    if (destino.grupo && destino.grupo !== grupoActual) cambiarGrupo(destino.grupo);
    document.getElementById(idAncla(destino.categoria))?.scrollIntoView({ behavior: comportamiento, block: 'start' });
    return true;
  }
  addEventListener('hashchange', () => irAlAncla('smooth'));

  if (grupoActual) cambiarGrupo(grupoActual);
  if (location.hash) requestAnimationFrame(() => irAlAncla('instant'));
}
