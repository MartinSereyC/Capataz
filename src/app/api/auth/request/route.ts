import { NextRequest, NextResponse } from "next/server";
import { generarMagicLink } from "@/lib/auth/magic-link";

// In-memory rate limit: max 3 requests per email per hour (Fase 1)
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const hora = 60 * 60 * 1000;
  const timestamps = (rateLimitMap.get(email) ?? []).filter(
    (t) => now - t < hora
  );
  if (timestamps.length >= 3) return false;
  timestamps.push(now);
  rateLimitMap.set(email, timestamps);
  return true;
}

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "Email requerido" }, { status: 400 });
  }

  if (!checkRateLimit(email)) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera una hora." },
      { status: 429 }
    );
  }

  const baseUrl = new URL(request.url).origin;
  const resultado = await generarMagicLink(email, baseUrl);

  return NextResponse.json({ ok: true, canal: resultado.canal });
}
