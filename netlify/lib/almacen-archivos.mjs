// Almacén en carpetas para el servidor local (misma forma que Netlify Blobs). No se usa en Netlify.
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function crearAlmacenArchivos(carpeta) {
  let cola = Promise.resolve(); // las escrituras van de una en una: revisar y escribir es atómico
  const enCola = tarea => (cola = cola.then(tarea, tarea));
  const ruta = clave => path.join(carpeta, encodeURIComponent(clave));

  async function leer(clave) {
    try {
      const meta = JSON.parse(await readFile(ruta(clave) + '.meta.json', 'utf8'));
      return { bytes: await readFile(ruta(clave) + '.bin'), ...meta };
    } catch { return null; }
  }

  async function getWithMetadata(clave, { type } = {}) {
    const e = await leer(clave);
    if (!e) return null;
    const data = type === 'arrayBuffer' ? e.bytes.buffer.slice(e.bytes.byteOffset, e.bytes.byteOffset + e.bytes.length)
      : type === 'json' ? JSON.parse(e.bytes.toString('utf8')) : e.bytes.toString('utf8');
    return { data, etag: e.etag, metadata: e.metadata ?? {} };
  }

  function set(clave, valor, { onlyIfMatch, onlyIfNew, metadata } = {}) {
    return enCola(async () => {
      const actual = await leer(clave);
      if (onlyIfNew && actual) return { modified: false };
      if (onlyIfMatch && actual?.etag !== onlyIfMatch) return { modified: false };
      const bytes = typeof valor === 'string' ? Buffer.from(valor) : Buffer.from(valor instanceof ArrayBuffer ? new Uint8Array(valor) : valor);
      const etag = `"${createHash('sha256').update(bytes).update(String(Date.now())).digest('hex').slice(0, 16)}"`;
      await mkdir(carpeta, { recursive: true });
      await writeFile(ruta(clave) + '.bin', bytes);
      await writeFile(ruta(clave) + '.meta.json', JSON.stringify({ etag, metadata }));
      return { modified: true, etag };
    });
  }

  return {
    getWithMetadata,
    async get(clave, opciones) { return (await getWithMetadata(clave, opciones))?.data ?? null; },
    set,
    setJSON: (clave, objeto, opciones) => set(clave, JSON.stringify(objeto), opciones),
    delete: clave => enCola(async () => {
      await rm(ruta(clave) + '.bin', { force: true });
      await rm(ruta(clave) + '.meta.json', { force: true });
    }),
    async list({ prefix = '' } = {}) {
      let nombres = [];
      try { nombres = await readdir(carpeta); } catch { /* vacío */ }
      const claves = nombres.filter(n => n.endsWith('.meta.json')).map(n => decodeURIComponent(n.slice(0, -'.meta.json'.length)));
      return { blobs: claves.filter(k => k.startsWith(prefix)).sort().map(key => ({ key })) };
    }
  };
}
