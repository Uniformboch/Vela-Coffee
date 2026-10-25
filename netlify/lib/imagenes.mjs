// Fotos: se reconocen por su contenido (los primeros bytes), no por el tipo que dice el navegador.
export const MAX_FOTO = 4 * 1024 * 1024;

const empieza = (b, firma, desde = 0) => firma.every((x, i) => b[desde + i] === x);
const ascii = t => [...t].map(c => c.charCodeAt(0));

export function tipoDeImagen(bytes) {
  if (bytes.length >= 3 && empieza(bytes, [0xff, 0xd8, 0xff])) return { ext: 'jpg', tipo: 'image/jpeg' };
  if (bytes.length >= 8 && empieza(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', tipo: 'image/png' };
  if (bytes.length >= 12 && empieza(bytes, ascii('RIFF')) && empieza(bytes, ascii('WEBP'), 8)) return { ext: 'webp', tipo: 'image/webp' };
  return null;
}

export const TIPOS_FOTO = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const NOMBRE_FOTO = /^[a-f0-9]{24}\.(jpg|png|webp)$/;
