-- Capataz: esquema de recomendación de riego basada en datos históricos.
-- Diseñado para Supabase (Postgres + PostGIS); corre localmente vía docker compose.
-- Convenciones:
--   * IDs uuid (generables en cliente; farm_id permite scoping RLS futuro)
--   * Cantidades de agua en mm
--   * Fechas en términos locales de la zona (America/Santiago)
--   * Toda tabla con datos externos lleva `origen` (procedencia; 'mock' es valor válido
--     y la UI debe etiquetarlo como dato simulado — regla CLAUDE.md "solo datos reales")
--   * Claves naturales para upserts idempotentes

-- PostGIS por paridad con Supabase; el esquema no lo usa aún (geometría en jsonb).
-- Tolerante a entornos dev sin la extensión instalada.
do $$ begin
  begin
    create extension if not exists postgis;
  exception when others then
    raise notice 'postgis no disponible; continuando sin la extensión';
  end;
end $$;

create table farms (
  id          uuid primary key,
  nombre      text not null,
  created_at  timestamptz not null default now()
);

create table zones (
  id            uuid primary key,
  farm_id       uuid not null references farms(id) on delete cascade,
  legacy_id     int,
  nombre        text,
  cultivo       text not null,
  area_ha       numeric(8,2) not null,
  geom_geojson  jsonb not null,
  centroid_lat  double precision not null,
  centroid_lng  double precision not null,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index zones_farm_idx on zones(farm_id);

create table soil_snapshots (
  id                   uuid primary key default gen_random_uuid(),
  zone_id              uuid not null references zones(id) on delete cascade,
  textura              text not null,
  capacidad_campo_pct  numeric(5,2) not null,
  punto_marchitez_pct  numeric(5,2) not null,
  profundidad_raiz_m   numeric(4,2) not null,
  taw_mm               numeric(6,1) not null,
  origen               text not null,
  raw                  jsonb,
  fetched_at           timestamptz not null default now()
);
create index soil_zone_idx on soil_snapshots(zone_id, fetched_at desc);

-- Clima por predio: las zonas comparten el centroide del predio (grilla Open-Meteo ~1km).
create table weather_daily (
  farm_id        uuid not null references farms(id) on delete cascade,
  fecha          date not null,
  t_min_c        numeric(5,2),
  t_max_c        numeric(5,2),
  precip_mm      numeric(6,2) not null default 0,
  et0_mm         numeric(5,2),
  et0_metodo     text not null,
  es_pronostico  boolean not null default false,
  origen         text not null,
  fetched_at     timestamptz not null default now(),
  primary key (farm_id, fecha)
);

create table satellite_observations (
  id            uuid primary key default gen_random_uuid(),
  zone_id       uuid not null references zones(id) on delete cascade,
  fecha         date not null,
  sensor        text not null check (sensor in ('s2', 's1')),
  ndvi          numeric(5,3),
  ndmi          numeric(5,3),
  vv_db         numeric(5,1),
  vh_db         numeric(5,1),
  orbit         text,
  nubosidad_pct numeric(5,1),
  origen        text not null,
  fetched_at    timestamptz not null default now(),
  unique (zone_id, fecha, sensor)
);
create index satobs_zone_fecha_idx on satellite_observations(zone_id, sensor, fecha desc);

create table irrigation_events (
  id           uuid primary key default gen_random_uuid(),
  zone_id      uuid not null references zones(id) on delete cascade,
  fecha        date not null,
  mm_aplicados numeric(6,2),
  horas        numeric(5,2),
  nota         text,
  created_at   timestamptz not null default now()
);
create index riego_zone_fecha_idx on irrigation_events(zone_id, fecha);

create table water_balance_daily (
  zone_id             uuid not null references zones(id) on delete cascade,
  fecha               date not null,
  et0_mm              numeric(5,2) not null,
  kc                  numeric(4,2) not null,
  ks                  numeric(4,3) not null default 1,
  etc_mm              numeric(5,2) not null,
  precip_mm           numeric(6,2) not null,
  precip_efectiva_mm  numeric(6,2) not null,
  riego_mm            numeric(6,2) not null default 0,
  riego_asumido       boolean not null default false,
  taw_mm              numeric(6,1) not null,
  raw_mm              numeric(6,1) not null,
  agotamiento_mm      numeric(6,1) not null,
  deficit_pct         numeric(5,1) not null,
  ajuste_satelital_mm numeric(6,1),
  fuente_anclaje      text,
  engine_version      text not null,
  computed_at         timestamptz not null default now(),
  primary key (zone_id, fecha)
);

-- Append-only: auditoría + dataset de entrenamiento ML futuro.
create table advice_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  zone_id             uuid not null references zones(id) on delete cascade,
  fecha               date not null,
  semaforo            text not null check (semaforo in ('verde', 'amarillo', 'rojo')),
  timing              text not null,
  lamina_mm           numeric(6,1),
  dias_hasta_estres   int,
  prioridad           int,
  deficit_pct         numeric(5,1) not null,
  lluvia_proxima_mm   numeric(6,1),
  lluvia_proxima_dias int,
  postergar           boolean not null default false,
  confianza           text not null check (confianza in ('alta', 'media', 'baja')),
  fuentes             jsonb not null,
  supuestos           jsonb not null default '[]',
  engine_version      text not null,
  created_at          timestamptz not null default now()
);
create index advice_zone_idx on advice_snapshots(zone_id, created_at desc);

create table backfill_jobs (
  id          uuid primary key default gen_random_uuid(),
  zone_id     uuid not null references zones(id) on delete cascade,
  tipo        text not null check (tipo in ('clima', 'suelo', 's2', 's1', 'balance', 'backtest')),
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'en_progreso', 'completado', 'error')),
  desde       date not null,
  hasta       date not null,
  cursor      date,
  error       text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (zone_id, tipo, desde, hasta)
);

-- Correcciones por zona aprendidas en la ventana de entrenamiento del backtest.
-- La fila más reciente por zona gana; defaults neutros cuando no hay calibración.
create table zone_calibrations (
  id              uuid primary key default gen_random_uuid(),
  zone_id         uuid not null references zones(id) on delete cascade,
  kc_factor       numeric(4,2) not null default 1,
  ndmi_offset     numeric(4,2) not null default 0,
  train_desde     date not null,
  train_hasta     date not null,
  fitted          boolean not null default false,
  engine_version  text not null,
  created_at      timestamptz not null default now()
);
create index zone_calib_idx on zone_calibrations(zone_id, created_at desc);

-- Resultados del hindcast (validación ciega): fuente de la confianza medida.
create table model_evaluations (
  id                  uuid primary key default gen_random_uuid(),
  zone_id             uuid not null references zones(id) on delete cascade,
  train_desde         date not null,
  train_hasta         date not null,
  test_desde          date not null,
  test_hasta          date not null,
  n_observaciones     int not null,
  mae_deficit_pct     numeric(5,1),
  bias_deficit_pct    numeric(5,1),
  error_por_horizonte jsonb not null default '{}',
  parametros          jsonb not null default '{}',
  engine_version      text not null,
  created_at          timestamptz not null default now()
);
create index model_eval_zone_idx on model_evaluations(zone_id, created_at desc);

-- Línea base estacional: percentiles mensuales de NDVI/NDMI por zona.
create view satellite_monthly_stats as
select
  zone_id,
  sensor,
  extract(month from fecha)::int as mes,
  count(*) as n,
  percentile_cont(0.2) within group (order by ndvi) as ndvi_p20,
  percentile_cont(0.5) within group (order by ndvi) as ndvi_p50,
  percentile_cont(0.8) within group (order by ndvi) as ndvi_p80,
  percentile_cont(0.5) within group (order by ndmi) as ndmi_p50
from satellite_observations
where sensor = 's2'
group by zone_id, sensor, extract(month from fecha);
