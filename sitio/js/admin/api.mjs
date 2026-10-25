// Comunicación del panel con el servidor (/api/*).

export class ErrorSesion extends Error {}
export class ErrorApi extends Error {
  constructor(estado, errores, datos = {}) {
    super(errores.join(' '));
    this.estado = estado;
    this.errores = errores;
    this.datos = datos;
  }
}

async function pedir(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, credentials: 'same-origin', headers: { 'X-Menu': '1' }, cache: 'no-store' };
  if (cuerpo instanceof Blob) {
    opciones.body = cuerpo;
    opciones.headers['Content-Type'] = cuerpo.type || 'application/octet-stream';
  } else if (cuerpo !== undefined) {
    opciones.body = JSON.stringify(cuerpo);
    opciones.headers['Content-Type'] = 'application/json';
  }
  let respuesta;
  try { respuesta = await fetch(ruta, opciones); }
  catch { throw new ErrorApi(0, ['No hay conexión. Revisa tu internet e intenta de nuevo.']); }
  const datos = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401 && datos.sesion === false) throw new ErrorSesion();
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.errores ?? ['Algo salió mal. Intenta de nuevo.'], datos);
  return datos;
}

export const api = {
  sesion: () => pedir('GET', '/api/sesion'),
  entrar: contrasena => pedir('POST', '/api/login', { contrasena }),
  salir: () => pedir('POST', '/api/logout', {}),
  leerMenu: () => pedir('GET', '/api/menu'),
  guardarMenu: datos => pedir('PUT', '/api/menu', datos),
  subirFoto: blob => pedir('POST', '/api/imagen', blob),
  respaldos: () => pedir('GET', '/api/respaldos'),
  restaurar: (id, version) => pedir('POST', '/api/respaldos/restaurar', { id, version })
};
