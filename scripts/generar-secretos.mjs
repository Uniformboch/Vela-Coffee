// Genera las dos variables secretas del panel para Netlify.
// Pide la contraseña sin mostrarla en pantalla y NO la guarda en ningún archivo.
// Uso: node scripts/generar-secretos.mjs
import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import { crearHash, claveAleatoria, hashValido, verificarContrasena } from '../netlify/lib/seguridad.mjs';

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
// Comprobación: el valor generado sí abre con la contraseña escrita.
if (!hashValido(hash) || !(await verificarContrasena(primera, hash))) {
  console.error('Algo salió mal al generar el valor. Vuelve a correr el script.');
  process.exit(1);
}

// Copia al portapapeles: así no se cuelan saltos de línea ni espacios al seleccionar en la terminal.
function copiar(texto) {
  const comandos = { win32: ['clip', []], darwin: ['pbcopy', []], linux: ['xclip', ['-selection', 'clipboard']] };
  const [cmd, args] = comandos[process.platform] ?? [];
  if (!cmd) return false;
  return spawnSync(cmd, args, { input: texto }).status === 0;
}

function preguntar(texto) {
  return new Promise(resolver => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(texto, r => { rl.close(); resolver(r); });
  });
}

const variables = [['ADMIN_PASSWORD_HASH', hash], ['SESSION_SECRET', claveAleatoria()]];
console.log('\nVas a crear (o reemplazar) dos variables en Netlify. Para cada una:');
console.log('el NOMBRE (Key) se escribe tal cual, y el VALOR se pega desde el portapapeles.\n');
for (const [nombre, valor] of variables) {
  console.log(`NOMBRE (Key):  ${nombre}`);
  await preguntar('Presiona Enter para copiar su VALOR al portapapeles… ');
  if (copiar(valor)) {
    console.log(`Copiado (${valor.length} caracteres). Pégalo en el campo "Value" de ${nombre} en Netlify.`);
  } else {
    console.log('No se pudo usar el portapapeles. Copia este VALOR completo, en una sola línea:');
    console.log(valor);
  }
  await preguntar('Presiona Enter cuando ya lo hayas pegado y guardado en Netlify… ');
  console.log('');
}
copiar(' '); // se vacía el portapapeles para no dejar el valor ahí
console.log('Listo. No compartas estos valores. Ya puedes cerrar esta ventana.');
