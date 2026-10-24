// Validación del menú y la temporada. La usan el panel (antes de guardar) y el servidor (siempre).
// Devuelve una lista de errores en español; vacía si todo está bien.

import { UNICO } from './catalogo.mjs';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GRUPOS = ['bebidas', 'comida'];

const CAMPOS = {
  menu: ['config', 'tamanos', 'extras', 'categorias'],
  config: ['negocio', 'whatsapp'],
  tamano: ['nombre'],
  extra: ['id', 'nombre', 'precio', 'tamanos'],
  categoria: ['id', 'nombre', 'grupo', 'descripcion', 'prefijoPedido', 'extrasPermitidos', 'productos'],
  producto: ['id', 'nombre', 'detalle', 'descripcion', 'precios', 'extrasPermitidos', 'opciones', 'agotado', 'disponible', 'imagen'],
  opcion: ['id', 'nombre', 'valores'],
  valor: ['id', 'nombre', 'precio'],
  temporada: ['activa', 'categoria'],
  categoriaTemporada: ['id', 'nombre', 'descripcion', 'productos'],
  productoTemporada: ['id', 'nombre', 'descripcion', 'precios', 'agotado', 'disponible', 'imagen']
};

const esObjeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const esPrecio = v => Number.isInteger(v) && v >= 1 && v <= 9999;

function revisarCampos(obj, tipo, donde, errores) {
  if (!esObjeto(obj)) { errores.push(`${donde}: no tiene el formato correcto.`); return false; }
  for (const k of Object.keys(obj)) if (!CAMPOS[tipo].includes(k)) errores.push(`${donde}: campo desconocido "${k}".`);
  return true;
}

function revisarTexto(valor, donde, campo, errores, { obligatorio = false, max = 80 } = {}) {
  if (valor === undefined) { if (obligatorio) errores.push(`${donde}: falta ${campo}.`); return; }
  if (typeof valor !== 'string' || (obligatorio && !valor.trim())) errores.push(`${donde}: ${campo} no es válido.`);
  else if (valor.length > max) errores.push(`${donde}: ${campo} es demasiado largo (máximo ${max} letras).`);
}

function revisarId(id, donde, vistos, errores) {
  if (typeof id !== 'string' || !ID.test(id) || id.length > 60) { errores.push(`${donde}: identificador no válido.`); return; }
  if (vistos.has(id)) errores.push(`${donde}: el identificador "${id}" está repetido.`);
  vistos.add(id);
}

function revisarProducto(p, donde, ctx, errores, { temporada = false } = {}) {
  if (!revisarCampos(p, temporada ? 'productoTemporada' : 'producto', donde, errores)) return;
  revisarId(p.id, donde, ctx.idsProductos, errores);
  const nombre = typeof p.nombre === 'string' && p.nombre.trim() ? `"${p.nombre}"` : donde;
  revisarTexto(p.nombre, donde, 'el nombre', errores, { obligatorio: true });
  revisarTexto(p.detalle, nombre, 'el detalle', errores, { max: 40 });
  revisarTexto(p.descripcion, nombre, 'la descripción', errores, { max: 400 });
  if (p.agotado !== undefined && typeof p.agotado !== 'boolean') errores.push(`${nombre}: "agotado" no es válido.`);
  if (p.disponible !== undefined && typeof p.disponible !== 'boolean') errores.push(`${nombre}: "disponible" no es válido.`);
  if (p.imagen !== undefined) {
    if (typeof p.imagen !== 'string' || !/^fotos\/[a-z0-9-]+\.(jpg|png|webp)$/.test(p.imagen)) errores.push(`${nombre}: la foto no es válida.`);
    else if (ctx.fotosExistentes && !ctx.fotosExistentes.has(p.imagen)) errores.push(`${nombre}: la foto ya no existe.`);
  }

  // Precios: "unico" solo, o uno o más tamaños conocidos.
  if (!esObjeto(p.precios) || !Object.keys(p.precios).length) errores.push(`${nombre}: falta el precio.`);
  else {
    const claves = Object.keys(p.precios);
    if (claves.includes(UNICO) && claves.length > 1) errores.push(`${nombre}: tiene precio único y por tamaño a la vez.`);
    if (temporada && (claves.length !== 1 || claves[0] !== UNICO)) errores.push(`${nombre}: los productos de temporada llevan precio único.`);
    for (const k of claves) {
      if (k !== UNICO && !ctx.tamanos.has(k)) errores.push(`${nombre}: tamaño desconocido "${k}".`);
      if (!esPrecio(p.precios[k])) errores.push(`${nombre}: el precio debe ser un número entero de 1 a 9999.`);
    }
  }

  if (p.extrasPermitidos !== undefined) revisarListaExtras(p.extrasPermitidos, nombre, ctx, errores);

  if (p.opciones !== undefined) {
    if (!Array.isArray(p.opciones)) { errores.push(`${nombre}: las opciones no son válidas.`); return; }
    const idsOpciones = new Set();
    p.opciones.forEach((o, i) => {
      const dondeO = `${nombre}, opción ${i + 1}`;
      if (!revisarCampos(o, 'opcion', dondeO, errores)) return;
      revisarId(o.id, dondeO, idsOpciones, errores);
      revisarTexto(o.nombre, dondeO, 'el nombre', errores, { obligatorio: true });
      if (!Array.isArray(o.valores) || o.valores.length < 2 || o.valores.length > 15) {
        errores.push(`${dondeO}: debe tener de 2 a 15 valores.`); return;
      }
      const idsValores = new Set();
      o.valores.forEach((v, j) => {
        const dondeV = `${dondeO}, valor ${j + 1}`;
        if (!revisarCampos(v, 'valor', dondeV, errores)) return;
        revisarId(v.id, dondeV, idsValores, errores);
        revisarTexto(v.nombre, dondeV, 'el nombre', errores, { obligatorio: true });
        if (v.precio !== undefined && !esPrecio(v.precio)) errores.push(`${dondeV}: el precio extra debe ser un número entero de 1 a 9999.`);
      });
    });
  }
}

function revisarListaExtras(lista, donde, ctx, errores) {
  if (!Array.isArray(lista)) { errores.push(`${donde}: la lista de extras no es válida.`); return; }
  const vistos = new Set();
  for (const id of lista) {
    if (!ctx.idsExtras.has(id)) errores.push(`${donde}: el extra "${id}" no existe.`);
    if (vistos.has(id)) errores.push(`${donde}: el extra "${id}" está repetido.`);
    vistos.add(id);
  }
}

/**
 * Valida el menú y la temporada juntos (los ids de producto no se pueden repetir entre ambos).
 * opciones.fotosExistentes: Set con las rutas "fotos/…" que existen; si no se da, no se revisa.
 */
export function validarMenu(menu, temporada, { fotosExistentes } = {}) {
  const errores = [];
  if (!revisarCampos(menu, 'menu', 'Menú', errores)) return errores;

  // Configuración
  if (revisarCampos(menu.config, 'config', 'Ajustes', errores)) {
    revisarTexto(menu.config.negocio, 'Ajustes', 'el nombre del negocio', errores, { obligatorio: true });
    if (typeof menu.config.whatsapp !== 'string' || !/^\d{10,15}$/.test(menu.config.whatsapp)) errores.push('Ajustes: el número de WhatsApp debe tener de 10 a 15 dígitos.');
  }

  // Tamaños
  const tamanos = new Set();
  if (!esObjeto(menu.tamanos)) errores.push('Tamaños: no tienen el formato correcto.');
  else for (const [k, t] of Object.entries(menu.tamanos)) {
    if (!/^[A-Z]{1,3}$/.test(k)) errores.push(`Tamaños: la letra "${k}" no es válida.`);
    if (revisarCampos(t, 'tamano', `Tamaño ${k}`, errores)) revisarTexto(t.nombre, `Tamaño ${k}`, 'el nombre', errores, { obligatorio: true });
    tamanos.add(k);
  }

  // Extras
  const idsExtras = new Set();
  if (!Array.isArray(menu.extras)) errores.push('Extras: no tienen el formato correcto.');
  else menu.extras.forEach((e, i) => {
    const donde = `Extra ${i + 1}`;
    if (!revisarCampos(e, 'extra', donde, errores)) return;
    revisarId(e.id, donde, idsExtras, errores);
    revisarTexto(e.nombre, donde, 'el nombre', errores, { obligatorio: true });
    if (!esPrecio(e.precio)) errores.push(`${donde}: el precio debe ser un número entero de 1 a 9999.`);
    if (e.tamanos !== undefined && (!Array.isArray(e.tamanos) || !e.tamanos.length || e.tamanos.some(t => t !== UNICO && !tamanos.has(t))))
      errores.push(`${donde}: la lista de tamaños no es válida.`);
  });

  const ctx = { tamanos, idsExtras, idsProductos: new Set(), fotosExistentes };

  // Categorías y productos
  const idsCategorias = new Set();
  if (!Array.isArray(menu.categorias)) errores.push('Categorías: no tienen el formato correcto.');
  else menu.categorias.forEach((c, i) => {
    const donde = `Categoría ${i + 1}`;
    if (!revisarCampos(c, 'categoria', donde, errores)) return;
    revisarId(c.id, donde, idsCategorias, errores);
    const nombre = typeof c.nombre === 'string' && c.nombre.trim() ? `"${c.nombre}"` : donde;
    revisarTexto(c.nombre, donde, 'el nombre', errores, { obligatorio: true });
    if (!GRUPOS.includes(c.grupo)) errores.push(`${nombre}: el grupo debe ser bebidas o comida.`);
    revisarTexto(c.descripcion, nombre, 'la descripción', errores, { max: 200 });
    revisarTexto(c.prefijoPedido, nombre, 'el prefijo', errores, { max: 30 });
    if (c.extrasPermitidos !== undefined) revisarListaExtras(c.extrasPermitidos, nombre, ctx, errores);
    if (!Array.isArray(c.productos)) errores.push(`${nombre}: los productos no tienen el formato correcto.`);
    else c.productos.forEach((p, j) => revisarProducto(p, `${nombre}, producto ${j + 1}`, ctx, errores));
  });

  // Temporada
  if (revisarCampos(temporada, 'temporada', 'Temporada', errores)) {
    if (typeof temporada.activa !== 'boolean') errores.push('Temporada: "activa" no es válido.');
    const c = temporada.categoria;
    if (revisarCampos(c, 'categoriaTemporada', 'Temporada', errores)) {
      revisarId(c.id, 'Temporada', idsCategorias, errores);
      revisarTexto(c.nombre, 'Temporada', 'el nombre', errores, { obligatorio: true });
      revisarTexto(c.descripcion, 'Temporada', 'la descripción', errores, { max: 200 });
      if (!Array.isArray(c.productos)) errores.push('Temporada: los productos no tienen el formato correcto.');
      else c.productos.forEach((p, j) => revisarProducto(p, `Temporada, producto ${j + 1}`, ctx, errores, { temporada: true }));
    }
  }

  return errores;
}
