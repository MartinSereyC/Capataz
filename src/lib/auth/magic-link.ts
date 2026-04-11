import { sql } from "@/lib/db/client";
import type { UsuarioRow } from "@/lib/db/types";
import { firmarToken } from "./tokens";
import type { ResultadoMagicLink } from "./types";

const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

export async function generarMagicLink(
  email: string,
  baseUrl: string
): Promise<ResultadoMagicLink> {
  const rows = await sql<UsuarioRow[]>`
    INSERT INTO usuarios (email, login_method)
    VALUES (${email}, 'magic_link')
    ON CONFLICT (email) DO NOTHING
    RETURNING *
  `;

  let usuario: UsuarioRow;
  if (rows.length > 0) {
    usuario = rows[0];
  } else {
    const existing = await sql<UsuarioRow[]>`
      SELECT * FROM usuarios WHERE email = ${email} LIMIT 1
    `;
    usuario = existing[0];
  }

  const token = firmarToken({
    usuarioId: usuario.id,
    expiraEn: Date.now() + QUINCE_MINUTOS_MS,
  });

  const url = `${baseUrl}/api/auth/callback?token=${encodeURIComponent(token)}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Capataz <noreply@capataz.cl>",
        to: [email],
        subject: "Tu enlace mágico para Capataz",
        html: `<p>Haz clic en el siguiente enlace para iniciar sesión:</p><p><a href="${url}">${url}</a></p><p>Este enlace expira en 15 minutos.</p>`,
      }),
    });
    return { url, enviado: true, canal: "email" };
  }

  console.log(`\n=== MAGIC LINK PARA ${email} ===\n${url}\n=== FIN ===\n`);
  return { url, enviado: false, canal: "stub" };
}
