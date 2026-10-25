// Crea una contraseña DE PRUEBA para el panel en esta computadora (servidor local).
// No sirve para el sitio publicado: la contraseña real la crea el dueño con scripts/generar-secretos.mjs.
// Guarda en .local/ (no se sube al repositorio):
//   .local/secretos.json              → hash y clave que usa el servidor local
//   .local/contrasena-de-prueba.txt   → la contraseña de prueba, para escribirla en /admin
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { crearHash, claveAleatoria } from '../netlify/lib/seguridad.mjs';

const carpeta = new URL('../.local/', import.meta.url);
const contrasena = `prueba-${randomBytes(9).toString('base64url')}`;

await mkdir(carpeta, { recursive: true });
await writeFile(new URL('secretos.json', carpeta), JSON.stringify({
  ADMIN_PASSWORD_HASH: await crearHash(contrasena),
  SESSION_SECRET: claveAleatoria()
}, null, 2));
await writeFile(new URL('contrasena-de-prueba.txt', carpeta), contrasena + '\n');
console.log('Listo. La contraseña de prueba quedó en .local/contrasena-de-prueba.txt (reinicia el servidor local).');
