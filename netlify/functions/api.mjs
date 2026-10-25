// API del panel del dueño.
import { servidorNetlify } from '../lib/netlify.mjs';

export default (request, context) => servidorNetlify().api(request, { ip: context.ip });

export const config = { path: '/api/*' };
