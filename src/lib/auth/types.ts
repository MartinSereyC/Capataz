export interface SesionToken {
  jti: string;
  usuarioId: string;
  expiraEn: number;
}

export interface ResultadoMagicLink {
  url: string;
  enviado: boolean;
  canal: "email" | "stub";
}
