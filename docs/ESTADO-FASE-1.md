# Estado de Fase 1 — Capataz

**Fecha del corte**: 2026-04-10
**Rama**: `fase-1-timing-riego`
**Worktree**: `/Users/martinsc/AAA Proyectos Software/Capatas/capataz-fase1`
**Base**: `sentinel/approach-ab-combined` (la rama de la demo, intacta)
**Plan fuente**: `.omc/plans/consensus-fase-1-timing-riego.md` (copia del plan consolidado post-ralplan)

---

## Cómo se construyó esto

Todo el código fue escrito por un enjambre de agentes ejecutores en paralelo orquestados por Claude Code (modo autopilot/ultrawork). El orquestador no escribió código a mano: dividió el trabajo en tareas independientes, dio a cada agente un briefing autocontenido con los archivos que podía y no podía tocar, los disparó simultáneamente, y verificó el suite completo al final de cada ola.

Tres olas, 15 agentes en total:

- **Ola 1** (5 agentes): fundación de datos y motor puro.
- **Ola 2** (5 agentes): orquestación, auth, PWA shell, sentinel, repos.
- **Ola 3** (5 agentes): UI, wiring del layout, dashboard, runbook.

---

## Estado de tests

**231 tests pasando en 46 archivos, 2.68 segundos, cero regresiones.**

Comando para verificar: `npm test` dentro del worktree.

---

## Qué quedó construido (por milestone del plan)

### Milestone A — Persistencia + auth + export JSON ✅

**Base de datos**
- `docker-compose.yml` (raíz) — dos servicios: `db` (Postgres 16 + PostGIS 3 Alpine) y `app` (Next.js). Volumen persistente `capataz-db-data`. Postgres solo expuesto en `127.0.0.1:5432`.
- `Dockerfile.db` — imagen PostGIS con extensiones `postgis`, `uuid-ossp`, `pgcrypto` habilitadas en init.
- `db/migrations/0001_init.sql` — 12 tablas con UUID PKs, timestamps, foreign keys, índices GIST sobre geometrías (SRID 4326), constraints únicos, enums, y un event trigger que bloquea para siempre cualquier columna `litros`, `mm` o `volumen` en la tabla `recomendaciones_diarias` (garantía estructural del contrato de producto).
- `db/migrations/0002_seed_fenologia.sql` — 36 INSERTs del catálogo de fenología (palto/cítricos/ciruela × 12 meses) sincronizados con el TypeScript.
- `src/lib/db/client.ts` — cliente `postgres` (porsager/postgres) tagged template, pool 10, lee `DATABASE_URL` validado con zod.
- `src/lib/db/migrate.ts` — runner que aplica migraciones sorted en transacción, tracking en `_migrations`. Tiene CLI entry.
- `src/lib/db/types.ts` — tipos TS para las 12 tablas.

**Las 12 tablas**:
1. `usuarios` — id, email, login_method, idioma, rol (agricultor/admin).
2. `predios` — geometría polígono, usuario_id, región, comuna.
3. `zonas` — geometría sub-polígono, cultivo, prioridad, fase_fenologica_override.
4. `fuentes_hidricas` — tipo (pozo/canal/acumulador), caudal, capacidad.
5. `fuente_zona` — many-to-many fuente ↔ zonas.
6. `clima_diario` — t_min, t_max, precipitación, et0, origen.
7. `suelo_estimado` — textura, capacidad de campo, punto de marchitez, heterogéneo.
8. `fenologia_catalogo` — cultivo, mes, Kc, fase.
9. `observaciones_satelitales` — NDVI, NDMI por zona y fecha.
10. `estado_hidrico_interno` — déficit % por zona y día (marcado como "bookkeeping privado del motor, jamás expuesto").
11. `recomendaciones_diarias` — semáforo, timing, confianza, razón breve (sin volumen ni litros por constraint).
12. `feedback_agricultor` — valoración razonable/más o menos/no acertó + observación libre.

**Auth magic link**
- `src/lib/auth/tokens.ts` — HMAC-SHA256 firmado con `AUTH_SECRET` de `.env.local`. 15 min para magic link, 30 días para sesión.
- `src/lib/auth/magic-link.ts` — find-or-create usuario, genera token, envía email via Resend si hay `RESEND_API_KEY`, si no lo hay escribe el link a stdout con banner visible (escape hatch).
- `src/lib/auth/admin-escape.ts` — mismo flujo pero marca el usuario como `login_method='admin_manual'`. Para enviar por WhatsApp.
- `src/lib/auth/session.ts` — inicio y lectura de sesión 30 días.
- `src/lib/auth/server-helpers.ts` — `obtenerSesionActual()` lee cookie, `requerirSesion()` redirige a `/login`.
- `src/app/api/auth/request/route.ts` — POST `/api/auth/request`, rate limit 3/hora por email.
- `src/app/api/auth/callback/route.ts` — GET con token, verifica, setea cookie httpOnly, redirige a `/hoy`.
- `src/app/api/auth/logout/route.ts` — POST, limpia cookie.
- `src/app/(auth)/login/page.tsx` — formulario Spanish: "Ingresa tu email", "Enviar enlace mágico".
- `scripts/admin-magic-link.ts` — CLI: `npm run admin:magic -- --email=x@y.cl --base=http://host`.

**Export JSON**
- `src/lib/predios/export.ts` — `exportarPredioJSON(id)` construye JSON completo: predio (geometría como GeoJSON via `ST_AsGeoJSON`), zonas, fuentes, clima 30 días, suelo, observaciones, estado hídrico, recomendaciones, feedback. Scrubber defensivo que elimina cualquier clave litros/mm/volumen si se colara.
- `src/app/api/export/predio/[id]/route.ts` — GET con `Content-Disposition: attachment`. Sesión vía cookie, o `?admin_token=` como fallback durante desarrollo.

### Milestone B — Onboarding + zonas + fuente hídrica ✅

- `src/app/(app)/predios/nuevo/page.tsx` — shell server component que requiere sesión.
- `src/app/(app)/predios/nuevo/wizard.tsx` — wizard cliente de 5 pasos:
  1. Subir PDF (usa `extractTextFromPDF` y `parseCoordinates` del `src/lib/pdf/` existente, extrae polígono vía `utmPairsToWGS84` y `buildPolygon`) o dibujar manual.
  2. Ajustar polígono del predio con Leaflet + Geoman edit.
  3. Dibujar sub-polígonos de zonas con cultivo + prioridad.
  4. Fuente hídrica (pozo/canal/acumulador) con asignación checkboxes a zonas.
  5. Revisar y guardar.
- `src/app/(app)/predios/nuevo/actions.ts` — server actions: `guardarPredioCompleto` (zod + `sql.begin()` transacción única) y `actualizarZonaConfig`.
- `src/app/(app)/predios/page.tsx` — lista de predios del usuario.
- `src/app/(app)/predios/[id]/page.tsx` — detalle con edición inline de prioridad y override de fenología.
- `src/components/map/predio-map.tsx` — wrapper SSR-safe sobre react-leaflet + Geoman. Modos view/edit/draw-zona. Dynamic import con `ssr: false`.
- `src/lib/onboarding/validador.ts` — `zonaDentroDePredio` (ray-casting) y `sinTraslapesEntreZonas` (vertex-in-polygon + edge intersection).

### Milestone C1 — Clima + suelo ✅

**Clima** (`src/lib/clima/`)
- `open-meteo.ts` — cliente real, endpoint `api.open-meteo.com/v1/forecast` con `past_days` + `forecast_days=7`, timezone America/Santiago. Cache 24h en memoria. Circuit breaker a 3 fallas consecutivas.
- `mock.ts` — generador determinístico LCG-seeded por lat/lon. 30 días, tMin 5-18, tMax 15-32, 3-5 eventos de lluvia plausibles.
- `index.ts` — facade que lee `USE_MOCK_CLIMA` o `NODE_ENV=test` para enrutar.

**Suelo** (`src/lib/suelo/`)
- `soilgrids.ts` — cliente real, ISRIC API, parsing de sand/clay/silt, clasificación USDA, pedotransfer Saxton & Rawls simplificado para capacidad de campo y punto de marchitez. Cache permanente.
- `mock.ts` — tabla por comuna (Quillota, Los Andes, Rancagua, Curicó, Buin) con bboxes aproximados y fallback franco.
- `heterogeneidad.ts` — `muestrearPredioYZonas` samplea centroide de predio + centroide de cada zona en paralelo, calcula divergencia máx, marca `heterogeneo=true` si >20%.

### Milestone C2 — Fenología seed ✅

- `src/lib/fenologia/catalogo.ts` — constante `CATALOGO_FENOLOGIA` con 36 entradas:
  - Palto Hass Kc 0.55-1.00 (reposo julio → desarrollo fruto enero-febrero).
  - Cítricos Kc 0.60-0.82 (rango estrecho, perennifolios).
  - Ciruela D'Agen Kc 0.50-1.15 (rango amplio, caducifolio).
  - Umbrales rojo/amarillo calibrados por fase (floración y cuaje tienen margen estrecho, reposo amplio).
  - Fuentes: FAO-56 tabla 12 + INIA serie actas (estimación).
- `src/lib/fenologia/lookup.ts` — `obtenerFenologia(cultivo, mes, override?)` retorna entrada del catálogo o copia modificada si hay override de fase.
- Sincronizado con seed SQL `db/migrations/0002_seed_fenologia.sql`.

### Milestone D — Motor + semáforo + escasez + daily job ✅

**Motor FAO-56** (`src/lib/engine/`, bookkeeping privado)
- `types.ts` — tipos de entrada y salida. El tipo `Recomendacion` tiene comentario encima: "contrato público: timing, nunca volumen". No tiene campos litros/mm/volumen/caudal.
- `et0.ts` — Hargreaves con radiación extraterrestre FAO-56. Calibrado contra valores FAO de referencia para Chile central (lat -33).
- `balance.ts` — balance hídrico `deficit_hoy = deficit_ayer + et0*kc - precipitacion_efectiva - riego`. Precipitación efectiva USDA-SCS simplificada (<5mm descartado, resto × 0.8). Clamp [0, 100].
- `calibracion.ts` — reconciliación contra NDMI/NDVI al llegar nueva imagen Sentinel. Ponderación 0.6 observado / 0.4 proyectado. Retorna error de reconciliación.
- `semaforo.ts` — traducción déficit → verde/amarillo/rojo + timing ("hoy", "mañana", "3-4 días", "no urgente"). Reglas de umbral con ventana.
- `escasez.ts` — arbitraje de escasez cuando la suma de zonas rojas excede capacidad de fuente. Prioriza alta → media → baja, marca zonas postergadas con razón.
- `confianza.ts` — primeros 14 días de un predio → `baja`. Desde día 15 con error de reconciliación <0.2 → `media`. `alta` reservada para Fase 2.
- `index.ts` — `ejecutarMotor(inputs): Recomendacion[]` orquestador.

**Daily job** (`src/lib/cron/`)
- `daily-job.ts` — `ejecutarJobDiario({ fecha?, predioIds? })`:
  1. Por cada predio: trae clima histórico + forecast 7d.
  2. Por cada zona: lookup fenología por cultivo+mes+override, suelo cacheado, estado hídrico previo desde DB.
  3. Llama al motor.
  4. Upsert en `estado_hidrico_interno` y `recomendaciones_diarias` con `ON CONFLICT (zona_id, fecha) DO UPDATE`.
  5. Log JSON line por zona con inputs/output/duración.
  6. Errores por predio no detienen a los otros.
- `scheduler.ts` — `node-cron` wrapper. Corre 05:30 America/Santiago. Gate con `ENABLE_CRON=true`.
- `sentinel-budget.ts` — circuit breaker. Techo duro 30 requests/día, pausa a 25, log `CIRCUIT_BREAKER_SENTINEL_ACTIVO`.
- `logger.ts` — JSON line logger estructurado con writer inyectable para tests.
- `observabilidad.ts` — cinco métricas para el dashboard del solo-builder.
- `scripts/run-daily-job.ts` — CLI: `npm run job:daily -- --fecha=YYYY-MM-DD --predio=uuid`.

**Sentinel-2 observaciones** (`src/lib/observaciones/`)
- `ingestor.ts` — `ingestarUltimaObservacion(zonaId, geometria, fechaDesde)`. Thin adapter sobre `src/lib/sentinel/` existente (sentinel module NO se modificó). Usa Sentinel Hub Statistics API para obtener NDVI+NDMI numéricos. Deduplica por fecha. Respeta `SentinelBudget`.
- `repo.ts` — CRUD sobre tabla `observaciones_satelitales`.

### Milestone E1 — PWA shell ✅

- `public/manifest.json` — Web App Manifest Spanish, theme teal, `start_url=/hoy`, `lang=es-CL`.
- `public/sw.js` — service worker vanilla (sin next-pwa):
  - Cache version `capataz-v1`.
  - Precache en install: `/`, `/hoy`, `/offline.html`, `/manifest.json`.
  - HTML navegaciones: network-first con 3s timeout, fallback cache, último recurso `/offline.html`.
  - `/api/hoy/*` GET: stale-while-revalidate.
  - `/api/feedback` POST offline: encolado en IndexedDB `capataz-feedback-queue`, responde 202 `{encolado: true}`.
  - Evento `sync` replay de cola.
  - Evento `activate` limpia versiones viejas.
- `public/offline.html` — página Spanish "Sin conexión. Mostrando última recomendación guardada."
- `public/icon-192.svg`, `public/icon-512.svg` — **placeholders gota teal**. PENDIENTE reemplazar por PNGs profesionales. Ver `public/ICONS_TODO.md`.
- `src/components/pwa/register-sw.tsx` — client component que registra SW en mount.
- `src/lib/pwa/feedback-queue.ts` — helpers IndexedDB: `encolarFeedback`, `leerCola`, `vaciarCola`.

### Milestone E2 — Vista diaria + feedback UI ✅

- `src/app/(app)/hoy/page.tsx` — server component, requiere sesión, redirige a login si no hay.
  - Header con fecha en español (`Intl.DateTimeFormat('es-CL')`).
  - Zonas agrupadas por predio.
  - Cada zona: semáforo dot, nombre, timing, cultivo, badge de prioridad.
  - **Orden: rojo primero, luego amarillo, luego verde** dentro de cada predio.
  - Zonas postergadas por escasez muestran nota sutil "prioridad menor, regar cuando alcance fuente".
  - Empty state "Aún no hay recomendaciones para hoy. El reporte se genera a las 5:30 AM."
- `src/app/(app)/hoy/[id]/page.tsx` — detalle de una recomendación con semáforo grande, razón breve, confianza con tooltip, tres botones de feedback, textarea de observación libre.
- `src/app/(app)/hoy/feedback-form.tsx` — client component. POST a `/api/feedback`. Si falla (404, offline), fallback a `encolarFeedback` y muestra "Guardado sin conexión, se enviará al reconectar".
- `src/app/(app)/hoy/semaforo.tsx` — dot con colores Tailwind.
- `src/app/(app)/hoy/layout.tsx` — contenedor mobile-first, `max-w-md`, padding.
- `src/lib/recomendaciones/repo.ts` — `listarRecomendacionesDelDia(usuarioId)` joinea recomendaciones + zonas + predios con ownership check.
- `src/lib/feedback/repo.ts` — `guardarFeedback` con ownership, `ultimosNFeedbacksDePredio`.
- `src/lib/feedback/alertas.ts` — `detectarAlertaNoAcerto` (últimos 2 = `no_acerto` → disparar), `emitirAlertaSiCorresponde` logea warning estructurado.
- `src/app/api/feedback/route.ts` — POST endpoint zod-validado, rate limit 20/día por usuario, dispara alerta si corresponde.

### Milestone F — Hardening + dashboard + runbook ✅ (parcial)

- `src/app/(admin)/admin/page.tsx` — dashboard del solo-builder. Chequea rol=admin. Fetch paralelo de las 5 métricas. Cards:
  1. Reportes de hoy (N/esperados, verde/rojo).
  2. Errores últimas 24h (verde 0, amarillo 1-3, rojo 4+).
  3. Feedback últimas 24h (tres barras).
  4. Error reconciliación por predio (tabla).
  5. Quotas externas (sentinel hoy, keepalive último ping).
  Auto-refresh meta cada 60 segundos.
- `src/app/api/keepalive/route.ts` — GET endpoint. Retorna `{ok: true, ts: ISO}` y logea evento `keepalive_ping`. Para invocar desde cron externo cada 4 horas y evitar reclamo Oracle ARM.
- `scripts/keepalive.sh` — shell script para instalar en cron.
- `docs/RUNBOOK.md` — **runbook en español llano** para el solo-builder, 7 secciones:
  1. Cómo iniciar localmente (db:up, db:migrate, dev).
  2. Cómo desplegar a Oracle ARM (fresh Ubuntu, docker, clone, env, compose up).
  3. Cómo recuperar si Oracle reclama la instancia (objetivo 1 hora del plan §9).
  4. Cómo generar magic link manual (admin escape hatch).
  5. Cómo revisar el dashboard `/admin`.
  6. Cómo ejecutar daily job manualmente.
  7. Qué hacer si el keepalive falla.
- `docs/PREMORTEM.md` — tres escenarios del plan §9 en español: deriva del motor entre imágenes, Oracle reclama instancia, agricultor pierde confianza.

### Shell de aplicación y preservación del visor ✅

- `src/app/layout.tsx` — modificado: async, lee cookie de sesión, envuelve children en `SesionProvider`, link manifest en head, `lang="es-CL"`, banner disclaimer fijo al fondo, registro de SW.
- `src/app/page.tsx` — ya no es el visor; redirige según sesión a `/hoy` o `/login`.
- `src/app/explorar/page.tsx` — el visor NDVI/NDMI original preservado intacto aquí. Accesible en `/explorar`.
- `src/components/disclaimer-banner.tsx` — banner teal fijo al fondo con "Herramienta de apoyo, no reemplaza el criterio del agricultor."
- `src/components/session-context.tsx` — React context cliente con `useSesion()`.

---

## Dependencias agregadas al package.json

- `postgres` — cliente Postgres.
- `zod` — validación runtime.
- `node-cron` — daily job scheduler.
- Dev: `tsx`, `@types/node-cron`, `fake-indexeddb` (si lo agregó el agente de PWA).

Scripts nuevos:
- `db:up` — levanta Postgres.
- `db:migrate` — corre migraciones.
- `db:reset` — wipe + up + migrate.
- `job:daily` — ejecuta el daily job manualmente.
- `admin:magic` — genera magic link admin para enviar por WhatsApp.

---

## Variables de entorno

En `.env.example`:
- `DATABASE_URL` — `postgres://capataz:capataz@localhost:5432/capataz`
- `AUTH_SECRET` — generar con `openssl rand -base64 32`
- `RESEND_API_KEY` — **TODO, el usuario no tiene key todavía**. Sin ella, los magic links se imprimen a stdout con un banner y se pueden copiar manualmente al WhatsApp del agricultor.

En `.env.local` (ya copiado desde `capataz-approach-ab`):
- Variables de Sentinel Hub (ya existentes de la rama de la demo).

---

## Qué NO está hecho (pendientes reales)

1. **`npm run build` falla** porque rutas API importan el cliente de DB en tiempo de build y `DATABASE_URL` no está seteada. Fix: mover imports a runtime con `export const dynamic = 'force-dynamic'` o inicialización lazy. **Bloquea el deploy.**

2. **Iconos PNG del manifest** — hoy son SVG placeholder. Un diseñador debe generar `icon-192.png` e `icon-512.png` reales. Ver `public/ICONS_TODO.md`.

3. **Deploy a Oracle ARM no ejecutado.** docker-compose y runbook listos, pero no se ha levantado contra una instancia real. Necesita credencial de Oracle del usuario.

4. **Shakedown 14 días** — por definición requiere un predio real con un agricultor. No puede pasar en código.

5. **Commit y push** — nada de esto está commiteado aún. El worktree tiene todo sin stagear. La rama `fase-1-timing-riego` existe pero vacía de commits nuevos.

6. **Backup de Postgres** — pregunta abierta del plan §14. No decidido si va a bucket externo gratuito o snapshot manual semanal.

7. **Warnings de vitest** — cuatro warnings `vi.mock not at top level` en `__tests__/feedback/route.test.ts`. No rompen tests pero serán errores en futura versión de vitest. Arreglo trivial.

8. **Wire real del motor con recomendaciones persistidas** — el daily job escribe a DB, pero nadie ha corrido el flujo end-to-end contra PostGIS real con un predio real. Solo corrió con mocks en tests.

9. **Tests E2E Playwright** — el plan §13 pide onboarding real, vista diaria online, vista diaria offline, feedback encolado offline. Ninguno escrito. Solo hay unit + integration con mocks.

10. **Umbrales numéricos del semáforo por cultivo** — son estimaciones de literatura. Calibración real solo pasa durante shakedown.

---

## Cómo retomar desde aquí

### Si querés verificar lo hecho en navegador

```bash
cd "/Users/martinsc/AAA Proyectos Software/Capatas/capataz-fase1"
cp .env.example .env.local.extras  # y mergearlo con .env.local existente
# generar AUTH_SECRET y ponerlo en .env.local:
openssl rand -base64 32
# levantar db:
npm run db:up
npm run db:migrate
# levantar app:
npm run dev
# abrir http://localhost:3000
# como no hay sesión, te manda a /login
# pedís un magic link, lo copiás de la consola del server (aparece con banner)
# lo pegás en el navegador, te lleva a /hoy
# /explorar sigue funcionando como antes
```

### Si querés arreglar el build antes de deploy

El problema es que algunas rutas importan `src/lib/db/client` en tiempo de build. Agregar a cada ruta afectada:

```ts
export const dynamic = 'force-dynamic';
```

O hacer el cliente de DB lazy (inicializar dentro de cada handler). El agente que haga esto debe buscar con `grep -rn "from.*@/lib/db/client" src/app/api/` para encontrar todas las rutas afectadas.

### Si querés hacer el commit

Tres commits limpios recomendados (el usuario prefiere lenguaje llano, no conventional commits):

```bash
cd "/Users/martinsc/AAA Proyectos Software/Capatas/capataz-fase1"
git add db docker-compose.yml Dockerfile.db src/lib/db src/lib/auth src/app/api/auth src/app/\(auth\) scripts/admin-magic-link.ts .env.example package.json package-lock.json __tests__/db __tests__/auth
git commit -m "Add data foundation: schema, docker, auth magic link, admin escape"

git add src/lib/engine src/lib/clima src/lib/suelo src/lib/fenologia src/lib/cron src/lib/observaciones scripts/run-daily-job.ts __tests__/engine __tests__/clima __tests__/suelo __tests__/fenologia __tests__/cron __tests__/observaciones
git commit -m "Add irrigation timing engine, weather, soil, phenology, daily job"

git add src/app/\(app\) src/app/\(admin\) src/app/api/feedback src/app/api/keepalive src/app/api/export src/app/page.tsx src/app/layout.tsx src/app/explorar src/components src/lib/predios src/lib/recomendaciones src/lib/feedback src/lib/onboarding src/lib/pwa public/manifest.json public/sw.js public/offline.html public/icon-192.svg public/icon-512.svg public/ICONS_TODO.md docs __tests__/app __tests__/admin __tests__/recomendaciones __tests__/feedback __tests__/predios __tests__/onboarding __tests__/pwa
git commit -m "Add onboarding, daily view, feedback, dashboard, PWA shell, runbook"
```

Push cuando esté listo:
```bash
git push -u origin fase-1-timing-riego
```

### Para la próxima sesión

Retomar desde el archivo `.omc/plans/consensus-fase-1-timing-riego.md` (el plan original) y este archivo `docs/ESTADO-FASE-1.md`. La próxima ola debería ser:

1. Arreglar `npm run build` (quitar imports DB de build-time).
2. Commit + push.
3. Verificación end-to-end contra Postgres real con un predio de prueba.
4. Setup deploy Oracle ARM siguiendo `docs/RUNBOOK.md`.
5. Tests Playwright E2E.
6. Coordinar shakedown con agricultor real en Quillota (Fase 1 § shakedown).

---

## Principios del plan que se respetaron

1. ✅ **Simplicidad operacional**: un contenedor, un cron in-process, un Postgres.
2. ✅ **El agricultor nunca ve litros**: constraint de DB + tipo TS + test de assertion + grep en UI. Cuatro capas.
3. ✅ **Motor como bookkeeping privado**: `estado_hidrico_interno` jamás se expone en ninguna vista.
4. ✅ **Cada discrepancia es calibración**: override de fenología por zona funciona desde día uno.
5. ✅ **La demo de mañana no se rompe**: worktree separado, rama `sentinel/approach-ab-combined` intacta.
