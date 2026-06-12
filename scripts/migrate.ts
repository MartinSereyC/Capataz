// Aplica supabase/migrations/*.sql en orden, registrando en schema_migrations.
// Uso: npm run db:migrate  (requiere DATABASE_URL)
import postgres from 'postgres';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL
  ?? 'postgres://postgres:postgres@localhost:54322/postgres';
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await sql`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const applied = new Set(
      (await sql`select version from schema_migrations`).map((r) => r.version as string),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) {
        console.log(`= ${file} (ya aplicada)`);
        continue;
      }
      const ddl = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(ddl);
        await tx`insert into schema_migrations (version) values (${version})`;
      });
      console.log(`+ ${file} aplicada`);
    }
    console.log('Migraciones al día.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Error en migración:', err);
  process.exit(1);
});
