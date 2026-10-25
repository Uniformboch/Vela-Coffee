// Pruebas del servidor del panel con un almacén en memoria que imita Netlify Blobs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarMenu, cargarTemporada } from './ayuda.mjs';
import { crearServidor, MAX_RESPALDOS } from '../netlify/lib/servidor.mjs';
import { crearAlmacenMemoria } from '../netlify/lib/almacen-memoria.mjs';
import { crearHash, verificarContrasena, ITERACIONES, crearSesion, sesionValida, DURACION_SESION } from '../netlify/lib/seguridad.mjs';

const ORIGEN = 'https://vela.example';
const CONTRASENA = 'prueba-correcta-123';
// Para que las pruebas sean rápidas se usan pocas iteraciones; la de 600 000 se prueba aparte.
const HASH = await crearHash(CONTRASENA, { iteraciones: 1000 });

function preparar({ secretos = { hash: HASH, clave: 'clave-de-prueba' } } = {}) {
  const reloj = { t: Date.UTC(2026, 9, 24, 15, 0, 0) };
  const almacenes = { estado: crearAlmacenMemoria(), fotos: crearAlmacenMemoria(), respaldos: crearAlmacenMemoria(), intentos: crearAlmacenMemoria() };
  const servidor = crearServidor({ almacenes, secretos, inicial: { menu: cargarMenu(), temporada: cargarTemporada() }, ahora: () => reloj.t });
  let cookie = '';

  async function pedir(metodo, ruta, cuerpo, { origen = ORIGEN, xMenu = '1', ip = '1.2.3.4', tipo, sinCookie = false } = {}) {
    const headers = { origin: origen };
    if (xMenu) headers['x-menu'] = xMenu;
    if (cookie && !sinCookie) headers.cookie = cookie;
    let body;
    if (cuerpo instanceof Uint8Array) { body = cuerpo; headers['content-type'] = tipo ?? 'application/octet-stream'; }
    else if (cuerpo !== undefined) { body = JSON.stringify(cuerpo); headers['content-type'] = 'application/json'; }
    const r = await servidor.api(new Request(ORIGEN + ruta, { method: metodo, headers, body }), { ip });
    const datos = await r.json();
    return { estado: r.status, datos, cabeceras: r.headers };
  }

  async function entrar() {
    const r = await pedir('POST', '/api/login', { contrasena: CONTRASENA });
    assert.equal(r.estado, 200);
    cookie = r.cabeceras.get('set-cookie').split(';')[0];
    return r;
  }

  const publico = async ruta => servidor.publico(new Request(ORIGEN + ruta));
  return { servidor, almacenes, reloj, pedir, entrar, publico, olvidarCookie: () => { cookie = ''; } };
}

// Imágenes mínimas reconocibles por su contenido
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = new Uint8Array([...'RIFF'].map(c => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map(c => c.charCodeAt(0))));

// ---------- Contraseña y sesión ----------

test('el hash usa PBKDF2-SHA256 con 600 000 iteraciones y no guarda la contraseña', async () => {
  const hash = await crearHash('una-contraseña-larga');
  assert.match(hash, new RegExp(`^pbkdf2_sha256\\$${ITERACIONES}\\$`));
  assert.ok(!hash.includes('una-contraseña-larga'));
  assert.equal(await verificarContrasena('una-contraseña-larga', hash), true);
  assert.equal(await verificarContrasena('otra', hash), false);
  assert.equal(await verificarContrasena('x', 'basura'), false);
});

test('la sesión vence a las 12 horas y no se puede falsificar', () => {
  const t = 1_000_000;
  const s = crearSesion('clave', t);
  assert.equal(sesionValida('clave', s, t + DURACION_SESION - 1), true);
  assert.equal(sesionValida('clave', s, t + DURACION_SESION), false);
  assert.equal(sesionValida('otra-clave', s, t), false);
  const [vence, firma] = s.split('.');
  assert.equal(sesionValida('clave', `${Number(vence) + 1000}.${firma}`, t), false);
  assert.equal(sesionValida('clave', 'nada', t), false);
});

test('sin variables configuradas: el panel lo dice y no deja entrar', async () => {
  const { pedir } = preparar({ secretos: {} });
  assert.deepEqual((await pedir('GET', '/api/sesion')).datos, { configurado: false, sesion: false });
  assert.equal((await pedir('POST', '/api/login', { contrasena: 'x' })).estado, 503);
  assert.equal((await pedir('GET', '/api/menu')).estado, 503);
});

test('sesión requerida en todas las rutas del panel', async () => {
  const { pedir } = preparar();
  for (const [m, r, c] of [['GET', '/api/menu'], ['PUT', '/api/menu', {}], ['POST', '/api/imagen', JPG], ['GET', '/api/respaldos'], ['POST', '/api/respaldos/restaurar', {}]]) {
    const res = await pedir(m, r, c);
    assert.equal(res.estado, 401, `${m} ${r}`);
    assert.equal(res.datos.sesion, false);
  }
});

test('rechaza solicitudes de otros sitios o sin el encabezado propio', async () => {
  const { pedir, entrar } = preparar();
  await entrar();
  assert.equal((await pedir('PUT', '/api/menu', {}, { origen: 'https://malo.example' })).estado, 403);
  assert.equal((await pedir('PUT', '/api/menu', {}, { xMenu: null })).estado, 403);
  assert.equal((await pedir('POST', '/api/login', { contrasena: CONTRASENA }, { origen: 'https://malo.example' })).estado, 403);
  assert.equal((await pedir('POST', '/api/logout', {}, { origen: null })).estado, 403);
});

test('entrar: cookie segura de 12 horas; salir la borra', async () => {
  const { pedir, entrar } = preparar();
  const r = await entrar();
  const cookie = r.cabeceras.get('set-cookie');
  for (const parte of ['vela_sesion=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api', 'Max-Age=43200']) assert.ok(cookie.includes(parte), parte);
  assert.deepEqual((await pedir('GET', '/api/sesion')).datos, { configurado: true, sesion: true });
  const salir = await pedir('POST', '/api/logout', {});
  assert.ok(salir.cabeceras.get('set-cookie').includes('Max-Age=0'));
});

test('la sesión vencida pide entrar otra vez', async () => {
  const { pedir, entrar, reloj } = preparar();
  await entrar();
  reloj.t += DURACION_SESION + 1;
  assert.equal((await pedir('GET', '/api/menu')).estado, 401);
});

test('bloqueo por IP: 5 fallos → 30 s, luego el doble, hasta 15 minutos', async () => {
  const { pedir, reloj } = preparar();
  const fallar = (ip = '9.9.9.9') => pedir('POST', '/api/login', { contrasena: 'mala' }, { ip });
  for (let i = 1; i <= 4; i++) assert.equal((await fallar()).estado, 401, `fallo ${i}`);
  let r = await fallar();
  assert.equal(r.estado, 429);
  assert.equal(r.datos.espera, 30);
  // Mientras está bloqueado, ni la contraseña correcta entra.
  r = await pedir('POST', '/api/login', { contrasena: CONTRASENA }, { ip: '9.9.9.9' });
  assert.equal(r.estado, 429);
  assert.match(r.datos.errores[0], /Espera 30 segundos/);
  // Otra IP no está bloqueada.
  assert.equal((await pedir('POST', '/api/login', { contrasena: CONTRASENA }, { ip: '8.8.8.8' })).estado, 200);

  const esperas = [];
  for (let i = 0; i < 6; i++) {
    reloj.t += 16 * 60_000;
    esperas.push((await fallar()).datos.espera);
  }
  assert.deepEqual(esperas, [60, 120, 240, 480, 900, 900]);

  // Al entrar bien, el contador se reinicia.
  reloj.t += 16 * 60_000;
  assert.equal((await pedir('POST', '/api/login', { contrasena: CONTRASENA }, { ip: '9.9.9.9' })).estado, 200);
  assert.equal((await fallar()).estado, 401);
});

// ---------- Menú ----------

test('sin nada guardado se sirve el menú del repositorio', async () => {
  const { pedir, entrar, publico } = preparar();
  await entrar();
  const r = await pedir('GET', '/api/menu');
  assert.deepEqual(r.datos.menu, cargarMenu());
  assert.equal(r.datos.version, null);
  const p = await publico('/menu.json');
  assert.equal(p.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await p.json(), cargarMenu());
  assert.deepEqual(await (await publico('/menu-temporada.json')).json(), cargarTemporada());
});

test('guardar: se publica, respalda la versión anterior y cambia la versión', async () => {
  const { pedir, entrar, publico, almacenes } = preparar();
  await entrar();
  const { menu, temporada, version } = (await pedir('GET', '/api/menu')).datos;
  menu.categorias[0].productos[0].precios.C = 42;
  const r = await pedir('PUT', '/api/menu', { menu, temporada, version });
  assert.equal(r.estado, 200);
  assert.ok(r.datos.version);
  assert.equal((await (await publico('/menu.json')).json()).categorias[0].productos[0].precios.C, 42);

  const resp = (await pedir('GET', '/api/respaldos')).datos.respaldos;
  assert.equal(resp.length, 1);
  assert.equal((await almacenes.respaldos.get(resp[0].id, { type: 'json' })).menu.categorias[0].productos[0].precios.C, 40);
});

test('conflicto de versión: si otro dispositivo guardó primero, responde 409', async () => {
  const { pedir, entrar } = preparar();
  await entrar();
  const { menu, temporada, version } = (await pedir('GET', '/api/menu')).datos;
  assert.equal((await pedir('PUT', '/api/menu', { menu, temporada, version })).estado, 200);
  const r = await pedir('PUT', '/api/menu', { menu, temporada, version });
  assert.equal(r.estado, 409);
  assert.equal(r.datos.conflicto, true);
  assert.match(r.datos.errores[0], /otro dispositivo/);
});

test('dos guardados al mismo tiempo: uno gana y el otro recibe 409', async () => {
  const { pedir, entrar, almacenes } = preparar();
  await entrar();
  let { menu, temporada, version } = (await pedir('GET', '/api/menu')).datos;
  // Una vez sin versión (primer guardado) y otra con versión.
  for (let ronda = 0; ronda < 2; ronda++) {
    const a = structuredClone(menu); a.categorias[0].productos[0].precios.C = 41;
    const b = structuredClone(menu); b.categorias[0].productos[0].precios.C = 43;
    const [ra, rb] = await Promise.all([
      pedir('PUT', '/api/menu', { menu: a, temporada, version }),
      pedir('PUT', '/api/menu', { menu: b, temporada, version })
    ]);
    assert.deepEqual([ra.estado, rb.estado].sort(), [200, 409], `ronda ${ronda}`);
    ({ menu, temporada, version } = (await pedir('GET', '/api/menu')).datos);
  }
  assert.equal((await almacenes.respaldos.list()).blobs.length, 2, 'solo el ganador respalda');
});

test('menú inválido: se rechaza con errores en español y no se respalda nada', async () => {
  const { pedir, entrar, almacenes, publico } = preparar();
  await entrar();
  const { menu, temporada, version } = (await pedir('GET', '/api/menu')).datos;
  menu.categorias[0].productos[0].precios.C = 0;
  menu.categorias[0].productos[1].id = 'espresso';
  const r = await pedir('PUT', '/api/menu', { menu, temporada, version });
  assert.equal(r.estado, 400);
  assert.ok(r.datos.errores.some(e => e.includes('número entero de 1 a 9999')));
  assert.ok(r.datos.errores.some(e => e.includes('repetido')));
  assert.equal((await almacenes.respaldos.list()).blobs.length, 0);
  assert.deepEqual(await (await publico('/menu.json')).json(), cargarMenu());

  assert.equal((await pedir('PUT', '/api/menu', new Uint8Array([1, 2, 3]))).estado, 400);
  assert.equal((await pedir('PUT', '/api/menu', { menu: null, temporada: null })).estado, 400);
});

// ---------- Fotos ----------

test('subida de fotos: JPG, PNG y WebP por su contenido; se entregan con caché larga', async () => {
  const { pedir, entrar, publico } = preparar();
  await entrar();
  for (const [bytes, ext, tipo] of [[JPG, 'jpg', 'image/jpeg'], [PNG, 'png', 'image/png'], [WEBP, 'webp', 'image/webp']]) {
    // El tipo que dice el navegador no importa: manda el contenido.
    const r = await pedir('POST', '/api/imagen', bytes, { tipo: 'text/plain' });
    assert.equal(r.estado, 200);
    assert.match(r.datos.ruta, new RegExp(`^fotos/[a-f0-9]{24}\\.${ext}$`));
    const f = await publico('/' + r.datos.ruta);
    assert.equal(f.status, 200);
    assert.equal(f.headers.get('content-type'), tipo);
    assert.match(f.headers.get('cache-control'), /max-age=31536000/);
    assert.deepEqual(new Uint8Array(await f.arrayBuffer()), bytes);
  }
});

test('fotos rechazadas: disfrazadas, demasiado grandes o rutas raras', async () => {
  const { pedir, entrar, publico } = preparar();
  await entrar();
  const html = new TextEncoder().encode('<script>alert(1)</script>');
  const r = await pedir('POST', '/api/imagen', html, { tipo: 'image/jpeg' });
  assert.equal(r.estado, 400);
  assert.equal(r.datos.errores[0], 'Solo se aceptan fotos JPG, PNG o WebP.');
  const grande = new Uint8Array(4 * 1024 * 1024 + 1); grande.set(JPG);
  assert.equal((await pedir('POST', '/api/imagen', grande)).estado, 413);
  for (const ruta of ['/fotos/..%2fmenu.json', '/fotos/%2e%2e%2fsecreto', '/fotos/abc.jpg', '/fotos/' + 'a'.repeat(24) + '.jpg']) assert.equal((await publico(ruta)).status, 404, ruta);
});

test('la temporada solo puede usar fotos que existan', async () => {
  const { pedir, entrar } = preparar();
  await entrar();
  const { menu, temporada, version } = (await pedir('GET', '/api/menu')).datos;
  temporada.activa = true;
  temporada.categoria.productos.push({ id: 'pumpkin', nombre: 'Pumpkin Latte', precios: { unico: 85 }, imagen: 'fotos/' + 'b'.repeat(24) + '.jpg' });
  const mal = await pedir('PUT', '/api/menu', { menu, temporada, version });
  assert.equal(mal.estado, 400);
  assert.ok(mal.datos.errores.some(e => e.includes('la foto ya no existe')));
  temporada.categoria.productos[0].imagen = (await pedir('POST', '/api/imagen', JPG)).datos.ruta;
  assert.equal((await pedir('PUT', '/api/menu', { menu, temporada, version })).estado, 200);
});

// ---------- Respaldos ----------

test('restaurar un respaldo: respalda lo actual y respeta la versión', async () => {
  const { pedir, entrar, publico } = preparar();
  await entrar();
  let { menu, temporada, version } = (await pedir('GET', '/api/menu')).datos;
  menu.config.whatsapp = '524770000000';
  version = (await pedir('PUT', '/api/menu', { menu, temporada, version })).datos.version;
  const [respaldo] = (await pedir('GET', '/api/respaldos')).datos.respaldos;

  assert.equal((await pedir('POST', '/api/respaldos/restaurar', { id: respaldo.id, version: 'vieja' })).estado, 409);
  const r = await pedir('POST', '/api/respaldos/restaurar', { id: respaldo.id, version });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.menu.config.whatsapp, '524771358745');
  assert.equal((await (await publico('/menu.json')).json()).config.whatsapp, '524771358745');
  assert.equal((await pedir('GET', '/api/respaldos')).datos.respaldos.length, 2);

  assert.equal((await pedir('POST', '/api/respaldos/restaurar', { id: '000000000000001-abcdef', version: r.datos.version })).estado, 404);
  assert.equal((await pedir('POST', '/api/respaldos/restaurar', { id: '../x', version: r.datos.version })).estado, 400);
});

test(`se conservan solo los últimos ${MAX_RESPALDOS} respaldos`, async () => {
  const { pedir, entrar, reloj } = preparar();
  await entrar();
  let { menu, temporada, version } = (await pedir('GET', '/api/menu')).datos;
  for (let i = 0; i < MAX_RESPALDOS + 5; i++) {
    reloj.t += 1000;
    menu.categorias[0].productos[0].precios.C = 100 + i;
    version = (await pedir('PUT', '/api/menu', { menu, temporada, version })).datos.version;
  }
  const lista = (await pedir('GET', '/api/respaldos')).datos.respaldos;
  assert.equal(lista.length, MAX_RESPALDOS);
  assert.ok(lista[0].fecha > lista.at(-1).fecha, 'el más reciente primero');
});
