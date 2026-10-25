// Arma la carpeta pública (dist/) solo con lo que debe verse en internet: lo que hay en sitio/.
// Los JSON del menú, pruebas, scripts, documentos y datos locales nunca se copian.
// Uso: node scripts/build.mjs [carpeta-de-salida]
import { rm, mkdir, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const sitio = path.join(raiz, 'sitio');
const salida = path.resolve(raiz, process.argv[2] ?? 'dist');

const IGNORAR = /(^|[\\/])(\.DS_Store|Thumbs\.db|desktop\.ini)$/i;

async function archivos(carpeta) {
  const lista = [];
  for (const e of await readdir(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) lista.push(...await archivos(ruta));
    else if (!IGNORAR.test(ruta)) lista.push(ruta);
  }
  return lista;
}

await rm(salida, { recursive: true, force: true });
await mkdir(salida, { recursive: true });
await cp(sitio, salida, { recursive: true, filter: origen => !IGNORAR.test(origen) });

// El service worker cambia de nombre de caché en cada versión, para que los celulares tomen lo nuevo.
const hash = createHash('sha256');
const publicados = (await archivos(salida)).sort();
for (const archivo of publicados) hash.update(path.relative(salida, archivo)).update(await readFile(archivo));
const version = hash.digest('hex').slice(0, 10);
const sw = path.join(salida, 'sw.js');
await writeFile(sw, (await readFile(sw, 'utf8')).replace("'vela-menu-v1'", `'vela-menu-${version}'`));

console.log(`Sitio armado en ${path.relative(raiz, salida) || '.'} (${publicados.length} archivos, versión ${version}):`);
for (const archivo of publicados) console.log('  ' + path.relative(salida, archivo).replaceAll('\\', '/'));
