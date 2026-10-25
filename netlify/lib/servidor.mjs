// Lógica del servidor: API del panel (/api/*) y datos públicos (/menu.json, /menu-temporada.json, /fotos/*).
// No depende de Netlify: los almacenes, los secretos y el reloj se inyectan (así se prueba con memoria).
import { randomBytes } from 'node:crypto';
import { validarMenu } from '../../sitio/js/logica/validar-menu.mjs';
import {
  verificarContrasena, crearSesion, sesionValida, leerCookie, cookieSesion, cookieBorrar, sha256, COOKIE,
  normalizarSecreto, hashValido
} from './seguridad.mjs';
import { MAX_FOTO, tipoDeImagen, NOMBRE_FOTO } from './imagenes.mjs';

export const MAX_RESPALDOS = 60;
export const MAX_FALLOS = 5;
export const ESPERA_INICIAL = 30_000;
export const ESPERA_MAXIMA = 15 * 60_000;
const MAX_JSON = 1_000_000;
const CLAVE_ESTADO = 'menu';

const ENCABEZADOS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin'
};

function responder(estado, cuerpo, extra = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...ENCABEZADOS, ...extra }
  });
}
const error = (estado, mensajes, extra = {}, cabeceras = {}) =>
  responder(estado, { errores: Array.isArray(mensajes) ? mensajes : [mensajes], ...extra }, cabeceras);

const textoEspera = s => s < 60 ? `${s} segundos` : `${Math.ceil(s / 60)} minutos`;

class ErrorSolicitud extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

function leerJson(bytes) {
  if (bytes.length > MAX_JSON) throw new ErrorSolicitud(413, 'Los datos son demasiado grandes.');
  try {
    const datos = JSON.parse(new TextDecoder().decode(bytes));
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) throw new Error();
    return datos;
  } catch { throw new ErrorSolicitud(400, 'Los datos no tienen el formato correcto.'); }
}

/**
 * almacenes: { estado, fotos, respaldos, intentos } con la forma de Netlify Blobs.
 * secretos: { hash, clave } (ADMIN_PASSWORD_HASH y SESSION_SECRET).
 * inicial: { menu, temporada } del repositorio, mientras no exista nada guardado.
 */
export function crearServidor({ almacenes, secretos: secretosPegados, inicial, ahora = () => Date.now() }) {
  const { estado, fotos, respaldos, intentos } = almacenes;
  const secretos = { hash: normalizarSecreto(secretosPegados?.hash), clave: normalizarSecreto(secretosPegados?.clave) };
  // Si una variable existe pero quedó mal pegada, el panel lo dice (sin mostrar su valor).
  const problemas = [];
  if (secretos.hash && !hashValido(secretos.hash)) problemas.push('La variable ADMIN_PASSWORD_HASH en Netlify no tiene el formato correcto: vuelve a generarla y pégala completa.');
  if (secretos.clave && secretos.clave.length < 32) problemas.push('La variable SESSION_SECRET en Netlify es demasiado corta: vuelve a generarla y pégala completa.');
  const configurado = Boolean(secretos.hash && secretos.clave) && problemas.length === 0;

  async function leerEstado() {
    const r = await estado.getWithMetadata(CLAVE_ESTADO, { type: 'json' });
    return r ? { menu: r.data.menu, temporada: r.data.temporada, version: r.etag } : { ...structuredClone(inicial), version: null };
  }

  async function respaldar(datos) {
    const id = `${String(ahora()).padStart(15, '0')}-${randomBytes(3).toString('hex')}`;
    await respaldos.setJSON(id, datos);
    const { blobs } = await respaldos.list();
    const sobrantes = blobs.map(b => b.key).sort().slice(0, Math.max(0, blobs.length - MAX_RESPALDOS));
    for (const clave of sobrantes) await respaldos.delete(clave);
  }

  /** Escritura condicional: solo si nadie guardó desde que se leyó "version". Respalda lo anterior. */
  async function guardarEstado(datos, version) {
    const actual = await estado.getWithMetadata(CLAVE_ESTADO, { type: 'json' });
    const etag = actual?.etag ?? null;
    if (version !== etag) return { conflicto: true };
    const r = etag
      ? await estado.setJSON(CLAVE_ESTADO, datos, { onlyIfMatch: etag })
      : await estado.setJSON(CLAVE_ESTADO, datos, { onlyIfNew: true });
    if (!r.modified) return { conflicto: true };
    await respaldar(actual?.data ?? inicial);
    return { version: r.etag ?? (await estado.getWithMetadata(CLAVE_ESTADO))?.etag };
  }

  const conflicto = () => error(409, 'El menú se cambió desde otro dispositivo. Recarga para ver la versión más reciente.', { conflicto: true });

  const haySesion = request => configurado && sesionValida(secretos.clave, leerCookie(request, COOKIE), ahora());

  async function login(request, bytes, ip) {
    if (!configurado) return error(503, 'El panel aún no está configurado.');
    const clave = `ip-${sha256(ip).slice(0, 32)}`;
    const registro = (await intentos.get(clave, { type: 'json' })) ?? { fallos: 0, hasta: 0 };
    if (registro.hasta > ahora()) {
      const s = Math.ceil((registro.hasta - ahora()) / 1000);
      return error(429, `Demasiados intentos. Espera ${textoEspera(s)} e intenta de nuevo.`, { espera: s }, { 'Retry-After': String(s) });
    }
    const { contrasena } = leerJson(bytes);
    const correcta = typeof contrasena === 'string' && contrasena.length > 0 && contrasena.length <= 200
      && await verificarContrasena(contrasena, secretos.hash);
    if (!correcta) {
      const fallos = registro.fallos + 1;
      const hasta = fallos >= MAX_FALLOS ? ahora() + Math.min(ESPERA_INICIAL * 2 ** (fallos - MAX_FALLOS), ESPERA_MAXIMA) : 0;
      await intentos.setJSON(clave, { fallos, hasta });
      if (hasta) {
        const s = Math.ceil((hasta - ahora()) / 1000);
        return error(429, `Contraseña incorrecta. Demasiados intentos: espera ${textoEspera(s)}.`, { espera: s }, { 'Retry-After': String(s) });
      }
      return error(401, 'Contraseña incorrecta.');
    }
    await intentos.delete(clave);
    return responder(200, { ok: true }, { 'Set-Cookie': cookieSesion(crearSesion(secretos.clave, ahora())) });
  }

  async function guardarMenu(bytes) {
    const { menu, temporada, version = null } = leerJson(bytes);
    if (version !== null && typeof version !== 'string') return error(400, 'Los datos no tienen el formato correcto.');
    const fotosExistentes = new Set((await fotos.list()).blobs.map(b => `fotos/${b.key}`));
    const errores = validarMenu(menu, temporada, { fotosExistentes });
    if (errores.length) return error(400, errores);
    const r = await guardarEstado({ menu, temporada }, version);
    return r.conflicto ? conflicto() : responder(200, { version: r.version });
  }

  async function subirFoto(bytes) {
    if (bytes.length > MAX_FOTO) return error(413, 'La foto pesa más de 4 MB.');
    const tipo = tipoDeImagen(bytes);
    if (!tipo) return error(400, 'Solo se aceptan fotos JPG, PNG o WebP.');
    const nombre = `${sha256(bytes).slice(0, 24)}.${tipo.ext}`;
    await fotos.set(nombre, bytes.slice().buffer, { metadata: { tipo: tipo.tipo } });
    return responder(200, { ruta: `fotos/${nombre}` });
  }

  async function listarRespaldos() {
    const { blobs } = await respaldos.list();
    const lista = blobs.map(b => b.key).sort().reverse()
      .map(id => ({ id, fecha: new Date(Number(id.split('-')[0])).toISOString() }));
    return responder(200, { respaldos: lista });
  }

  async function restaurar(bytes) {
    const { id, version = null } = leerJson(bytes);
    if (typeof id !== 'string' || !/^\d{15}-[a-f0-9]{6}$/.test(id)) return error(400, 'Respaldo no válido.');
    const datos = await respaldos.get(id, { type: 'json' });
    if (!datos) return error(404, 'Ese respaldo ya no existe.');
    const r = await guardarEstado(datos, version);
    return r.conflicto ? conflicto() : responder(200, { version: r.version, menu: datos.menu, temporada: datos.temporada });
  }

  /** /api/* */
  async function api(request, { ip = 'desconocida' } = {}) {
    try {
      const url = new URL(request.url);
      const ruta = url.pathname.replace(/\/+$/, '');
      const metodo = request.method;
      // Siempre se lee el cuerpo antes de responder (si no, Windows puede cortar la conexión en local).
      const bytes = metodo === 'GET' || metodo === 'HEAD' ? new Uint8Array() : new Uint8Array(await request.arrayBuffer());

      if (metodo !== 'GET' && metodo !== 'HEAD') {
        if (request.headers.get('x-menu') !== '1' || request.headers.get('origin') !== url.origin) return error(403, 'Solicitud no permitida.');
      }

      if (ruta === '/api/sesion' && metodo === 'GET') {
        return responder(200, { configurado, sesion: haySesion(request), ...(problemas.length ? { problemas } : {}) });
      }
      if (ruta === '/api/login' && metodo === 'POST') return await login(request, bytes, ip);
      if (ruta === '/api/logout' && metodo === 'POST') return responder(200, { ok: true }, { 'Set-Cookie': cookieBorrar() });

      if (!configurado) return error(503, 'El panel aún no está configurado.');
      if (!haySesion(request)) return error(401, 'Tu sesión venció. Entra otra vez.', { sesion: false });

      if (ruta === '/api/menu' && metodo === 'GET') return responder(200, await leerEstado());
      if (ruta === '/api/menu' && metodo === 'PUT') return await guardarMenu(bytes);
      if (ruta === '/api/imagen' && metodo === 'POST') return await subirFoto(bytes);
      if (ruta === '/api/respaldos' && metodo === 'GET') return await listarRespaldos();
      if (ruta === '/api/respaldos/restaurar' && metodo === 'POST') return await restaurar(bytes);
      return error(404, 'No encontrado.');
    } catch (e) {
      if (e instanceof ErrorSolicitud) return error(e.estado, e.message);
      console.error(e);
      return error(500, 'Ocurrió un error en el servidor. Intenta de nuevo.');
    }
  }

  /** /menu.json, /menu-temporada.json y /fotos/* */
  async function publico(request) {
    const ruta = new URL(request.url).pathname;
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método no permitido', { status: 405, headers: ENCABEZADOS });
    if (ruta === '/menu.json' || ruta === '/menu-temporada.json') {
      const actual = await leerEstado();
      return responder(200, ruta === '/menu.json' ? actual.menu : actual.temporada);
    }
    if (ruta.startsWith('/fotos/')) {
      const nombre = ruta.slice('/fotos/'.length);
      if (NOMBRE_FOTO.test(nombre)) {
        const foto = await fotos.getWithMetadata(nombre, { type: 'arrayBuffer' });
        if (foto) {
          return new Response(request.method === 'HEAD' ? null : foto.data, {
            status: 200,
            headers: { 'Content-Type': foto.metadata?.tipo ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', ...ENCABEZADOS }
          });
        }
      }
    }
    return new Response('No encontrado', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...ENCABEZADOS } });
  }

  return { api, publico };
}
