// Genera las dos variables secretas del panel para Netlify.
// Pide la contraseña sin mostrarla en pantalla y NO la guarda en ningún archivo.
// Uso: node scripts/generar-secretos.mjs
import { createInterface } from 'node:readline';
import { crearHash, claveAleatoria } from '../netlify/lib/seguridad.mjs';

const MINIMO = 10;

// Lee una línea sin que se vean las letras (muestra * por cada una).
function preguntarOculto(pregunta) {
  return new Promise(resolver => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = texto => {
      if (texto.includes(pregunta)) process.stdout.write(pregunta);
      else if (texto === '\r\n' || texto === '\n') process.stdout.write('\n');
      else process.stdout.write('*'.repeat(texto.length));
    };
    rl.question(pregunta, respuesta => { rl.close(); process.stdout.write('\n'); resolver(respuesta); });
  });
}

const primera = await preguntarOculto('Escribe la contraseña del panel: ');
if (primera.length < MINIMO) {
  console.error(`La contraseña debe tener al menos ${MINIMO} caracteres. No se generó nada.`);
  process.exit(1);
}
const segunda = await preguntarOculto('Escríbela otra vez: ');
if (primera !== segunda) {
  console.error('Las contraseñas no coinciden. No se generó nada.');
  process.exit(1);
}

console.log('\nCalculando (tarda unos segundos)…');
const hash = await crearHash(primera);

console.log('\nCopia cada VALOR en Netlify, en la variable con ese NOMBRE (Key):\n');
console.log('NOMBRE (Key):  ADMIN_PASSWORD_HASH');
console.log(`VALOR:         ${hash}\n`);
console.log('NOMBRE (Key):  SESSION_SECRET');
console.log(`VALOR:         ${claveAleatoria()}\n`);
console.log('No compartas estos valores. Cierra esta ventana cuando termines.');
