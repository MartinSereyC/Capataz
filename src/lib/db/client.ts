import postgres from 'postgres';

// Cliente único de Postgres (Postgres.js). DATABASE_URL apunta al contenedor
// local hoy y a Supabase hosted mañana — es el único punto de cambio.
let _sql: ReturnType<typeof postgres> | null = null;

export function dbDisponible(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getSql(): ReturnType<typeof postgres> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no configurada');
  }
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL, {
      max: 5,
      idle_timeout: 20,
      onnotice: () => {},
    });
  }
  return _sql;
}
