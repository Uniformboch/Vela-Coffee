// Genera los íconos de la app a partir del logo: logo azul centrado sobre el color del papel.
// Uso: node scripts/iconos.mjs
import { leerPng, escribirPng } from './png.mjs';

const carpeta = new URL('../sitio/assets/', import.meta.url);
const logo = leerPng(new URL('logo-vela.png', carpeta));
const PAPEL = [0xeb, 0xeb, 0xeb];

// El logo ocupa el 70 % del alto: así queda dentro de la zona segura de los íconos "maskable".
function icono(lado, proporcion = 0.7) {
  const alto = Math.round(lado * proporcion), ancho = Math.round(alto * logo.w / logo.h);
  const x0 = Math.floor((lado - ancho) / 2), y0 = Math.floor((lado - alto) / 2);
  const px = Buffer.alloc(lado * lado * 4);
  for (let i = 0; i < lado * lado; i++) px.set([...PAPEL, 255], i * 4);
  const escala = logo.h / alto;
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    // Promedio de todos los píxeles del logo que caen en este píxel del ícono
    const sx0 = Math.floor(x * escala), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * escala));
    const sy0 = Math.floor(y * escala), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * escala));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = sy0; sy < sy1 && sy < logo.h; sy++) for (let sx = sx0; sx < sx1 && sx < logo.w; sx++) {
      const i = (sy * logo.w + sx) * 4, al = logo.px[i + 3] / 255;
      r += logo.px[i] * al; g += logo.px[i + 1] * al; b += logo.px[i + 2] * al; a += al; n++;
    }
    if (!a) continue;
    const opacidad = a / n, color = [r / a, g / a, b / a];
    const d = ((y0 + y) * lado + x0 + x) * 4;
    for (let k = 0; k < 3; k++) px[d + k] = Math.round(PAPEL[k] * (1 - opacidad) + color[k] * opacidad);
  }
  return { w: lado, h: lado, px };
}

for (const lado of [180, 192, 512]) {
  escribirPng(new URL(`icono-${lado}.png`, carpeta), icono(lado));
  console.log(`icono-${lado}.png`);
}
