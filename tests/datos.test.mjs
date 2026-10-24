// Pruebas del contenido inicial del menú: precios aprobados, extras, opciones y estructura.
// El campo "agotado" se ignora a propósito: el dueño lo cambia a diario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarMenu, cargarTemporada, cargarPreciosAprobados } from './ayuda.mjs';
import { extrasDeProducto, tamanosDe } from '../sitio/js/logica/catalogo.mjs';
import { validarMenu } from '../sitio/js/logica/validar-menu.mjs';

const menu = cargarMenu();
const temporada = cargarTemporada();
const aprobados = cargarPreciosAprobados();

const categoria = nombre => menu.categorias.find(c => c.nombre === nombre);
const producto = nombre => {
  for (const c of menu.categorias) {
    const p = c.productos.find(p => p.nombre === nombre);
    if (p) return { c, p };
  }
  throw new Error(`No existe el producto ${nombre}`);
};
const idsExtras = (nombre, tamano) => { const { c, p } = producto(nombre); return extrasDeProducto(menu, c, p, tamano).map(e => e.id).sort(); };

test('el menú y la temporada pasan la validación', () => {
  assert.deepEqual(validarMenu(menu, temporada), []);
});

test('las categorías son exactamente las aprobadas y en el mismo orden', () => {
  assert.deepEqual(menu.categorias.map(c => c.nombre), Object.keys(aprobados.categorias));
});

test('cada precio coincide con la tabla aprobada, y no sobra ni falta ningún producto', () => {
  for (const [nombreCat, productos] of Object.entries(aprobados.categorias)) {
    const c = categoria(nombreCat);
    assert.ok(c, `falta la categoría ${nombreCat}`);
    assert.deepEqual(c.productos.map(p => p.nombre), Object.keys(productos), `productos de ${nombreCat}`);
    for (const p of c.productos) assert.deepEqual(p.precios, productos[p.nombre], `precio de ${p.nombre}`);
  }
});

test('los precios de los extras coinciden con la tabla aprobada', () => {
  assert.deepEqual(Object.fromEntries(menu.extras.map(e => [e.nombre, e.precio])), aprobados.extras);
});

test('número de WhatsApp y nombre del negocio', () => {
  assert.equal(menu.config.whatsapp, '524771358745');
  assert.equal(menu.config.negocio, 'Vela Coffee');
});

test('tamaños: C es caliente y F es frío, en ese orden', () => {
  assert.deepEqual(menu.tamanos, { C: { nombre: 'Caliente' }, F: { nombre: 'Frío' } });
  assert.deepEqual(tamanosDe(menu, producto('Americano').p), ['C', 'F']);
  assert.deepEqual(tamanosDe(menu, producto('Mint Latte').p), ['F']);
  assert.deepEqual(tamanosDe(menu, producto('Limonada').p), ['unico']);
});

test('leche vegetal: solo en las bebidas con leche', () => {
  const conLeche = [
    'Latte', 'Latte vainilla', 'Mint Latte', 'Horchata latte', 'Capuccino', 'Moka', 'Chocolate',
    'Matcha', 'Taro', 'Golden Milk', 'Chai', 'Dirty Chai',
    'Cloud Matcha Coconut', 'Cloud Taro Coconut', 'Cloud Mango Coconut', 'Vainilla Foam Latte',
    'Banana Foam Latte', 'Lotus Foam Latte', 'Strawberry Matcha',
    'Choco Chía', 'Mint Vela', 'Strawberry Latte', 'Velvet Matcha'
  ];
  const todas = menu.categorias.flatMap(c => c.productos.map(p => p.nombre));
  for (const nombre of todas) {
    assert.equal(idsExtras(nombre).includes('leche-vegetal'), conLeche.includes(nombre), `leche vegetal en ${nombre}`);
  }
});

test('lata: solo en bebidas frías, nunca en Refresco ni Tisana', () => {
  // En una bebida con caliente y frío, la lata aparece solo al elegir frío.
  assert.ok(idsExtras('Americano', 'F').includes('lata'));
  assert.ok(!idsExtras('Americano', 'C').includes('lata'));
  assert.ok(idsExtras('Latte', 'F').includes('lata'));
  assert.ok(!idsExtras('Latte', 'C').includes('lata'));
  // Solo calientes: nunca lata.
  for (const n of ['Espresso', 'Dirty Chai', 'Café Filtrado V60']) assert.ok(!idsExtras(n).includes('lata'), n);
  // Solo frías o de precio único frías: siempre lata.
  for (const n of ['Mint Latte', 'Smoothie Frutos Rojos', 'Lotus Foam Latte', 'Cold Brew', 'Espresso tonic', 'Limonada'])
    assert.ok(idsExtras(n).includes('lata'), n);
  for (const n of ['Refresco', 'Tisana']) assert.deepEqual(idsExtras(n), [], n);
  // Ninguna comida tiene lata.
  for (const c of menu.categorias.filter(c => c.grupo === 'comida'))
    for (const p of c.productos) assert.ok(!idsExtras(p.nombre).includes('lata'), p.nombre);
});

test('proteína extra: en toda la comida salada y en nada más', () => {
  const proteinas = ['aguacate-extra', 'chorizo-extra', 'huevo-extra', 'pavo-extra', 'pollo-extra', 'queso-extra'];
  const saladas = ['Avocado Toast', 'Ensalada Thai', 'Sándwich ligero', 'Sándwich Vela', 'Molletes',
    'Croissant de Huevo con Tocino', 'Chilaquiles Sencillos', 'Chilaquiles con proteína', 'Torta de chilaquiles'];
  for (const n of saladas) assert.deepEqual(idsExtras(n), proteinas, n);
  for (const n of ['Avena Hidratada', 'Pan Francés', 'Galletas NY']) assert.deepEqual(idsExtras(n), [], n);
  for (const c of menu.categorias.filter(c => c.grupo === 'bebidas'))
    for (const p of c.productos) assert.ok(!idsExtras(p.nombre).some(id => proteinas.includes(id)), p.nombre);
});

test('opciones obligatorias: las acordadas, sin precio extra', () => {
  const opciones = nombre => (producto(nombre).p.opciones ?? []).map(o => `${o.nombre}: ${o.valores.map(v => v.nombre).join(', ')}`);
  const salsa = 'Salsa: Salsa verde, Salsa roja';
  assert.deepEqual(opciones('Chilaquiles Sencillos'), [salsa]);
  assert.deepEqual(opciones('Chilaquiles con proteína'), [salsa, 'Proteína: Pollo, Huevo']);
  assert.deepEqual(opciones('Torta de chilaquiles'), [salsa]);
  assert.deepEqual(opciones('Sándwich ligero'), ['Proteína: Pollo, Pavo']);
  assert.deepEqual(opciones('Sándwich Vela'), ['Proteína: Pollo, Pavo']);
  assert.deepEqual(opciones('Galletas NY'), ['Sabor: Chocolate, Vainilla, Red Velvet']);

  const conOpciones = menu.categorias.flatMap(c => c.productos).filter(p => p.opciones).map(p => p.nombre);
  assert.equal(conOpciones.length, 6);
  for (const p of menu.categorias.flatMap(c => c.productos))
    for (const o of p.opciones ?? []) for (const v of o.valores) assert.equal(v.precio, undefined, `${p.nombre} / ${v.nombre}`);
});

test('ningún producto está oculto y la temporada empieza apagada y vacía', () => {
  for (const p of menu.categorias.flatMap(c => c.productos)) assert.notEqual(p.disponible, false, p.nombre);
  assert.equal(temporada.activa, false);
  assert.deepEqual(temporada.categoria.productos, []);
});
