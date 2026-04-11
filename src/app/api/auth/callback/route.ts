import { NextRequest, NextResponse } from "next/server";
import { verificarToken } from "@/lib/auth/tokens";
import { iniciarSesion } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=token_missing", request.url));
  }

  const payload = verificarToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=token_invalido", request.url));
  }

  const sessionValue = await iniciarSesion(payload.usuarioId);

  const response = NextResponse.redirect(new URL("/hoy", request.url));
  response.cookies.set("capataz_sesion", sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
