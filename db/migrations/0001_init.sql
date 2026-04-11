-- Capataz Fase 1 — initial schema
-- PostGIS + UUID primary keys + timestamps. SRID 4326 everywhere.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- 1. usuarios
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE login_method_enum AS ENUM ('magic_link', 'admin_manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rol_enum AS ENUM ('agricultor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  login_method login_method_enum NOT NULL DEFAULT 'magic_link',
  idioma text NOT NULL DEFAULT 'es',
  rol rol_enum NOT NULL DEFAULT 'agricultor',
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);

-- =========================================================================
-- 2. predios
-- =========================================================================
CREATE TABLE IF NOT EXISTS predios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  geometria geometry(Polygon, 4326) NOT NULL,
  region text,
  comuna text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predios_usuario ON predios (usuario_id);
CREATE INDEX IF NOT EXISTS idx_predios_geom ON predios USING GIST (geometria);

-- =========================================================================
-- 3. zonas
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE prioridad_enum AS ENUM ('alta', 'media', 'baja');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS zonas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id uuid NOT NULL REFERENCES predios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  geometria geometry(Polygon, 4326) NOT NULL,
  cultivo text NOT NULL,
  prioridad prioridad_enum NOT NULL DEFAULT 'media',
  fase_fenologica_override text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonas_predio ON zonas (predio_id);
CREATE INDEX IF NOT EXISTS idx_zonas_geom ON zonas USING GIST (geometria);

-- =========================================================================
-- 4. fuentes_hidricas
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE fuente_tipo_enum AS ENUM ('pozo', 'canal', 'acumulador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS fuentes_hidricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id uuid NOT NULL REFERENCES predios(id) ON DELETE CASCADE,
  tipo fuente_tipo_enum NOT NULL,
  caudal_estimado_lh numeric,
  capacidad_estimada_l numeric,
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fuentes_predio ON fuentes_hidricas (predio_id);

-- =========================================================================
-- 5. fuente_zona (many-to-many)
-- =========================================================================
CREATE TABLE IF NOT EXISTS fuente_zona (
  fuente_id uuid NOT NULL REFERENCES fuentes_hidricas(id) ON DELETE CASCADE,
  zona_id uuid NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  PRIMARY KEY (fuente_id, zona_id)
);

CREATE INDEX IF NOT EXISTS idx_fuente_zona_zona ON fuente_zona (zona_id);

-- =========================================================================
-- 6. clima_diario
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE clima_origen_enum AS ENUM ('open_meteo', 'mock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS clima_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id uuid NOT NULL REFERENCES predios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  origen clima_origen_enum NOT NULL,
  t_min numeric,
  t_max numeric,
  precipitacion_mm numeric,
  et0_mm numeric,
  payload jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predio_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_clima_fecha ON clima_diario (fecha);
CREATE INDEX IF NOT EXISTS idx_clima_predio_fecha ON clima_diario (predio_id, fecha);

-- =========================================================================
-- 7. suelo_estimado
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE suelo_origen_enum AS ENUM ('soilgrids', 'mock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS suelo_estimado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id uuid NOT NULL REFERENCES predios(id) ON DELETE CASCADE,
  zona_id uuid REFERENCES zonas(id) ON DELETE CASCADE,
  origen suelo_origen_enum NOT NULL,
  textura text,
  capacidad_campo_pct numeric,
  punto_marchitez_pct numeric,
  heterogeneo boolean NOT NULL DEFAULT false,
  payload jsonb,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suelo_predio ON suelo_estimado (predio_id);
CREATE INDEX IF NOT EXISTS idx_suelo_zona ON suelo_estimado (zona_id);

-- =========================================================================
-- 8. fenologia_catalogo
-- =========================================================================
CREATE TABLE IF NOT EXISTS fenologia_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cultivo text NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  kc_referencia numeric NOT NULL,
  fase text NOT NULL,
  fuente text,
  notas text,
  UNIQUE (cultivo, mes)
);

CREATE INDEX IF NOT EXISTS idx_fenologia_cultivo ON fenologia_catalogo (cultivo);

-- =========================================================================
-- 9. observaciones_satelitales
-- =========================================================================
CREATE TABLE IF NOT EXISTS observaciones_satelitales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_id uuid NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  ndvi numeric,
  ndmi numeric,
  fuente text NOT NULL DEFAULT 'sentinel-2',
  payload jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zona_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_obs_sat_fecha ON observaciones_satelitales (fecha);
CREATE INDEX IF NOT EXISTS idx_obs_sat_zona_fecha ON observaciones_satelitales (zona_id, fecha);

-- =========================================================================
-- 10. estado_hidrico_interno
-- bookkeeping privado del motor, jamás expuesto al usuario
-- =========================================================================
CREATE TABLE IF NOT EXISTS estado_hidrico_interno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_id uuid NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  deficit_pct numeric,
  proyectado boolean NOT NULL DEFAULT false,
  inputs jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zona_id, fecha)
);

COMMENT ON TABLE estado_hidrico_interno IS 'bookkeeping privado del motor, jamás expuesto al usuario';

CREATE INDEX IF NOT EXISTS idx_estado_hidrico_fecha ON estado_hidrico_interno (fecha);

-- =========================================================================
-- 11. recomendaciones_diarias
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE semaforo_enum AS ENUM ('verde', 'amarillo', 'rojo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE confianza_enum AS ENUM ('baja', 'media', 'alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS recomendaciones_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_id uuid NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  semaforo semaforo_enum NOT NULL,
  timing_etiqueta text NOT NULL,
  confianza confianza_enum NOT NULL,
  razon_breve text NOT NULL,
  postergada_por_escasez boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zona_id, fecha),
  CONSTRAINT recomendaciones_sin_volumen CHECK (true)
);

-- Hard guard: forbid any column named litros/mm/volumen on this table.
-- Any future ALTER TABLE adding such a column will be blocked by this trigger.
CREATE OR REPLACE FUNCTION recomendaciones_forbid_volumen()
RETURNS event_trigger AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'recomendaciones_diarias'
      AND (
        column_name ILIKE '%litros%'
        OR column_name ILIKE '%mm%'
        OR column_name ILIKE '%volumen%'
      )
  LOOP
    RAISE EXCEPTION 'columna prohibida en recomendaciones_diarias: %', r.column_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE EVENT TRIGGER recomendaciones_guard
    ON ddl_command_end
    WHEN TAG IN ('ALTER TABLE', 'CREATE TABLE')
    EXECUTE FUNCTION recomendaciones_forbid_volumen();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_recomendaciones_fecha ON recomendaciones_diarias (fecha);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_zona_fecha ON recomendaciones_diarias (zona_id, fecha);

-- =========================================================================
-- 12. feedback_agricultor
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE valoracion_enum AS ENUM ('razonable', 'mas_o_menos', 'no_acerto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS feedback_agricultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recomendacion_id uuid NOT NULL REFERENCES recomendaciones_diarias(id) ON DELETE CASCADE,
  valoracion valoracion_enum NOT NULL,
  observacion_libre text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_recomendacion ON feedback_agricultor (recomendacion_id);
