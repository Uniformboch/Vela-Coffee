# Pruebas del menú de Vela Coffee

Última revisión: etapa 7 (24 oct 2026), en la computadora del desarrollador, con el servidor local
(`node scripts/servidor-local.mjs`) y el navegador simulando celular, tableta y computadora.

## Pruebas automáticas

`node --test "tests/*.test.mjs"` → **65 pruebas, todas pasan**.

| Archivo | Qué revisa |
|---|---|
| `datos.test.mjs` | Cada precio igual a la tabla aprobada; extras y opciones de cada producto |
| `validar-menu.test.mjs` | El validador rechaza precios, ids, opciones y fotos inválidos |
| `vista.test.mjs` | Grupos, columnas C/F, enlaces `#cat-…`, formatos |
| `carrito.test.mjs` | Sumas, combinaciones, tope de 20, opciones obligatorias, limpieza del carrito guardado |
| `pedido.test.mjs` | Mensaje de WhatsApp exacto, enlace codificado, formulario, horario |
| `servidor.test.mjs` | Sesión, cookie segura, otros sitios, bloqueo por IP, guardado con respaldo, conflictos, dos guardados a la vez, fotos, restauración, 60 respaldos |
| `ids.test.mjs` | Identificadores que no cambian ni se repiten |

## Revisión en el navegador

Revisión automática en cada pantalla: sin scroll horizontal, nada se sale por la derecha, zonas táctiles de
al menos 44 px, imágenes con texto alternativo, botones y campos con nombre, ids sin repetir.

| Pantalla | 320 px | 375 px | 768 px | 1280 px |
|---|---|---|---|---|
| Menú público | ✔ | ✔ | ✔ | ✔ |
| Hoja de producto | ✔ | ✔ | ✔ (centrada) | ✔ (centrada) |
| Carrito (hoja / panel derecho) | ✔ | ✔ | ✔ | ✔ (panel) |
| Panel: entrar | ✔ | ✔ | — | ✔ |
| Panel: 5 pestañas | ✔ | ✔ | — | ✔ |
| Panel: editores de producto, categoría, extra y temporada | ✔ | ✔ | — | ✔ |

### Recorridos

- [x] Pedido de bebida con tamaño y extras; comida con opciones obligatorias (avisos "Elige … para continuar.").
- [x] Tope de 20: el botón + se desactiva; al volver a agregar queda en 20 y avisa.
- [x] Para llevar: el mensaje no lleva dirección ni envío. A domicilio: sí, con "Envío: por confirmar".
- [x] Aviso de cerrado (domingo simulado): aparece y deja enviar.
- [x] "¿Ya enviaste tu pedido?": los tres botones funcionan; "empezar otro" conserva nombre y dirección.
- [x] Carrito guardado con productos que ya no existen: se limpian solos y avisa.
- [x] Teclado: Tab llega a "Saltar al menú", chips y productos; Enter abre la hoja; Esc la cierra y el foco regresa.
- [x] Sin conexión: con el servidor apagado, el menú abre completo desde la copia guardada.
- [x] Panel: agotado → guardar → se ve en gris en el menú.
- [x] Panel: cambio de precio → el menú y el botón "Agregar" muestran el precio nuevo.
- [x] Panel: crear categoría, producto, extra y producto de temporada con foto (se reduce a 1000 px).
- [x] Panel: sesión vencida a media edición → pide entrar y guarda sin perder cambios.
- [x] Panel: otro dispositivo guardó primero → aviso y botón para recargar.
- [x] Panel: restaurar respaldo; Descartar cambios.
- [x] Archivos privados (`/datos`, `/tests`, `/.local`, `/netlify`, `/scripts`, `package.json`) responden 404.
- [x] `/admin` se envía con `no-store` y `noindex`.

## Lo que se corrigió en esta revisión

1. Al pasar de tableta a computadora (o al girar el celular) el carrito podía quedarse en la hoja en vez del
   panel derecho. Ahora también se revisa al cambiar el tamaño de la ventana; esto además cubre iPhones con iOS antiguo.
2. En el editor de opciones, los campos de cada valor no tenían nombre para lectores de pantalla.

## Lo que todavía no se ha probado (se hará al publicar)

- Celular real (iPhone y Android), con datos móviles, incluido el **mensaje en WhatsApp de verdad**.
- Netlify: funciones, Netlify Blobs, encabezados y que los archivos privados den 404 en el sitio publicado.
- El botón "Powered by Netlify" junto a la barra del carrito y la de Guardar.
- Las letras finales (por ahora son las del sistema).
- Que la contraseña real funcione desde el celular del dueño.
