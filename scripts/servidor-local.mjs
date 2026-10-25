// Servidor para probar en esta computadora. Solo escucha en 127.0.0.1 (no se abre a la red).
// Hace lo mismo que Netlify: sirve sitio/, atiende /api/* y /menu.json, /menu-temporada.json y /fotos/*
// con la misma lógica de las funciones, pero guarda en la carpeta .local/ en vez de Netlify Blobs.
//
// Uso: node scripts/servidor-local.mjs
//      PORT=8081 VELA_LOCAL=otra/carpeta node scripts/servidor-local.mjs   (para probar con datos aparte)
// La contraseña de prueba se crea con: node scripts/secretos-locales.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from '../netlify/lib/servidor.mjs';
import { crearAlmacenArchivos } from '../netlify/lib/almacen-archivos.mjs';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const SITIO = path.join(raiz, 'sitio');
const LOCAL = path.resolve(raiz, process.env.VELA_LOCAL ?? '.local');
const PUERTO = Number(process.env.PORT) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml'
};
const PAGINAS = { '/': 'index.html', '/admin': 'admin.html', '/admin/': 'admin.html' };

const leerJson = async ruta => JSON.parse(await readFile(ruta, 'utf8'));
const secretos = await leerJson(path.join(LOCAL, 'secretos.json')).catch(() => ({}));
const servidor = crearServidor({
  almacenes: Object.fromEntries(['estado', 'fotos', 'respaldos', 'intentos'].map(n => [n, crearAlmacenArchivos(path.join(LOCAL, 'blobs', n))])),
  secretos: { hash: secretos.ADMIN_PASSWORD_HASH, clave: secretos.SESSION_SECRET },
  inicial: { menu: await leerJson(path.join(raiz, 'datos', 'menu.json')), temporada: await leerJson(path.join(raiz, 'datos', 'menu-temporada.json')) }
});

function dentroDe(base, relativa) {
  const ruta = path.normalize(path.join(base, relativa));
  return ruta.startsWith(base + path.sep) ? ruta : null;
}

async function cuerpoDe(req) {
  const partes = [];
  for await (const parte of req) partes.push(parte);
  return Buffer.concat(partes);
}

async function enviarRespuesta(res, respuesta) {
  res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers));
  res.end(Buffer.from(await respuesta.arrayBuffer()));
}

const local = http.createServer(async (req, res) => {
  const cuerpo = await cuerpoDe(req); // siempre se lee, para que Windows no corte la conexión
  let ruta;
  try { ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400); return res.end('Solicitud no válida'); }

  // Las funciones de Netlify
  const esApi = ruta.startsWith('/api/');
  if (esApi || ruta === '/menu.json' || ruta === '/menu-temporada.json' || ruta.startsWith('/fotos/')) {
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : cuerpo
    });
    const respuesta = esApi ? await servidor.api(request, { ip: req.socket.remoteAddress }) : await servidor.publico(request);
    return enviarRespuesta(res, respuesta);
  }

  // Archivos del sitio
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Método no permitido'); }
  const archivo = dentroDe(SITIO, PAGINAS[ruta] ?? ruta);
  try {
    if (!archivo) throw new Error();
    const datos = await readFile(archivo);
    const cabeceras = { 'Content-Type': TIPOS[path.extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (path.basename(archivo) === 'admin.html') Object.assign(cabeceras, { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    res.writeHead(200, cabeceras);
    res.end(req.method === 'HEAD' ? undefined : datos);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
});

local.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Menú local en http://127.0.0.1:${PUERTO}  · panel en /admin  (datos locales: ${LOCAL})`);
  if (!secretos.ADMIN_PASSWORD_HASH) console.log('Aún no hay contraseña de prueba: node scripts/secretos-locales.mjs');
});
