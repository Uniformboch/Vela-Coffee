// Pruebas del carrito: sumas, combinaciones, tope, opciones obligatorias y limpieza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarMenu, cargarTemporada } from './ayuda.mjs';
import {
  CANTIDAD_MAX, claveLinea, agregarLinea, cambiarCantidad, limpiarCarrito, resumenCarrito,
  resolverLinea, erroresSeleccion, precioSeleccion
} from '../sitio/js/logica/carrito.mjs';

const menu = cargarMenu();
const temporada = cargarTemporada();
const linea = (productoId, tamano, cantidad = 1, extras = [], opciones = {}) => ({ productoId, tamano, opciones, extras, cantidad });

test('la misma combinación se suma; el orden de los extras no importa', () => {
  let { lineas } = agregarLinea([], linea('americano', 'F', 1, ['leche-vegetal', 'lata']));
  ({ lineas } = agregarLinea(lineas, linea('americano', 'F', 2, ['lata', 'leche-vegetal'])));
  assert.equal(lineas.length, 1);
  assert.equal(lineas[0].cantidad, 3);
});

test('combinaciones distintas van en líneas separadas', () => {
  let l = [];
  for (const nueva of [
    linea('americano', 'F'),
    linea('americano', 'C'),
    linea('americano', 'F', 1, ['lata']),
    linea('chilaquiles-sencillos', 'unico', 1, [], { salsa: 'verde' }),
    linea('chilaquiles-sencillos', 'unico', 1, [], { salsa: 'roja' })
  ]) l = agregarLinea(l, nueva).lineas;
  assert.equal(l.length, 5);
  assert.equal(new Set(l.map(claveLinea)).size, 5);
});

test(`tope de ${CANTIDAD_MAX} por línea, al agregar y con el botón +`, () => {
  let { lineas, topado } = agregarLinea([], linea('latte', 'C', 15));
  assert.equal(topado, false);
  ({ lineas, topado } = agregarLinea(lineas, linea('latte', 'C', 10)));
  assert.equal(topado, true);
  assert.equal(lineas[0].cantidad, CANTIDAD_MAX);
  assert.equal(cambiarCantidad(lineas, claveLinea(lineas[0]), +1)[0].cantidad, CANTIDAD_MAX);
});

test('bajar a 0 quita la línea', () => {
  const { lineas } = agregarLinea([], linea('latte', 'C', 1));
  assert.deepEqual(cambiarCantidad(lineas, claveLinea(lineas[0]), -1), []);
});

test('precios por línea y total', () => {
  let l = [];
  l = agregarLinea(l, linea('latte', 'F', 2, ['leche-vegetal', 'lata'])).lineas;                           // (68+12+12)×2 = 184
  l = agregarLinea(l, linea('chilaquiles-con-proteina', 'unico', 1, ['aguacate-extra'], { salsa: 'verde', proteina: 'pollo' })).lineas; // 118+20
  l = agregarLinea(l, linea('molletes', 'unico', 1)).lineas;                                                   // 88
  const r = resumenCarrito(menu, temporada, l);
  assert.deepEqual(r.lineas.map(x => x.subtotal), [184, 138, 88]);
  assert.equal(r.total, 410);
  assert.equal(r.piezas, 4);
});

test('la lata no se puede pedir en caliente', () => {
  assert.equal(resolverLinea(menu, temporada, linea('americano', 'C', 1, ['lata'])), null);
  assert.ok(resolverLinea(menu, temporada, linea('americano', 'F', 1, ['lata'])));
});

test('opciones obligatorias: faltantes, valores que no existen y opciones de más', () => {
  assert.equal(resolverLinea(menu, temporada, linea('chilaquiles-con-proteina', 'unico', 1, [], { salsa: 'verde' })), null);
  assert.equal(resolverLinea(menu, temporada, linea('chilaquiles-sencillos', 'unico', 1, [], { salsa: 'morita' })), null);
  assert.equal(resolverLinea(menu, temporada, linea('latte', 'C', 1, [], { salsa: 'verde' })), null);
});

test('una opción que suma precio se cobra', () => {
  const m = structuredClone(menu);
  m.categorias.find(c => c.id === 'antojos-dulces').productos.find(p => p.id === 'galletas-ny')
    .opciones[0].valores.find(v => v.id === 'red-velvet').precio = 5;
  const sel = linea('galletas-ny', 'unico', 2, [], { sabor: 'red-velvet' });
  assert.equal(resolverLinea(m, temporada, sel).subtotal, 80);
  assert.equal(precioSeleccion(m, temporada, sel), 80);
});

test('errores de la hoja de producto', () => {
  assert.deepEqual(erroresSeleccion(menu, temporada, { productoId: 'americano', opciones: {} }),
    { tamano: 'Elige caliente o frío para continuar.' });
  assert.deepEqual(erroresSeleccion(menu, temporada, { productoId: 'chilaquiles-con-proteina', opciones: { proteina: 'huevo' } }),
    { opciones: { salsa: 'Elige salsa para continuar.' } });
  assert.deepEqual(erroresSeleccion(menu, temporada, { productoId: 'galletas-ny', opciones: {} }),
    { opciones: { sabor: 'Elige sabor para continuar.' } });
  // Un solo tamaño: no hay que elegirlo.
  assert.deepEqual(erroresSeleccion(menu, temporada, { productoId: 'mint-latte', opciones: {} }), {});
  assert.deepEqual(erroresSeleccion(menu, temporada, { productoId: 'americano', tamano: 'C', opciones: {} }), {});

  const m = structuredClone(menu);
  m.categorias[0].productos.find(p => p.id === 'moka').agotado = true;
  assert.deepEqual(erroresSeleccion(m, temporada, { productoId: 'moka', tamano: 'C' }), { producto: 'Este producto está agotado.' });
});

test('precio en vivo de la hoja', () => {
  assert.equal(precioSeleccion(menu, temporada, { productoId: 'americano', extras: [], cantidad: 1 }), null);
  assert.equal(precioSeleccion(menu, temporada, { productoId: 'americano', tamano: 'F', extras: ['lata'], cantidad: 3 }), 201);
  assert.equal(precioSeleccion(menu, temporada, { productoId: 'mint-latte', extras: ['leche-vegetal'], cantidad: 1 }), 90);
});

test('limpieza del carrito guardado cuando cambia el menú', () => {
  const guardado = [
    linea('latte', 'F', 2),                                                       // sigue bien
    linea('producto-retirado', 'unico'),                                          // ya no existe
    linea('moka', 'C'),                                                           // se agota
    linea('tisana', 'unico'),                                                     // se oculta
    linea('americano', 'C'),                                                      // quitan el tamaño caliente
    linea('chilaquiles-sencillos', 'unico', 1, [], { salsa: 'roja' }),            // quitan la salsa roja
    linea('cold-brew', 'unico', 1, ['leche-vegetal']),                            // extra que no aplica
    linea('latte', 'C', 0), linea('latte', 'C', 25), linea('latte', 'C', 1.5),    // cantidades inválidas
    null, 'basura', { productoId: 'latte' }
  ];
  const m = structuredClone(menu);
  const clasicas = m.categorias.find(c => c.id === 'clasicas');
  clasicas.productos.find(p => p.id === 'moka').agotado = true;
  delete clasicas.productos.find(p => p.id === 'americano').precios.C;
  m.categorias.find(c => c.id === 'otros').productos.find(p => p.id === 'tisana').disponible = false;
  m.categorias.find(c => c.id === 'chilaquiles-vela').productos[0].opciones[0].valores.pop();

  const { lineas, quitadas } = limpiarCarrito(m, temporada, guardado);
  assert.deepEqual(lineas, [linea('latte', 'F', 2)]);
  assert.equal(quitadas, guardado.length - 1);
  assert.deepEqual(limpiarCarrito(m, temporada, 'no es lista'), { lineas: [], quitadas: 0 });
});

test('productos de temporada se pueden pedir y se limpian si la temporada se apaga', () => {
  const t = structuredClone(temporada);
  t.activa = true;
  t.categoria.productos.push({ id: 'pumpkin-latte', nombre: 'Pumpkin Latte', precios: { unico: 85 } });
  const l = [linea('pumpkin-latte', 'unico', 2)];
  assert.equal(resumenCarrito(menu, t, l).total, 170);
  t.activa = false;
  assert.equal(limpiarCarrito(menu, t, l).quitadas, 1);
});
