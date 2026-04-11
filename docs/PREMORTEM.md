# Premortem — Capataz Fase 1

Un premortem es un ejercicio donde imaginamos que algo salió muy mal y analizamos qué pudo haberlo causado, cómo nos damos cuenta a tiempo, y qué hacemos para evitarlo o recuperarnos. Los tres escenarios más críticos para Capataz son:

---

## Escenario 1: El motor deja de generar recomendaciones

**Señal de alerta:**
- El dashboard muestra "Reportes de hoy" en rojo (cero generados, varios esperados).
- Los agricultores no reciben ningún mensaje ese día.

**Cómo lo detectamos:**
- La tarjeta de reportes en el dashboard cambia de verde a rojo.
- Se acumulan errores en la tarjeta "Errores últimas 24 h".
- Los logs del servidor muestran fallos en el proceso diario.

**Mitigación:**
- Ejecutar el job manualmente (`npm run job:daily -- --fecha=FECHA`) para recuperar el día fallido.
- Revisar los logs buscando el error específico (`docker compose logs app`).
- Si el problema es de conectividad con Sentinel Hub, activar el modo simulado (`MOCK_SENTINEL=true`) para generar recomendaciones con datos internos mientras se resuelve.
- Avisar a los agricultores afectados con un mensaje manual vía WhatsApp usando el magic link.

---

## Escenario 2: Oracle reclama la instancia y la aplicación deja de responder

**Señal de alerta:**
- La aplicación no carga en el navegador.
- El keepalive no registra pings recientes en el dashboard.
- Oracle Cloud muestra la instancia en estado "Terminated" o "Stopped".

**Cómo lo detectamos:**
- El script de keepalive falla y escribe un error en `/var/log/capataz-keepalive.log`.
- Los agricultores reportan que no pueden acceder.
- El panel de Oracle Cloud muestra la instancia inactiva.

**Mitigación:**
- Si la instancia está detenida (no terminada): reiniciarla desde el panel Oracle, luego `docker compose up -d`.
- Si la instancia fue reclamada: seguir el procedimiento de recuperación del Runbook §3 (crear nueva instancia, restaurar backup de base de datos, reiniciar servicios).
- Instalar el keepalive en cron para evitar que Oracle vuelva a reclamar la instancia (ver Runbook §7).
- Objetivo de recuperación: menos de 1 hora desde que se detecta el problema.

---

## Escenario 3: Las imágenes satelitales dejan de actualizarse (quota agotada o credenciales inválidas)

**Señal de alerta:**
- La barra de "Sentinel Hub hoy" en el dashboard llega al rojo (cerca o igual a 30 solicitudes).
- Los agricultores ven imágenes con fechas antiguas en el mapa.
- Los logs muestran errores 401 (credenciales inválidas) o 429 (demasiadas solicitudes) al llamar a Copernicus.

**Cómo lo detectamos:**
- La tarjeta "Quotas externas" del dashboard muestra la barra de Sentinel en amarillo o rojo.
- La tarjeta "Error de reconciliación" muestra valores inusualmente altos porque no hay imágenes nuevas con qué comparar.
- Los logs del job diario muestran errores específicos de la API de Sentinel Hub.

**Mitigación:**
- Si la quota se agotó: esperar al día siguiente (el contador se reinicia a medianoche UTC). Mientras tanto, activar `MOCK_SENTINEL=true` para que el motor siga funcionando con el último estado conocido.
- Si las credenciales expiraron: renovarlas en el portal de Copernicus Data Space y actualizar las variables de entorno en el servidor (`SENTINEL_HUB_CLIENT_ID` y `SENTINEL_HUB_CLIENT_SECRET`), luego reiniciar la aplicación (`docker compose restart app`).
- Reducir la frecuencia de consultas si hay muchas zonas activas para no llegar al límite diario.
