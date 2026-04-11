import { sql } from "@/lib/db/client";
import type { UsuarioRow } from "@/lib/db/types";
import { generarMagicLink } from "./magic-link";
import type { ResultadoMagicLink } from "./types";

export async function generarMagicLinkAdmin(
  emailObjetivo: string,
  baseUrl: string
): Promise<ResultadoMagicLink> {
  // Ensure user exists
  await sql`
    INSERT INTO usuarios (email, login_method)
    VALUES (${emailObjetivo}, 'admin_manual')
    ON CONFLICT (email) DO NOTHING
  `;

  // Mark login_method as admin_manual
  await sql<UsuarioRow[]>`
    UPDATE usuarios SET login_method = 'admin_manual', actualizado_en = now()
    WHERE email = ${emailObjetivo}
  `;

  return generarMagicLink(emailObjetivo, baseUrl);
}
