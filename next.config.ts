import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas.
const securityHeaders = [
  // Ninguém pode colocar o app dentro de um <iframe> (evita clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // O navegador não "adivinha" o tipo do arquivo (um .csv nunca vira HTML).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Links pra fora não levam a URL completa (que pode ter filtros) junto.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // O app não usa câmera, microfone nem localização.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Upload de extrato vai até 1 MB (src/lib/statement.ts); 2 MB dá folga pro FormData.
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
