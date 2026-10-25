// Pruebas del mensaje de WhatsApp (formato exacto), el enlace, el formulario y el horario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarMenu, cargarTemporada } from './ayuda.mjs';
import { agregarLinea, resumenCarrito } from '../sitio/js/logica/carrito.mjs';
import { armarMensaje, enlaceWhatsApp, validarDatos } from '../sitio/js/logica/pedido.mjs';
import { estaAbierto } from '../sitio/js/logica/horario.mjs';

const menu = cargarMenu();
const temporada = cargarTemporada();

function pedidoEjemplo() {
  let l = [];
  for (const nueva of [
    { productoId: 'latte', tamano: 'F', opciones: {}, extras: ['lata', 'leche-vegetal'], cantidad: 2 },
    { productoId: 'chilaquiles-con-proteina', tamano: 'unico', opciones: { proteina: 'pollo', salsa: 'verde' }, extras: ['aguacate-extra'], cantidad: 1 },
    { productoId: 'molletes', tamano: 'unico', opciones: {}, extras: [], cantidad: 1 },
    { productoId: 'cold-brew', tamano: 'unico', opciones: {}, extras: [], cantidad: 1 },
    { productoId: 'latte', tamano: 'C', opciones: {}, extras: [], cantidad: 1 }
  ]) l = agregarLinea(l, nueva).lineas;
  return resumenCarrito(menu, temporada, l);
}

test('mensaje exacto: a domicilio con notas', () => {
  const mensaje = armarMensaje(menu, pedidoEjemplo(), {
    nombre: '  Ana   López ', entrega: 'domicilio', direccion: 'Blvd. del Valle 200,\nLeón', notas: 'sin cebolla'
  });
  assert.equal(mensaje, [
    'Hola, Vela Coffee. Quiero hacer un pedido:',
    '',
    '• 2 × Latte (Frío) + Leche vegetal, Cambio de vaso a lata — $184',
    '• 1 × Chilaquiles con proteína (Salsa verde, Pollo) + Aguacate extra — $138',
    '• 1 × Molletes 2 pz — $88',
    '• 1 × Cold Brew — $68',
    '• 1 × Latte (Caliente) — $58',
    '',
    '*Total: $536*',
    '',
    'Nombre: Ana López',
    'Entrega: A domicilio',
    'Dirección: Blvd. del Valle 200, León',
    'Envío: por confirmar',
    'Notas: sin cebolla'
  ].join('\n'));
});

test('para llevar: sin dirección ni envío; sin notas si están vacías', () => {
  const mensaje = armarMensaje(menu, pedidoEjemplo(), { nombre: 'Ana', entrega: 'llevar', direccion: 'Calle 1', notas: '   ' });
  assert.ok(mensaje.endsWith('Nombre: Ana\nEntrega: Para llevar'));
  assert.ok(!mensaje.includes('Dirección'));
  assert.ok(!mensaje.includes('Envío'));
  assert.ok(!mensaje.includes('Notas'));
});

test('enlace de WhatsApp codificado', () => {
  const mensaje = armarMensaje(menu, pedidoEjemplo(), { nombre: 'Ana & Luis', entrega: 'llevar' });
  const enlace = enlaceWhatsApp(menu.config.whatsapp, mensaje);
  assert.ok(enlace.startsWith('https://wa.me/524771358745?text=Hola%2C%20Vela%20Coffee.'));
  assert.ok(!/[\s&#×•—]/.test(enlace.split('?text=')[1]), 'nada sin codificar');
  assert.ok(enlace.includes('%0A'));
  assert.equal(decodeURIComponent(enlace.split('?text=')[1]), mensaje);
  assert.equal(new URL(enlace).searchParams.get('text'), mensaje);
});

test('validación del formulario', () => {
  assert.deepEqual(validarDatos({}), { nombre: 'Escribe tu nombre.', entrega: 'Elige para llevar o a domicilio.' });
  assert.deepEqual(validarDatos({ nombre: '   ', entrega: 'llevar' }), { nombre: 'Escribe tu nombre.' });
  assert.deepEqual(validarDatos({ nombre: 'Ana', entrega: 'domicilio', direccion: ' ' }), { direccion: 'Escribe la dirección de entrega.' });
  assert.deepEqual(validarDatos({ nombre: 'Ana', entrega: 'llevar' }), {});
  assert.deepEqual(validarDatos({ nombre: 'Ana', entrega: 'domicilio', direccion: 'Calle 1' }), {});
  assert.deepEqual(validarDatos({ nombre: 'Ana', entrega: 'recoger' }), { entrega: 'Elige para llevar o a domicilio.' });
  assert.ok(validarDatos({ nombre: 'A'.repeat(61), entrega: 'llevar' }).nombre.includes('muy largo'));
  assert.ok(validarDatos({ nombre: 'Ana', entrega: 'llevar', notas: 'x'.repeat(301) }).notas.includes('muy largas'));
});

test('horario: lunes a sábado de 8:00 a 21:00, hora de León', () => {
  // León está en UTC−6 todo el año.
  assert.equal(estaAbierto(new Date('2026-10-26T13:59:00Z')), false, 'lunes 7:59');
  assert.equal(estaAbierto(new Date('2026-10-26T14:00:00Z')), true, 'lunes 8:00');
  assert.equal(estaAbierto(new Date('2026-10-27T02:59:00Z')), true, 'lunes 20:59');
  assert.equal(estaAbierto(new Date('2026-10-27T03:00:00Z')), false, 'lunes 21:00');
  assert.equal(estaAbierto(new Date('2026-10-24T18:00:00Z')), true, 'sábado 12:00');
  assert.equal(estaAbierto(new Date('2026-10-25T18:00:00Z')), false, 'domingo 12:00');
});
