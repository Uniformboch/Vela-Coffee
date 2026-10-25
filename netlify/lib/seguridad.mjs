// Contraseña (PBKDF2-SHA256) y sesión firmada (HMAC). La contraseña nunca se guarda en texto plano.
import { pbkdf2, randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

export const ITERACIONES = 600_000;
export const DURACION_SESION = 12 * 60 * 60 * 1000; // 12 horas
export const COOKIE = 'vela_sesion';

/** Formato: pbkdf2_sha256$<iteraciones>$<sal base64>$<hash base64> */
export async function crearHash(contrasena, { iteraciones = ITERACIONES, sal = randomBytes(16) } = {}) {
  const hash = await pbkdf2Async(String(contrasena).normalize('NFC'), sal, iteraciones, 32, 'sha256');
  return `pbkdf2_sha256$${iteraciones}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function verificarContrasena(contrasena, guardado) {
  const [algoritmo, iteraciones, sal, hash] = String(guardado ?? '').split('$');
  if (algoritmo !== 'pbkdf2_sha256' || !/^\d+$/.test(iteraciones ?? '') || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  if (!esperado.length) return false;
  const calculado = await pbkdf2Async(String(contrasena).normalize('NFC'), Buffer.from(sal, 'base64'), Number(iteraciones), esperado.length, 'sha256');
  return timingSafeEqual(calculado, esperado);
}

const firmar = (clave, texto) => createHmac('sha256', clave).update(texto).digest('base64url');

/** Valor de la cookie: <vence>.<firma> */
export function crearSesion(clave, ahora) {
  const vence = ahora + DURACION_SESION;
  return `${vence}.${firmar(clave, `sesion.${vence}`)}`;
}

export function sesionValida(clave, valor, ahora) {
  const [vence, firma] = String(valor ?? '').split('.');
  if (!/^\d+$/.test(vence ?? '') || !firma || Number(vence) <= ahora) return false;
  const esperada = Buffer.from(firmar(clave, `sesion.${vence}`));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

export function leerCookie(request, nombre) {
  for (const parte of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=');
  }
  return null;
}

export function cookieSesion(valor) {
  return `${COOKIE}=${valor}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION_SESION / 1000}`;
}
export function cookieBorrar() {
  return `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export const sha256 = datos => createHash('sha256').update(datos).digest('hex');
export const claveAleatoria = () => randomBytes(32).toString('base64url');
