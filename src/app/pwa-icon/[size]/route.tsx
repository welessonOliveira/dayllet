// Ícones do app instalável (PWA): /pwa-icon/192, /pwa-icon/512 e /pwa-icon/maskable.
import { ImageResponse } from "next/og";
import { AppIconImage } from "@/components/AppIconImage";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "192" ? 192 : 512;
  return new ImageResponse(<AppIconImage size={px} maskable={size === "maskable"} />, { width: px, height: px });
}
