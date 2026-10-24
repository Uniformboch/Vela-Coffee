// Servidor para probar el menú en esta computadora. Solo escucha en 127.0.0.1 (no se abre a la red).
// Sirve sitio/ y, como en Netlify, /menu.json, /menu-temporada.json y /fotos/* desde la carpeta de datos.
// Uso: node scripts/servidor-local.mjs            (puerto 8080, datos/ del repositorio)
//      VELA_DATOS=ruta/a/copia node scripts/...    (para probar con una copia sin tocar datos/)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const SITIO = path.join(raiz, 'sitio');
const DATOS = process.env.VELA_DATOS ? path.resolve(process.env.VELA_DATOS) : path.join(raiz, 'datos');
const PUERTO = Number(process.env.PORT) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml'
};
const ARCHIVOS_DATOS = { '/menu.json': 'menu.json', '/menu-temporada.json': 'menu-temporada.json' };

// Devuelve la ruta dentro de "base" o null si intenta salirse de ella.
function dentroDe(base, relativa) {
  const ruta = path.normalize(path.join(base, relativa));
  return ruta.startsWith(base + path.sep) ? ruta : null;
}

function enviar(res, estado, cuerpo, tipo, cache = 'no-cache') {
  res.writeHead(estado, { 'Content-Type': tipo, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
  res.end(cuerpo);
}

const servidor = http.createServer(async (req, res) => {
  req.resume(); // se lee (y descarta) el cuerpo siempre, para que Windows no corte la conexión
  if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(res, 405, 'Método no permitido', 'text/plain; charset=utf-8');

  let ruta;
  try { ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { return enviar(res, 400, 'Solicitud no válida', 'text/plain; charset=utf-8'); }

  let archivo, cache = 'no-cache';
  if (ARCHIVOS_DATOS[ruta]) { archivo = path.join(DATOS, ARCHIVOS_DATOS[ruta]); cache = 'no-store'; }
  else if (ruta.startsWith('/fotos/')) { archivo = dentroDe(path.join(DATOS, 'fotos'), ruta.slice('/fotos/'.length)); }
  else { archivo = dentroDe(SITIO, ruta === '/' ? 'index.html' : ruta); }

  if (!archivo) return enviar(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
  try {
    const cuerpo = await readFile(archivo);
    enviar(res, 200, req.method === 'HEAD' ? undefined : cuerpo, TIPOS[path.extname(archivo)] ?? 'application/octet-stream', cache);
  } catch {
    enviar(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Menú local en http://127.0.0.1:${PUERTO}  (datos: ${DATOS})`);
});
