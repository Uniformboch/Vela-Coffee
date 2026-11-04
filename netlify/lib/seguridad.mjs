// Contraseña (PBKDF2-SHA256) y sesión firmada (HMAC). La contraseña nunca se guarda en texto plano.
import { pbkdf2, randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

export const ITERACIONES = 600_000;
export const DURACION_SESION = 12 * 60 * 60 * 1000; // 12 horas
export const COOKIE = 'vela_sesion';

// Formato actual: pbkdf2-sha256.<iteraciones>.<sal base64url>.<hash base64url> (sin "$", que algunos sistemas
// sustituyen al pegar). También se acepta el formato anterior: pbkdf2_sha256$<iteraciones>$<sal>$<hash>.
const FORMATO_HASH = /pbkdf2[-_]sha256([.$])(\d+)\1([A-Za-z0-9+/_-]+={0,2})\1([A-Za-z0-9+/_-]+={0,2})/;

function partesHash(valor) {
  const m = new RegExp(`^${FORMATO_HASH.source}$`).exec(valor);
  return m ? { iteraciones: Number(m[2]), sal: Buffer.from(m[3], 'base64'), hash: Buffer.from(m[4], 'base64') } : null;
}

/**
 * Limpia un valor pegado en Netlify: quita espacios, saltos de línea y comillas, y si hay texto alrededor
 * (por ejemplo "VALOR:" o el nombre de la variable) se queda solo con el hash.
 */
export function normalizarSecreto(valor) {
  const limpio = String(valor ?? '').replace(/\s+/g, '').replace(/^VALOR:/i, '').replace(/^["'`]+|["'`]+$/g, '');
  return FORMATO_HASH.exec(limpio)?.[0] ?? limpio;
}

/** ¿Tiene la forma de un hash creado por crearHash? */
export function hashValido(hash) {
  const p = partesHash(hash);
  return Boolean(p) && p.iteraciones >= 1000 && p.sal.length >= 8 && p.hash.length === 32;
}

/** Descripción del valor recibido que ayuda a ver qué se cortó, sin revelar el secreto. */
export function describirValor(valor) {
  const v = String(valor ?? '');
  const signos = (v.match(/[$]/g) ?? []).length;
  const puntos = (v.match(/[.]/g) ?? []).length;
  return `llegó con ${v.length} caracteres, ${signos} signos "$" y ${puntos} puntos; se esperaban 87 caracteres y 3 puntos`;
}

/** Formato: pbkdf2-sha256.<iteraciones>.<sal base64url>.<hash base64url> */
export async function crearHash(contrasena, { iteraciones = ITERACIONES, sal = randomBytes(16) } = {}) {
  const hash = await pbkdf2Async(String(contrasena).normalize('NFC'), sal, iteraciones, 32, 'sha256');
  return `pbkdf2-sha256.${iteraciones}.${sal.toString('base64url')}.${hash.toString('base64url')}`;
}

export async function verificarContrasena(contrasena, guardado) {
  const partes = partesHash(String(guardado ?? ''));
  if (!partes || !partes.sal.length) return false;
  const { iteraciones, sal } = partes;
  const esperado = partes.hash;
  if (!esperado.length) return false;
  const calculado = await pbkdf2Async(String(contrasena).normalize('NFC'), sal, iteraciones, esperado.length, 'sha256');
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
