// Editores del panel: producto, categoría, extra y producto de temporada.
// Cada editor trabaja sobre una copia; los cambios pasan al menú en edición solo al tocar "Listo".
import { el } from '../ui/dom.mjs';
import { crearHoja } from '../ui/hoja.mjs';
import { idUnico, idsDeProductos, idsDeCategorias } from '../logica/ids.mjs';
import { formatoPrecio } from '../logica/vista.mjs';
import { campo, texto, areaTexto, entradaPrecio, leerPrecio, casilla, grupoRadios, selector, cajaErrores, mostrarErrores } from './formularios.mjs';
import { reducirFoto } from './fotos.mjs';
import { api, ErrorSesion } from './api.mjs';

const NOMBRE_GRUPO = { bebidas: 'Bebidas', comida: 'Comida' };
const MAX_VALORES = 15;
const limpiar = t => String(t ?? '').trim();

/** Mueve "elemento" a la posición "lugar" (1, 2, 3…) dentro de "lista". */
function colocar(lista, elemento, lugar) {
  const i = lista.indexOf(elemento);
  if (i >= 0) lista.splice(i, 1);
  lista.splice(Math.max(0, Math.min(lugar - 1, lista.length)), 0, elemento);
}

function opcionesDeLugar(n) {
  return Array.from({ length: n }, (_, i) => ({ valor: String(i + 1), texto: i === 0 ? '1 (primero)' : i === n - 1 ? `${n} (último)` : String(i + 1) }));
}

/**
 * trabajo(): { menu, temporada } en edición.  alCambiar(): avisa que hubo cambios.
 * alSesionVencida(reintentar): pide entrar otra vez.
 */
export function crearEditores({ trabajo, alCambiar, alSesionVencida }) {
  const hoja = crearHoja({ clase: 'hoja-editor' });

  function abrir({ titulo, cuerpo, alListo, alEliminar, textoEliminar = 'Eliminar', origen }) {
    const errores = cajaErrores();
    hoja.titulo.textContent = titulo;
    hoja.cuerpo.replaceChildren(errores, ...[cuerpo].flat().filter(Boolean));
    hoja.pie.replaceChildren(el('div', { class: 'adm-pie-editor' },
      alEliminar ? el('button', { type: 'button', class: 'boton-sec boton-peligro', onclick: () => { if (alEliminar() !== false) { alCambiar(); hoja.cerrar(); } } }, textoEliminar) : el('span'),
      el('button', { type: 'button', class: 'boton-sec', onclick: () => hoja.cerrar() }, 'Cancelar'),
      el('button', {
        type: 'button', class: 'boton-principal', onclick: () => {
          const lista = alListo();
          if (lista.length) return mostrarErrores(errores, lista);
          alCambiar();
          hoja.cerrar();
        }
      }, 'Listo')));
    hoja.abrir(origen);
  }

  // ---------- Opciones a elegir (salsa, proteína, sabor…) ----------
  function editorOpciones(opciones) {
    const grupos = (opciones ?? []).map(o => ({
      id: o.id, nombre: o.nombre,
      valores: o.valores.map(v => ({ id: v.id, nombre: v.nombre, precio: v.precio != null ? String(v.precio) : '' }))
    }));
    const zona = el('div');
    const valorVacio = () => ({ id: null, nombre: '', precio: '' });

    function dibujar(enfocar) {
      zona.replaceChildren(el('fieldset', { class: 'grupo-opcion' },
        el('legend', {}, 'Opciones a elegir ', el('span', { class: 'opcional' }, 'Opcional')),
        el('p', { class: 'nota' }, 'Ej. salsa verde o roja. El cliente tiene que elegir un valor de cada opción.'),
        grupos.map((g, gi) => el('div', { class: 'adm-opcion' },
          campo('Nombre de la opción', texto(g.nombre, { max: 40, placeholder: 'Ej. Salsa', alEscribir: e => { g.nombre = e.target.value; } })),
          el('p', { class: 'adm-sub' }, 'Valores (precio extra opcional)'),
          el('ul', { class: 'adm-valores' }, g.valores.map((v, vi) => el('li', {},
            texto(v.nombre, { max: 40, placeholder: `Valor ${vi + 1}`, etiqueta: `Valor ${vi + 1} de la opción`, alEscribir: e => { v.nombre = e.target.value; } }),
            entradaPrecio(v.precio, { placeholder: '+$', 'aria-label': `Precio extra del valor ${vi + 1}`, oninput: e => { v.precio = e.target.value; } }),
            el('button', {
              type: 'button', class: 'boton-icono', 'aria-label': `Quitar valor ${vi + 1}`,
              onclick: () => { g.valores.splice(vi, 1); dibujar(); }
            }, '×')))),
          el('div', { class: 'adm-fila-botones' },
            el('button', {
              type: 'button', class: 'boton-sec boton-chico', disabled: g.valores.length >= MAX_VALORES,
              onclick: () => { g.valores.push(valorVacio()); dibujar(`g${gi}v${g.valores.length - 1}`); }
            }, '+ Agregar valor'),
            el('button', { type: 'button', class: 'boton-sec boton-chico boton-peligro', onclick: () => { grupos.splice(gi, 1); dibujar(); } }, 'Quitar opción')))),
        el('button', {
          type: 'button', class: 'boton-sec boton-chico', onclick: () => {
            grupos.push({ id: null, nombre: '', valores: [valorVacio(), valorVacio()] });
            dibujar('nuevo');
          }
        }, '+ Agregar opción')));
      // Después de agregar, el cursor va al campo nuevo.
      const bloques = zona.querySelectorAll('.adm-opcion');
      if (enfocar === 'nuevo') bloques[bloques.length - 1]?.querySelector('input')?.focus();
      else if (enfocar) {
        const [gi, vi] = enfocar.slice(1).split('v').map(Number);
        bloques[gi]?.querySelectorAll('.adm-valores li')[vi]?.querySelector('input')?.focus();
      }
    }
    dibujar();

    return {
      nodo: zona,
      errores() {
        const lista = [];
        for (const g of grupos) {
          const nombre = limpiar(g.nombre) || 'sin nombre';
          if (!limpiar(g.nombre)) lista.push('Cada opción necesita un nombre.');
          const valores = g.valores.filter(v => limpiar(v.nombre) || limpiar(v.precio));
          if (valores.length < 2) lista.push(`La opción "${nombre}" necesita al menos 2 valores.`);
          if (valores.some(v => !limpiar(v.nombre))) lista.push(`En la opción "${nombre}" hay un valor con precio pero sin nombre.`);
          if (valores.some(v => Number.isNaN(leerPrecio(v.precio)))) lista.push(`En la opción "${nombre}" hay un precio extra que no es un número entero de 1 a 9999.`);
        }
        return lista;
      },
      /** Opciones listas para el menú, con ids que no cambian. */
      leer() {
        const idsOpciones = new Set(grupos.filter(g => g.id).map(g => g.id));
        return grupos.map(g => {
          const id = g.id ?? idUnico(g.nombre, idsOpciones);
          idsOpciones.add(id);
          const idsValores = new Set(g.valores.filter(v => v.id).map(v => v.id));
          const valores = g.valores.filter(v => limpiar(v.nombre)).map(v => {
            const vid = v.id ?? idUnico(v.nombre, idsValores);
            idsValores.add(vid);
            const precio = leerPrecio(v.precio);
            return { id: vid, nombre: limpiar(v.nombre), ...(precio ? { precio } : {}) };
          });
          return { id, nombre: limpiar(g.nombre), valores };
        });
      }
    };
  }

  // ---------- Producto (bebidas y comida) ----------
  function producto(categoriaInicial, original, origen) {
    const { menu, temporada } = trabajo();
    const p = original ?? { nombre: '', precios: { unico: undefined } };
    const tamanos = Object.keys(menu.tamanos);

    const nombre = texto(p.nombre, { max: 80 });
    const detalle = texto(p.detalle, { max: 40, placeholder: 'Ej. 2 pz, 600 ml' });
    const descripcion = areaTexto(p.descripcion, { max: 400 });

    const selCategoria = selector(menu.categorias.map(c => ({ valor: c.id, texto: `${c.nombre} (${NOMBRE_GRUPO[c.grupo]})` })), categoriaInicial.id);
    const selLugar = el('select');
    const destino = () => menu.categorias.find(c => c.id === selCategoria.value);
    function llenarLugares() {
      const cat = destino();
      const n = cat.productos.filter(x => x !== original).length + 1;
      selLugar.replaceChildren(...opcionesDeLugar(n).map(o => el('option', { value: o.valor }, o.texto)));
      const actual = cat === categoriaInicial && original ? categoriaInicial.productos.indexOf(original) + 1 : n;
      selLugar.value = String(actual);
      actualizarNotaExtras();
    }
    selCategoria.addEventListener('change', llenarLugares);

    // Precios
    const inUnico = entradaPrecio(p.precios.unico);
    const inTamanos = tamanos.map(t => [t, entradaPrecio(p.precios[t])]);
    const bloqueUnico = el('div', {}, campo('Precio', inUnico));
    const bloqueTamanos = el('div', { class: 'adm-precios' },
      inTamanos.map(([t, input]) => campo(menu.tamanos[t].nombre, input)),
      el('p', { class: 'nota' }, 'Deja vacío el que no exista (ej. si solo se vende frío).'));
    const modoPrecio = grupoRadios('Precio', [
      { valor: 'unico', texto: 'Precio único' },
      { valor: 'tamanos', texto: `Por tamaño (${tamanos.map(t => menu.tamanos[t].nombre).join(' / ')})` }
    ], 'unico' in p.precios ? 'unico' : 'tamanos', modo => { bloqueUnico.hidden = modo !== 'unico'; bloqueTamanos.hidden = modo === 'unico'; });
    bloqueUnico.hidden = modoPrecio.valor() !== 'unico';
    bloqueTamanos.hidden = !bloqueUnico.hidden;

    // Extras
    const notaExtras = el('p', { class: 'nota' });
    const casillasExtras = menu.extras.map(e => ({ id: e.id, ...casilla(`${e.nombre} (+${formatoPrecio(e.precio)})`, false) }));
    const modoExtras = grupoRadios('Extras que se ofrecen', [
      { valor: 'categoria', texto: 'Los de la categoría' },
      { valor: 'propia', texto: 'Elegir para este producto' }
    ], Array.isArray(p.extrasPermitidos) ? 'propia' : 'categoria', () => actualizarNotaExtras());
    function actualizarNotaExtras() {
      const propia = modoExtras.valor() === 'propia';
      const deCategoria = destino()?.extrasPermitidos ?? [];
      const nombres = deCategoria.map(id => menu.extras.find(e => e.id === id)?.nombre).filter(Boolean);
      notaExtras.textContent = propia ? 'Marca los extras de este producto.' : `De la categoría: ${nombres.length ? nombres.join(', ') : 'ninguno'}.`;
      for (const c of casillasExtras) {
        c.nodo.hidden = !propia;
        if (!propia) c.input.checked = deCategoria.includes(c.id);
      }
    }
    if (Array.isArray(p.extrasPermitidos)) for (const c of casillasExtras) c.input.checked = p.extrasPermitidos.includes(c.id);

    const opciones = editorOpciones(p.opciones);
    const agotado = casilla('Agotado (se ve en gris y no se puede pedir)', p.agotado);
    const oculto = casilla('Ocultar del menú (no se borra)', p.disponible === false);

    const cuerpo = [
      campo('Nombre', nombre),
      campo('Detalle', detalle, { opcional: true }),
      campo('Descripción', descripcion, { opcional: true }),
      modoPrecio.nodo, bloqueUnico, bloqueTamanos,
      el('div', {}, modoExtras.nodo, notaExtras, el('div', { class: 'adm-casillas' }, casillasExtras.map(c => c.nodo))),
      opciones.nodo,
      el('fieldset', { class: 'grupo-opcion' }, el('legend', {}, 'Estado'), agotado.nodo, oculto.nodo),
      el('div', { class: 'adm-dos' }, campo('Categoría', selCategoria), campo('Lugar en la lista', selLugar))
    ];
    llenarLugares();

    abrir({
      titulo: original ? `Editar: ${original.nombre}` : 'Nuevo producto',
      cuerpo, origen,
      alListo() {
        const lista = [];
        const n = limpiar(nombre.value);
        if (!n) lista.push('Escribe el nombre.');
        let precios = {};
        if (modoPrecio.valor() === 'unico') {
          const v = leerPrecio(inUnico.value);
          if (!(v >= 1)) lista.push('Escribe el precio (número entero de 1 a 9999).');
          else precios = { unico: v };
        } else {
          for (const [t, input] of inTamanos) {
            const v = leerPrecio(input.value);
            if (Number.isNaN(v)) lista.push(`El precio ${menu.tamanos[t].nombre.toLowerCase()} debe ser un número entero de 1 a 9999.`);
            else if (v) precios[t] = v;
          }
          if (!Object.keys(precios).length && !lista.length) lista.push('Escribe al menos un precio por tamaño.');
        }
        lista.push(...opciones.errores());
        if (lista.length) return lista;

        const nuevo = {
          id: original?.id ?? idUnico(n, idsDeProductos(menu, temporada)),
          nombre: n,
          ...(limpiar(detalle.value) ? { detalle: limpiar(detalle.value) } : {}),
          ...(limpiar(descripcion.value) ? { descripcion: limpiar(descripcion.value) } : {}),
          precios,
          ...(modoExtras.valor() === 'propia' ? { extrasPermitidos: casillasExtras.filter(c => c.input.checked).map(c => c.id) } : {}),
          ...(opciones.leer().length ? { opciones: opciones.leer() } : {}),
          ...(agotado.input.checked ? { agotado: true } : {}),
          ...(oculto.input.checked ? { disponible: false } : {}),
          ...(p.imagen ? { imagen: p.imagen } : {})
        };
        if (original) categoriaInicial.productos.splice(categoriaInicial.productos.indexOf(original), 1);
        colocar(destino().productos, nuevo, Number(selLugar.value));
        return [];
      },
      alEliminar: original ? () => {
        if (!confirm(`¿Eliminar "${original.nombre}"? Mientras no guardes, puedes deshacerlo con "Descartar".`)) return false;
        categoriaInicial.productos.splice(categoriaInicial.productos.indexOf(original), 1);
      } : null
    });
  }

  // ---------- Categoría ----------
  function categoria(grupoInicial, original, origen) {
    const { menu, temporada } = trabajo();
    const nombre = texto(original?.nombre, { max: 80 });
    const descripcion = areaTexto(original?.descripcion, { max: 200, filas: 2, placeholder: 'Ej. Acompañados de ensalada' });
    const selLugar = el('select');
    const grupo = grupoRadios('Sección', [{ valor: 'bebidas', texto: 'Bebidas' }, { valor: 'comida', texto: 'Comida' }], original?.grupo ?? grupoInicial, llenarLugares);
    function llenarLugares() {
      const delGrupo = menu.categorias.filter(c => c.grupo === grupo.valor() && c !== original);
      const n = delGrupo.length + 1;
      selLugar.replaceChildren(...opcionesDeLugar(n).map(o => el('option', { value: o.valor }, o.texto)));
      const actual = original && original.grupo === grupo.valor() ? menu.categorias.filter(c => c.grupo === original.grupo).indexOf(original) + 1 : n;
      selLugar.value = String(actual);
    }
    llenarLugares();

    abrir({
      titulo: original ? `Editar categoría: ${original.nombre}` : 'Nueva categoría',
      cuerpo: [
        campo('Nombre', nombre),
        campo('Descripción', descripcion, { opcional: true, nota: 'Se muestra debajo del título de la categoría.' }),
        grupo.nodo,
        campo('Lugar en la lista', selLugar),
        original ? el('p', { class: 'nota' }, 'Los extras de la categoría se eligen en la pestaña Extras.') : null
      ],
      origen,
      alListo() {
        const n = limpiar(nombre.value);
        if (!n) return ['Escribe el nombre de la categoría.'];
        const cat = original ?? { id: idUnico(n, idsDeCategorias(menu, temporada)), productos: [] };
        cat.nombre = n;
        if (limpiar(descripcion.value)) cat.descripcion = limpiar(descripcion.value); else delete cat.descripcion;
        cat.grupo = grupo.valor();
        // Se acomoda entre las categorías de su sección, en el lugar elegido.
        const otras = menu.categorias.filter(c => c !== cat);
        const delGrupo = otras.filter(c => c.grupo === cat.grupo);
        const lugar = Number(selLugar.value) - 1;
        const antesDe = delGrupo[lugar];
        const despuesDe = delGrupo.at(-1);
        const i = antesDe ? otras.indexOf(antesDe) : despuesDe ? otras.indexOf(despuesDe) + 1 : otras.length;
        otras.splice(i, 0, cat);
        menu.categorias.splice(0, menu.categorias.length, ...otras);
        return [];
      },
      alEliminar: original ? () => {
        const n = original.productos.length;
        const aviso = n ? `¿Eliminar la categoría "${original.nombre}" y sus ${n} productos?` : `¿Eliminar la categoría "${original.nombre}"?`;
        if (!confirm(`${aviso} Mientras no guardes, puedes deshacerlo con "Descartar".`)) return false;
        menu.categorias.splice(menu.categorias.indexOf(original), 1);
      } : null,
      textoEliminar: 'Eliminar categoría'
    });
  }

  // ---------- Extra ----------
  function extra(original, origen) {
    const { menu } = trabajo();
    const nombre = texto(original?.nombre, { max: 80, placeholder: 'Ej. Shot extra' });
    const precio = entradaPrecio(original?.precio);
    const opcionesTamano = [...Object.keys(menu.tamanos).map(t => ({ id: t, texto: menu.tamanos[t].nombre })), { id: 'unico', texto: 'Precio único' }];
    const casillasTamano = opcionesTamano.map(o => ({ id: o.id, ...casilla(o.texto, !original?.tamanos || original.tamanos.includes(o.id)) }));
    const casillasCategoria = menu.categorias.map(c => ({ cat: c, ...casilla(`${c.nombre} (${NOMBRE_GRUPO[c.grupo]})`, !!original && (c.extrasPermitidos ?? []).includes(original.id)) }));
    const conListaPropia = menu.categorias.flatMap(c => c.productos.filter(p => Array.isArray(p.extrasPermitidos)).map(p => p.nombre));

    abrir({
      titulo: original ? `Editar extra: ${original.nombre}` : 'Nuevo extra',
      origen,
      cuerpo: [
        campo('Nombre', nombre),
        campo('Precio', precio),
        el('fieldset', { class: 'grupo-opcion' }, el('legend', {}, 'Se ofrece al elegir'), casillasTamano.map(c => c.nodo),
          el('p', { class: 'nota' }, 'Ej. la lata solo en "Frío" y "Precio único".')),
        el('fieldset', { class: 'grupo-opcion' }, el('legend', {}, 'Categorías donde se ofrece'), casillasCategoria.map(c => c.nodo),
          conListaPropia.length ? el('p', { class: 'nota' }, `Estos productos tienen su propia lista de extras y no cambian con esto (se editan desde cada producto): ${conListaPropia.join(', ')}.`) : null)
      ],
      alListo() {
        const lista = [];
        const n = limpiar(nombre.value);
        const v = leerPrecio(precio.value);
        if (!n) lista.push('Escribe el nombre del extra.');
        if (!(v >= 1)) lista.push('Escribe el precio (número entero de 1 a 9999).');
        const tamanosElegidos = casillasTamano.filter(c => c.input.checked).map(c => c.id);
        if (!tamanosElegidos.length) lista.push('Marca al menos un caso en "Se ofrece al elegir".');
        if (lista.length) return lista;

        const e = original ?? { id: idUnico(n, new Set(menu.extras.map(x => x.id))) };
        e.nombre = n;
        e.precio = v;
        if (tamanosElegidos.length === opcionesTamano.length) delete e.tamanos; else e.tamanos = tamanosElegidos;
        if (!original) menu.extras.push(e);
        for (const c of casillasCategoria) {
          const actual = c.cat.extrasPermitidos ?? [];
          const tiene = actual.includes(e.id);
          if (c.input.checked && !tiene) c.cat.extrasPermitidos = [...actual, e.id];
          if (!c.input.checked && tiene) c.cat.extrasPermitidos = actual.filter(id => id !== e.id);
          if (c.cat.extrasPermitidos?.length === 0) delete c.cat.extrasPermitidos;
        }
        return [];
      },
      alEliminar: original ? () => {
        if (!confirm(`¿Eliminar el extra "${original.nombre}"? Se quitará de todos los productos.`)) return false;
        menu.extras.splice(menu.extras.indexOf(original), 1);
        for (const c of menu.categorias) {
          for (const dueno of [c, ...c.productos]) {
            if (Array.isArray(dueno.extrasPermitidos)) dueno.extrasPermitidos = dueno.extrasPermitidos.filter(id => id !== original.id);
          }
          if (c.extrasPermitidos?.length === 0) delete c.extrasPermitidos;
        }
      } : null
    });
  }

  // ---------- Producto de temporada (con foto) ----------
  function productoTemporada(original, origen) {
    const { menu, temporada } = trabajo();
    const lista = temporada.categoria.productos;
    let imagen = original?.imagen ?? null;
    const nombre = texto(original?.nombre, { max: 80 });
    const descripcion = areaTexto(original?.descripcion, { max: 400 });
    const precio = entradaPrecio(original?.precios?.unico);
    const agotado = casilla('Agotado (se ve en gris y no se puede pedir)', original?.agotado);
    const oculto = casilla('Ocultar del menú (no se borra)', original?.disponible === false);
    const selLugar = selector(opcionesDeLugar(original ? lista.length : lista.length + 1), String(original ? lista.indexOf(original) + 1 : lista.length + 1));

    const vista = el('div', { class: 'adm-foto' });
    const estadoFoto = el('p', { class: 'nota', role: 'status' });
    const archivo = el('input', { type: 'file', accept: 'image/*', class: 'oculto', tabindex: '-1', 'aria-hidden': 'true', onchange: subir });
    const botonQuitar = el('button', { type: 'button', class: 'boton-sec boton-chico', onclick: () => { imagen = null; dibujarFoto(); } }, 'Quitar foto');
    function dibujarFoto() {
      vista.replaceChildren(imagen ? el('img', { src: `/${imagen}`, alt: 'Foto del producto' }) : el('span', {}, 'Sin foto'));
      botonQuitar.hidden = !imagen;
    }
    async function subir() {
      const elegido = archivo.files?.[0];
      archivo.value = '';
      if (!elegido) return;
      estadoFoto.textContent = 'Subiendo foto…';
      try {
        const reducida = await reducirFoto(elegido);
        imagen = (await api.subirFoto(reducida)).ruta;
        estadoFoto.textContent = 'Foto lista.';
        dibujarFoto();
      } catch (e) {
        if (e instanceof ErrorSesion) {
          estadoFoto.textContent = 'Tu sesión venció. Entra otra vez y vuelve a elegir la foto.';
          alSesionVencida();
        } else estadoFoto.textContent = e.errores?.join(' ') ?? 'No se pudo leer la foto. Prueba con otra.';
      }
    }
    dibujarFoto();

    abrir({
      titulo: original ? `Editar: ${original.nombre}` : 'Nuevo producto de temporada',
      origen,
      cuerpo: [
        campo('Nombre', nombre),
        campo('Descripción', descripcion, { opcional: true }),
        campo('Precio', precio),
        el('fieldset', { class: 'grupo-opcion' }, el('legend', {}, 'Foto'),
          vista,
          el('div', { class: 'adm-fila-botones' },
            el('button', { type: 'button', class: 'boton-sec boton-chico', onclick: () => archivo.click() }, 'Elegir foto'), archivo, botonQuitar),
          estadoFoto,
          el('p', { class: 'nota' }, 'Puedes tomarla con la cámara o elegirla de la galería. Se reduce sola para que cargue rápido.')),
        el('fieldset', { class: 'grupo-opcion' }, el('legend', {}, 'Estado'), agotado.nodo, oculto.nodo),
        campo('Lugar en la lista', selLugar)
      ],
      alListo() {
        const errores = [];
        const n = limpiar(nombre.value);
        const v = leerPrecio(precio.value);
        if (!n) errores.push('Escribe el nombre.');
        if (!(v >= 1)) errores.push('Escribe el precio (número entero de 1 a 9999).');
        if (estadoFoto.textContent === 'Subiendo foto…') errores.push('Espera a que termine de subir la foto.');
        if (errores.length) return errores;
        const nuevo = {
          id: original?.id ?? idUnico(n, idsDeProductos(menu, temporada)),
          nombre: n,
          ...(limpiar(descripcion.value) ? { descripcion: limpiar(descripcion.value) } : {}),
          precios: { unico: v },
          ...(imagen ? { imagen } : {}),
          ...(agotado.input.checked ? { agotado: true } : {}),
          ...(oculto.input.checked ? { disponible: false } : {})
        };
        if (original) lista.splice(lista.indexOf(original), 1);
        colocar(lista, nuevo, Number(selLugar.value));
        return [];
      },
      alEliminar: original ? () => {
        if (!confirm(`¿Eliminar "${original.nombre}"? Mientras no guardes, puedes deshacerlo con "Descartar".`)) return false;
        lista.splice(lista.indexOf(original), 1);
      } : null
    });
  }

  return { producto, categoria, extra, productoTemporada, cerrar: () => hoja.cerrar() };
}
