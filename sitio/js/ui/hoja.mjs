// Hoja (ventana) reutilizable: sube desde abajo en celular y queda centrada en computadora.
// Usa <dialog> nativo: atrapa el foco, Esc la cierra y el foco regresa a donde estaba.
import { el } from './dom.mjs';

let contador = 0;

export function crearHoja({ clase = '', alCerrar } = {}) {
  const id = `hoja-${++contador}`;
  const titulo = el('h2', { class: 'hoja-titulo', id: `${id}-titulo`, tabindex: '-1' });
  const cuerpo = el('div', { class: 'hoja-cuerpo' });
  const pie = el('div', { class: 'hoja-pie' });
  const dialog = el('dialog', { class: `hoja ${clase}`.trim(), 'aria-labelledby': `${id}-titulo` },
    el('div', { class: 'hoja-cabecera' },
      titulo,
      el('button', { type: 'button', class: 'hoja-cerrar', 'aria-label': 'Cerrar', onclick: () => dialog.close() }, '×')),
    cuerpo, pie);
  document.body.append(dialog);

  let origen = null;
  // Tocar fuera de la hoja (el fondo oscuro) la cierra.
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('con-hoja');
    const volver = origen;
    origen = null;
    alCerrar?.();
    if (volver?.isConnected && !volver.disabled && volver.getClientRects().length) volver.focus();
    else document.getElementById('menu')?.focus();
  });

  return {
    dialog, titulo, cuerpo, pie,
    abrir(desde = document.activeElement) {
      origen = desde;
      document.documentElement.classList.add('con-hoja');
      if (!dialog.open) dialog.showModal();
      cuerpo.scrollTop = 0;
      titulo.focus();
    },
    cerrar() { if (dialog.open) dialog.close(); },
    get abierta() { return dialog.open; }
  };
}
