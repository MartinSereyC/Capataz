#!/usr/bin/env bash
# Mantiene viva la instancia Oracle ARM haciendo un ping cada 4 horas.
# Instalar en cron de Oracle o en tu propio servidor:
#   crontab -e
#   0 */4 * * * /ruta/a/keepalive.sh >> /var/log/capataz-keepalive.log 2>&1

BASE_URL="${CAPATAZ_BASE_URL:-https://capataz.tuminio.cl}"

echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") Enviando keepalive a ${BASE_URL}/api/keepalive"
curl -sf "${BASE_URL}/api/keepalive" || echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") ERROR: keepalive fallido"
