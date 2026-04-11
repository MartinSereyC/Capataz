#!/usr/bin/env tsx
import { generarMagicLinkAdmin } from "../src/lib/auth/admin-escape";

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith("--email="));
  const baseArg = args.find((a) => a.startsWith("--base="));

  if (!emailArg) {
    console.error("Uso: npx tsx scripts/admin-magic-link.ts --email=xxx@yy.cl --base=http://localhost:3000");
    process.exit(1);
  }

  const email = emailArg.replace("--email=", "");
  const baseUrl = baseArg ? baseArg.replace("--base=", "") : "http://localhost:3000";

  const resultado = await generarMagicLinkAdmin(email, baseUrl);

  console.log("\n========================================");
  console.log(`  MAGIC LINK ADMIN PARA: ${email}`);
  console.log("========================================");
  console.log(resultado.url);
  console.log("========================================\n");
  console.log("Copia este enlace y envialo por WhatsApp.");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
