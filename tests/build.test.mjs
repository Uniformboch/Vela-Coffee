// La carpeta publicada solo lleva lo público.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

function listar(carpeta, base = carpeta) {
  return readdirSync(carpeta).flatMap(n => {
    const ruta = path.join(carpeta, n);
    return statSync(ruta).isDirectory() ? listar(ruta, base) : [path.relative(base, ruta).replaceAll('\\', '/')];
  });
}

test('el build publica solo páginas, estilos, código, letras e imágenes', () => {
  const salida = mkdtempSync(path.join(tmpdir(), 'vela-build-'));
  try {
    execFileSync(process.execPath, [path.join(raiz, 'scripts', 'build.mjs'), salida], { cwd: raiz });
    const lista = listar(salida);
    for (const necesario of ['index.html', 'admin.html', 'manifest.webmanifest', 'sw.js', 'css/menu.css', 'css/admin.css',
      'js/menu.mjs', 'js/admin.mjs', 'js/logica/validar-menu.mjs', 'assets/logo-vela.png', 'assets/icono-512.png',
      'fonts/ultra.woff2', 'fonts/montserrat.woff2']) {
      assert.ok(lista.includes(necesario), `falta ${necesario}`);
    }
    // Nada privado ni del repositorio
    for (const ruta of lista) {
      assert.ok(!/^(datos|tests|scripts|netlify|docs|capturas|muestra-identidad|\.local|\.git|node_modules)\//.test(ruta), ruta);
      assert.ok(!/(^|\/)(menu|menu-temporada|secretos|package)\.json$/.test(ruta), ruta);
      assert.ok(!/\.(md|test\.mjs)$/.test(ruta), ruta);
    }
    // El service worker lleva una versión nueva
    assert.match(readFileSync(path.join(salida, 'sw.js'), 'utf8'), /'vela-menu-[a-f0-9]{10}'/);
  } finally {
    rmSync(salida, { recursive: true, force: true });
  }
});
