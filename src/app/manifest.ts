// Manifesto do app instalável (PWA): no celular, "Adicionar à tela inicial" abre o Dayllet em tela cheia.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dayllet — Finanças pessoais",
    short_name: "Dayllet",
    description: "Contas, gastos, previsão do mês e metas, em português.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#2d2621",
    theme_color: "#8f6a44",
    lang: "pt-BR",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
