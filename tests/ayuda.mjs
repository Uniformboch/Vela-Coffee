// Utilidades compartidas por las pruebas.
import { readFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
export const leerJson = ruta => JSON.parse(readFileSync(new URL(ruta, raiz), 'utf8'));

export const cargarMenu = () => leerJson('datos/menu.json');
export const cargarTemporada = () => leerJson('datos/menu-temporada.json');
export const cargarPreciosAprobados = () => leerJson('tests/fixtures/precios-aprobados.json');
