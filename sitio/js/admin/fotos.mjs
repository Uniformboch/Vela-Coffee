// Reduce una foto antes de subirla: lado mayor de 1000 px, JPEG. Así carga rápido con datos móviles.
export async function reducirFoto(archivo, { lado = 1000, calidad = 0.82 } = {}) {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#ffffff'; // las PNG transparentes quedan sobre blanco
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close?.();
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(b => b ? resolver(b) : rechazar(new Error('No se pudo procesar la foto')), 'image/jpeg', calidad));
}
