// Arma el servidor con Netlify Blobs y las variables de entorno. Lo usan las dos funciones.
import { getStore } from '@netlify/blobs';
import { crearServidor } from './servidor.mjs';
import menu from '../../datos/menu.json' with { type: 'json' };
import temporada from '../../datos/menu-temporada.json' with { type: 'json' };

let servidor = null;

export function servidorNetlify() {
  const almacen = name => getStore({ name, consistency: 'strong' });
  servidor ??= crearServidor({
    almacenes: {
      estado: almacen('menu-estado'),
      fotos: almacen('menu-fotos'),
      respaldos: almacen('menu-respaldos'),
      intentos: almacen('menu-intentos')
    },
    secretos: { hash: process.env.ADMIN_PASSWORD_HASH, clave: process.env.SESSION_SECRET },
    inicial: { menu, temporada }
  });
  return servidor;
}
