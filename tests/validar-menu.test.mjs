// Pruebas del validador con menús mal formados: cada error debe detectarse y explicarse en español.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarMenu, cargarTemporada } from './ayuda.mjs';
import { validarMenu } from '../sitio/js/logica/validar-menu.mjs';

const copia = () => ({ menu: cargarMenu(), temporada: cargarTemporada() });
const errores = cambio => { const d = copia(); cambio(d); return validarMenu(d.menu, d.temporada); };
const contiene = (lista, texto) => assert.ok(lista.some(e => e.includes(texto)), `se esperaba "${texto}" en:\n${lista.join('\n')}`);

test('precio fuera de rango, decimal o como texto', () => {
  contiene(errores(d => { d.menu.categorias[0].productos[0].precios.C = 0; }), 'número entero de 1 a 9999');
  contiene(errores(d => { d.menu.categorias[0].productos[0].precios.C = 10000; }), 'número entero de 1 a 9999');
  contiene(errores(d => { d.menu.categorias[0].productos[0].precios.C = 40.5; }), 'número entero de 1 a 9999');
  contiene(errores(d => { d.menu.categorias[0].productos[0].precios.C = '40'; }), 'número entero de 1 a 9999');
  contiene(errores(d => { d.menu.extras[0].precio = -1; }), 'Extra 1');
});

test('precio único mezclado con tamaños, tamaño desconocido y sin precio', () => {
  contiene(errores(d => { d.menu.categorias[0].productos[1].precios.unico = 50; }), 'precio único y por tamaño');
  contiene(errores(d => { d.menu.categorias[0].productos[1].precios.G = 50; }), 'tamaño desconocido "G"');
  contiene(errores(d => { d.menu.categorias[0].productos[1].precios = {}; }), 'falta el precio');
});

test('ids repetidos o mal escritos', () => {
  contiene(errores(d => { d.menu.categorias[0].productos[1].id = 'espresso'; }), 'está repetido');
  contiene(errores(d => { d.menu.categorias[1].id = 'clasicas'; }), 'está repetido');
  contiene(errores(d => { d.menu.categorias[0].productos[0].id = 'Espresso Doble'; }), 'identificador no válido');
  contiene(errores(d => {
    d.temporada.categoria.productos.push({ id: 'latte', nombre: 'Latte de temporada', precios: { unico: 80 } });
  }), 'está repetido');
});

test('campos desconocidos', () => {
  contiene(errores(d => { d.menu.categorias[0].productos[0].oferta = true; }), 'campo desconocido "oferta"');
  contiene(errores(d => { d.menu.otro = 1; }), 'campo desconocido "otro"');
});

test('opciones con menos de 2 o más de 15 valores', () => {
  const galletas = d => d.menu.categorias.find(c => c.id === 'antojos-dulces').productos.find(p => p.id === 'galletas-ny');
  contiene(errores(d => { galletas(d).opciones[0].valores.splice(1); }), 'de 2 a 15 valores');
  contiene(errores(d => {
    galletas(d).opciones[0].valores = Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, nombre: `Sabor ${i}` }));
  }), 'de 2 a 15 valores');
  contiene(errores(d => { galletas(d).opciones[0].valores[0].precio = 0; }), 'precio extra');
});

test('extras que no existen o repetidos', () => {
  contiene(errores(d => { d.menu.categorias[0].extrasPermitidos.push('crema-batida'); }), 'el extra "crema-batida" no existe');
  contiene(errores(d => { d.menu.categorias[0].extrasPermitidos.push('lata'); }), 'el extra "lata" está repetido');
  contiene(errores(d => { d.menu.extras[1].tamanos = ['X']; }), 'lista de tamaños no es válida');
});

test('WhatsApp de 10 a 15 dígitos', () => {
  contiene(errores(d => { d.menu.config.whatsapp = '477135874'; }), '10 a 15 dígitos');
  contiene(errores(d => { d.menu.config.whatsapp = '52 477 135 8745'; }), '10 a 15 dígitos');
  assert.deepEqual(errores(d => { d.menu.config.whatsapp = '4771358745'; }), []);
});

test('grupo de categoría y nombres vacíos', () => {
  contiene(errores(d => { d.menu.categorias[0].grupo = 'postres'; }), 'bebidas o comida');
  contiene(errores(d => { d.menu.categorias[0].productos[0].nombre = '  '; }), 'el nombre no es válido');
});

test('temporada: precio único y fotos que existan', () => {
  const conProducto = (d, p) => d.temporada.categoria.productos.push({ id: 'pumpkin-latte', nombre: 'Pumpkin Latte', ...p });
  contiene(errores(d => conProducto(d, { precios: { C: 80 } })), 'llevan precio único');
  assert.deepEqual(errores(d => conProducto(d, { precios: { unico: 80 }, imagen: 'fotos/abc123.jpg' })), []);
  contiene(errores(d => conProducto(d, { precios: { unico: 80 }, imagen: '../secreto.jpg' })), 'la foto no es válida');

  const d = copia();
  conProducto(d, { precios: { unico: 80 }, imagen: 'fotos/abc123.jpg' });
  contiene(validarMenu(d.menu, d.temporada, { fotosExistentes: new Set() }), 'la foto ya no existe');
  assert.deepEqual(validarMenu(d.menu, d.temporada, { fotosExistentes: new Set(['fotos/abc123.jpg']) }), []);
});

test('entradas que no son objetos no truenan', () => {
  assert.ok(validarMenu(null, null).length > 0);
  assert.ok(validarMenu({ config: 1, tamanos: [], extras: {}, categorias: 'x' }, { activa: 'si', categoria: null }).length > 0);
});
