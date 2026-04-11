import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../db/migrations",
);

export async function runMigrations(databaseUrl?: string): Promise<string[]> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido");

  const sql = postgres(url, { max: 1 });
  const applied: string[] = [];

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        nombre text PRIMARY KEY,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )
    `;

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existe =
        await sql`SELECT 1 FROM _migrations WHERE nombre = ${file}`;
      if (existe.length > 0) continue;

      const contenido = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

      await sql.begin(async (tx) => {
        await tx.unsafe(contenido);
        await tx`INSERT INTO _migrations (nombre) VALUES (${file})`;
      });

      applied.push(file);
      console.log(`[migrate] aplicada: ${file}`);
    }

    if (applied.length === 0) {
      console.log("[migrate] sin cambios");
    }
  } finally {
    await sql.end();
  }

  return applied;
}

const isMain = (() => {
  try {
    return (
      process.argv[1] &&
      resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    );
  } catch {
    return false;
  }
})();

if (isMain) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[migrate] error:", err);
      process.exit(1);
    });
}
