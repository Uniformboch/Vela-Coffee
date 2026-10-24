// Lectura y escritura mínima de PNG (8 bits, RGBA, sin entrelazado), sin dependencias.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

export function leerPng(ruta) {
  const b = readFileSync(ruta);
  let p = 8, w, h, tipoColor;
  const datos = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), tipo = b.toString('ascii', p + 4, p + 8);
    const c = b.subarray(p + 8, p + 8 + len);
    if (tipo === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); tipoColor = c[9]; if (c[8] !== 8 || c[12] !== 0) throw new Error('PNG no compatible'); }
    if (tipo === 'IDAT') datos.push(c);
    p += 12 + len;
  }
  if (tipoColor !== 6) throw new Error('Se esperaba un PNG RGBA');
  const raw = inflateSync(Buffer.concat(datos));
  const bpp = 4, fila = w * bpp, px = Buffer.alloc(h * fila);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (fila + 1)], src = y * (fila + 1) + 1, dst = y * fila;
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, u = y ? px[dst + x - fila] : 0, ul = y && x >= bpp ? px[dst + x - fila - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const pp = a + u - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - ul); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : ul; }
      px[dst + x] = v & 255;
    }
  }
  return { w, h, px };
}

const tablaCrc = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = tablaCrc[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const bloque = (tipo, datos) => {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo), datos]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([largo, td, c]);
};

export function escribirPng(ruta, { w, h, px }) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  writeFileSync(ruta, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque('IHDR', ihdr), bloque('IDAT', deflateSync(raw, { level: 9 })), bloque('IEND', Buffer.alloc(0))]));
}
