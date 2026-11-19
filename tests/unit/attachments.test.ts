import { describe, expect, it } from "vitest";
import { cleanFileName, detectAttachmentMime, formatBytes } from "@/lib/attachments";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const texto = (s: string) => new TextEncoder().encode(s);

describe("detectAttachmentMime", () => {
  it("reconhece JPG, PNG, WebP e PDF pela assinatura", () => {
    expect(detectAttachmentMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectAttachmentMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectAttachmentMime(texto("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectAttachmentMime(texto("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("recusa o resto (HTML, executável, vazio)", () => {
    expect(detectAttachmentMime(texto("<html><script>"))).toBeNull();
    expect(detectAttachmentMime(texto("MZ\x90\0"))).toBeNull();
    expect(detectAttachmentMime(bytes())).toBeNull();
  });
});

describe("cleanFileName", () => {
  it("tira pastas, aspas e caracteres de controle", () => {
    expect(cleanFileName(["C:", "fotos", 'recibo "mercado".jpg'].join("\\"))).toBe("recibo mercado.jpg");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("a\u0000b\n.pdf")).toBe("ab.pdf");
    expect(cleanFileName("   ")).toBe("comprovante");
  });

  it("corta nomes gigantes mantendo a extensão", () => {
    const nome = cleanFileName(`${"x".repeat(300)}.pdf`);
    expect(nome).toHaveLength(100);
    expect(nome.endsWith(".pdf")).toBe(true);
  });
});

it("formatBytes", () => {
  expect(formatBytes(350 * 1024)).toBe("350 KB");
  expect(formatBytes(1.5 * 1024 * 1024)).toBe("1,5 MB");
});
