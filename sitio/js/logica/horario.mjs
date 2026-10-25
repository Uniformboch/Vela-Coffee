// Horario del café, para avisar cuando está cerrado (no impide enviar el pedido).
export const HORARIO = {
  dias: [1, 2, 3, 4, 5, 6], // lunes a sábado (0 = domingo)
  abre: 8 * 60,             // 8:00
  cierra: 21 * 60,          // 21:00
  zona: 'America/Mexico_City',
  texto: 'lunes a sábado de 8:00 a 21:00'
};

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ¿Está abierto en este momento (hora de León)? */
export function estaAbierto(fecha = new Date(), horario = HORARIO) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: horario.zona, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
  }).formatToParts(fecha).map(p => [p.type, p.value]));
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  return horario.dias.includes(DIAS.indexOf(partes.weekday)) && minutos >= horario.abre && minutos < horario.cierra;
}
