# Vela Coffee · Menú digital

Menú en línea de Vela Coffee (León, Gto.): el cliente arma su pedido y lo envía por WhatsApp.
El dueño administra precios, agotados, temporada y extras desde `/admin`.

- **Sitio:** HTML, CSS y JavaScript sin frameworks (`sitio/`).
- **Servidor:** Netlify Functions (`netlify/`) con Netlify Blobs para guardar el menú, fotos y respaldos.
- **Menú inicial:** `datos/menu.json` y `datos/menu-temporada.json` (solo se usan mientras no se haya guardado nada desde el panel).

## Probar en la computadora

```bash
node scripts/secretos-locales.mjs     # contraseña de prueba en .local/ (no se sube)
node scripts/servidor-local.mjs       # http://127.0.0.1:8080 y /admin
node --test "tests/*.test.mjs"        # pruebas automáticas
```

## Publicar

Netlify arma el sitio con `node scripts/build.mjs` (ver `netlify.toml`). El panel necesita dos variables
secretas en Netlify, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET`, que se generan con
`node scripts/generar-secretos.mjs` (pide la contraseña sin mostrarla y no la guarda).
