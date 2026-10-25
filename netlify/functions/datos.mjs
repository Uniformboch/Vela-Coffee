// Menú y fotos que lee el menú público.
import { servidorNetlify } from '../lib/netlify.mjs';

export default request => servidorNetlify().publico(request);

export const config = { path: ['/menu.json', '/menu-temporada.json', '/fotos/*'] };
