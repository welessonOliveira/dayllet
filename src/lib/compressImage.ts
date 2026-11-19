// Diminui a foto no próprio navegador antes de enviar (foto de celular tem 3-5 MB;
// pra ler um recibo, 1600 px em JPEG basta e fica com umas centenas de KB).
// Só roda no navegador (usa canvas).

const LADO_MAX = 1600;
const QUALIDADE = 0.82;
/** Abaixo disso, manda a foto como está. */
const PEQUENA = 700 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= PEQUENA) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const g = canvas.getContext("2d");
    if (!g) return file;
    g.fillStyle = "#fff"; // PNG com fundo transparente não fica preto no JPEG
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE));
    if (!blob || blob.size >= file.size) return file;
    const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return file; // formato que o navegador não abre: o servidor decide
  }
}
