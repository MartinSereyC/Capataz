# Manual de operaciones — Capataz

Este documento está escrito en lenguaje simple para que cualquier persona pueda operar la aplicación sin necesidad de saber programar. Cada sección describe qué hace cada paso en términos cotidianos.

---

## 1. Cómo iniciar localmente (en tu computador)

Abre una terminal en la carpeta del proyecto y ejecuta estos tres comandos en orden:

```
npm run db:up
```
Esto levanta la base de datos en tu computador (como encender un cajón de archivos).

```
npm run db:migrate
```
Esto prepara la estructura interna de la base de datos (como organizar los cajones antes de usarlos).

```
npm run dev
```
Esto inicia la aplicación. Luego abre tu navegador en `http://localhost:3000`.

---

## 2. Cómo desplegar en Oracle ARM (servidor en la nube)

Estos pasos asumen que tienes una instancia Ubuntu ARM recién creada en Oracle Cloud.

**Paso 1 — Conectarte al servidor**

Conéctate por SSH a tu instancia Oracle usando el usuario `ubuntu` y tu archivo de llave.

**Paso 2 — Instalar Docker**

Ejecuta estos comandos en el servidor:

```
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Cierra sesión y vuelve a conectarte para que el cambio de grupo surta efecto.

**Paso 3 — Clonar el repositorio**

```
git clone https://github.com/tu-usuario/capataz-fase1.git
cd capataz-fase1
```

**Paso 4 — Configurar las variables de entorno**

Crea el archivo `.env.local` en la carpeta del proyecto con tus credenciales:

```
cp .env.example .env.local
```

Edita `.env.local` con tus valores reales (credenciales de Copernicus, clave secreta de autenticación, etc.).

**Paso 5 — Iniciar la aplicación**

```
docker compose up -d --build
```

Esto construye y levanta todos los servicios en segundo plano.

**Paso 6 — Verificar que todo funciona**

```
docker compose logs app
```

Si ves líneas que dicen "ready" sin errores, la aplicación está corriendo.

---

## 3. Cómo recuperar si Oracle reclama la instancia (objetivo: 1 hora)

Oracle puede reclamar instancias gratuitas que llevan mucho tiempo sin actividad. Si esto ocurre:

**Paso 1 — Restaurar la base de datos desde backup**

TODO: Definir destino del backup (pregunta abierta del plan §14). Por ahora, toma nota manual del último dump y guárdalo en un lugar seguro.

**Paso 2 — Crear una nueva instancia**

En Oracle Cloud, crea una nueva instancia Ubuntu ARM con la misma forma (1 OCPU, 6 GB RAM).

**Paso 3 — Instalar Docker y clonar el repositorio**

Repite los Pasos 2 y 3 de la sección anterior.

**Paso 4 — Restaurar la base de datos**

Si tienes un archivo de dump (`capataz.dump`), súbelo al servidor y ejecuta:

```
docker compose up -d db
docker exec -i capataz-db pg_restore -U postgres -d capataz < capataz.dump
```

**Paso 5 — Iniciar la aplicación**

```
docker compose up -d --build
```

**Paso 6 — Verificar**

Abre el navegador en `https://capataz.tuminio.cl/admin` y revisa que el dashboard carga.

---

## 4. Cómo generar un magic link manual (acceso de emergencia)

Si un agricultor no puede ingresar, puedes generarle un enlace de acceso directo:

```
npm run admin:magic -- --email=agricultor@ejemplo.cl --base=https://capataz.tuminio.cl
```

Esto muestra una URL en la terminal. Cópiala y pégala en un mensaje de WhatsApp al agricultor. El enlace expira en 15 minutos.

---

## 5. Cómo revisar el dashboard

Abre `https://capataz.tuminio.cl/admin` en tu navegador (requiere estar autenticado como administrador).

El dashboard muestra cinco tarjetas:

- **Reportes de hoy** — Cuántos informes diarios se generaron versus cuántos se esperaban. Verde significa que todo salió bien. Rojo significa que algo falló en el proceso del día.

- **Errores últimas 24 h** — Cuántas zonas no tienen datos de humedad recientes. Verde es cero errores. Amarillo es 1 a 3. Rojo es 4 o más, y hay que investigar.

- **Feedback últimas 24 h** — Qué opinaron los agricultores sobre las recomendaciones. Tres barras: "razonable" (bien), "más o menos" (aceptable), "no acertó" (mal). Si la barra roja crece, revisa el motor de recomendaciones.

- **Error de reconciliación** — Diferencia entre lo que dice la imagen satelital y lo que calcula el motor interno, por cada predio. Números cercanos a cero son buenos. Números grandes indican que el modelo necesita ajuste.

- **Quotas externas** — Cuántas consultas se hicieron hoy a Sentinel Hub (máximo 30 diarias) y cuándo fue el último ping de keepalive. Si la barra llega al rojo, el sistema podría quedarse sin imágenes por el resto del día.

El dashboard se actualiza automáticamente cada 60 segundos.

**Qué hacer cuando algo está en rojo:**
- Rojo en reportes: revisar los logs del servidor (`docker compose logs app`) buscando errores del job diario.
- Rojo en errores: revisar zonas sin datos en la base de datos.
- Rojo en feedback: revisar los parámetros del motor de riego.
- Barra de Sentinel al rojo: esperar a que se reinicie el contador al día siguiente.

---

## 6. Cómo ejecutar el job diario manualmente

Si el proceso automático falló o quieres regenerar los informes de una fecha específica:

```
npm run job:daily -- --fecha=2026-04-10
```

Reemplaza la fecha por el día que necesitas. El resultado aparece en los logs del terminal.

---

## 7. Qué hacer si el keepalive falla

El keepalive es un ping automático que le dice a Oracle que la instancia sigue en uso.

**Señales de que el keepalive falló:**
- La tarjeta "Quotas externas" del dashboard muestra "—" en "Keepalive último ping".
- La aplicación dejó de responder.

**Pasos para recuperar:**

1. Entra al panel de Oracle Cloud y verifica que la instancia esté en estado "Running".
2. Si la instancia está detenida, iníciala desde el panel.
3. Conéctate por SSH y ejecuta:
   ```
   docker compose up -d
   ```
4. Verifica que el keepalive vuelve a funcionar:
   ```
   curl https://capataz.tuminio.cl/api/keepalive
   ```
   Deberías ver `{"ok":true,"ts":"..."}`.
5. Para instalar el keepalive automático en el servidor (se ejecuta cada 4 horas), abre el cron del servidor:
   ```
   crontab -e
   ```
   Y agrega esta línea:
   ```
   0 */4 * * * CAPATAZ_BASE_URL=https://capataz.tuminio.cl /home/ubuntu/capataz-fase1/scripts/keepalive.sh >> /var/log/capataz-keepalive.log 2>&1
   ```
