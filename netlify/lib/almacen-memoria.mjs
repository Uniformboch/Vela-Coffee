// Almacén en memoria que imita Netlify Blobs (etags y escrituras condicionales). Para pruebas.
let contador = 0;

function convertir(valor, tipo) {
  if (tipo === 'arrayBuffer') {
    const bytes = typeof valor === 'string' ? new TextEncoder().encode(valor) : valor;
    return bytes.slice().buffer;
  }
  const texto = typeof valor === 'string' ? valor : new TextDecoder().decode(valor);
  return tipo === 'json' ? JSON.parse(texto) : texto;
}

function aGuardar(valor) {
  if (typeof valor === 'string') return valor;
  if (valor instanceof ArrayBuffer) return new Uint8Array(valor.slice(0));
  if (ArrayBuffer.isView(valor)) return new Uint8Array(valor.buffer.slice(valor.byteOffset, valor.byteOffset + valor.byteLength));
  throw new TypeError('Valor no compatible');
}

export function crearAlmacenMemoria() {
  const datos = new Map(); // clave → { valor, etag, metadata }

  async function getWithMetadata(clave, { type } = {}) {
    await null; // como en el real, la lectura es asíncrona (permite intercalar solicitudes)
    const e = datos.get(clave);
    return e ? { data: convertir(e.valor, type), etag: e.etag, metadata: structuredClone(e.metadata ?? {}) } : null;
  }

  async function set(clave, valor, { onlyIfMatch, onlyIfNew, metadata } = {}) {
    await null;
    // Revisar y escribir ocurre sin pausas: es atómico, como la escritura condicional del real.
    const e = datos.get(clave);
    if (onlyIfNew && e) return { modified: false };
    if (onlyIfMatch && e?.etag !== onlyIfMatch) return { modified: false };
    const etag = `"m${++contador}"`;
    datos.set(clave, { valor: aGuardar(valor), etag, metadata });
    return { modified: true, etag };
  }

  return {
    getWithMetadata,
    async get(clave, opciones) { return (await getWithMetadata(clave, opciones))?.data ?? null; },
    set,
    setJSON: (clave, objeto, opciones) => set(clave, JSON.stringify(objeto), opciones),
    async delete(clave) { await null; datos.delete(clave); },
    async list({ prefix = '' } = {}) {
      await null;
      return { blobs: [...datos.keys()].filter(k => k.startsWith(prefix)).sort().map(key => ({ key, etag: datos.get(key).etag })) };
    },
    tamano: () => datos.size
  };
}
