import { createHmac, randomUUID } from "crypto";
import type { SesionToken } from "./types";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sign(data: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return base64url(createHmac("sha256", secret).update(data).digest());
}

export function firmarToken(payload: Omit<SesionToken, "jti"> & { jti?: string }): string {
  const token: SesionToken = {
    jti: payload.jti ?? randomUUID(),
    usuarioId: payload.usuarioId,
    expiraEn: payload.expiraEn,
  };
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256" })));
  const body = base64url(Buffer.from(JSON.stringify(token)));
  const sig = sign(`${header}.${body}`);
  return `${header}.${body}.${sig}`;
}

export function verificarToken(token: string): SesionToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = sign(`${header}.${body}`);
    if (sig !== expected) return null;
    const payload: SesionToken = JSON.parse(Buffer.from(body, "base64url").toString());
    if (Date.now() > payload.expiraEn) return null;
    return payload;
  } catch {
    return null;
  }
}
