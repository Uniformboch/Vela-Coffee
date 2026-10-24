// Pruebas de cómo se organiza el menú en pantalla (sin navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarMenu, cargarTemporada } from './ayuda.mjs';
import { armarVista, columnasDeCategoria, leyendaDeColumnas, buscarAncla, formatoPrecio, formatoTelefono, idAncla } from '../sitio/js/logica/vista.mjs';

const menu = cargarMenu();
const temporada = cargarTemporada();
const cat = id => menu.categorias.find(c => c.id === id);

test('grupos y categorías en el orden del menú', () => {
  const v = armarVista(menu, temporada);
  assert.equal(v.temporada, null);
  assert.deepEqual(v.grupos.map(g => g.id), ['bebidas', 'comida']);
  assert.deepEqual(v.grupos[0].categorias.map(c => c.id), ['clasicas', 'special-drinks', 'cold-foam', 'to-go', 'otros']);
  assert.deepEqual(v.grupos[1].categorias.map(c => c.id), ['healthy', 'bocados-vela', 'chilaquiles-vela', 'antojos-dulces']);
});

test('una categoría con todo oculto desaparece, y un grupo vacío también', () => {
  const m = structuredClone(menu);
  for (const p of m.categorias.find(c => c.id === 'otros').productos) p.disponible = false;
  assert.ok(!armarVista(m, temporada).grupos[0].categorias.some(c => c.id === 'otros'));

  for (const c of m.categorias.filter(c => c.grupo === 'comida')) for (const p of c.productos) p.disponible = false;
  assert.deepEqual(armarVista(m, temporada).grupos.map(g => g.id), ['bebidas']);
});

test('los agotados se siguen mostrando', () => {
  const m = structuredClone(menu);
  for (const p of m.categorias.find(c => c.id === 'otros').productos) p.agotado = true;
  assert.ok(armarVista(m, temporada).grupos[0].categorias.some(c => c.id === 'otros'));
});

test('temporada: solo si está activa y tiene productos visibles', () => {
  const t = structuredClone(temporada);
  t.activa = true;
  assert.equal(armarVista(menu, t).temporada, null, 'activa pero vacía');
  t.categoria.productos.push({ id: 'pumpkin', nombre: 'Pumpkin Latte', precios: { unico: 80 } });
  assert.equal(armarVista(menu, t).temporada.id, 'temporada');
  t.activa = false;
  assert.equal(armarVista(menu, t).temporada, null, 'apagada');
});

test('columnas de precio por categoría', () => {
  assert.deepEqual(columnasDeCategoria(menu, cat('clasicas')), ['C', 'F']);
  assert.deepEqual(columnasDeCategoria(menu, cat('special-drinks')), ['C', 'F']);
  assert.deepEqual(columnasDeCategoria(menu, cat('cold-foam')), []);
  assert.deepEqual(columnasDeCategoria(menu, cat('healthy')), []);
  assert.equal(leyendaDeColumnas(menu, ['C', 'F']), 'C caliente · F frío');
});

test('anclas #cat-…', () => {
  const v = armarVista(menu, temporada);
  assert.equal(idAncla(cat('chilaquiles-vela')), 'cat-chilaquiles-vela');
  assert.deepEqual(buscarAncla(v, '#cat-chilaquiles-vela'), { grupo: 'comida', categoria: cat('chilaquiles-vela') });
  assert.equal(buscarAncla(v, '#cat-clasicas').grupo, 'bebidas');
  assert.equal(buscarAncla(v, '#cat-no-existe'), null);
  assert.equal(buscarAncla(v, '#menu'), null);
  assert.equal(buscarAncla(v, ''), null);
});

test('formatos de precio y teléfono', () => {
  assert.equal(formatoPrecio(68), '$68');
  assert.equal(formatoPrecio(1250), '$1,250');
  assert.equal(formatoTelefono('524771358745'), '477 135 8745');
});
