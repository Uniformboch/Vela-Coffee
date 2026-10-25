import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aId, idUnico, idsDeProductos } from '../sitio/js/logica/ids.mjs';
import { cargarMenu, cargarTemporada } from './ayuda.mjs';

test('ids a partir del nombre', () => {
  assert.equal(aId('Café de Olla'), 'cafe-de-olla');
  assert.equal(aId('  Pan Francés (2pz) '), 'pan-frances-2pz');
  assert.equal(aId('¡¡!!'), 'nuevo');
  assert.equal(aId('x'.repeat(80)).length, 50);
});

test('ids únicos: no repiten ninguno existente', () => {
  const usados = idsDeProductos(cargarMenu(), cargarTemporada());
  assert.equal(idUnico('Latte', usados), 'latte-2');
  usados.add('latte-2');
  assert.equal(idUnico('Látte', usados), 'latte-3');
  assert.equal(idUnico('Pumpkin Latte', usados), 'pumpkin-latte');
});
