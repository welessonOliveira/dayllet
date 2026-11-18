// Geração de CSV pra abrir no Excel em português (Decisão 13: relatórios exportáveis).
// - Separador ";" (o Excel pt-BR usa vírgula como decimal).
// - BOM no começo pra o Excel entender UTF-8 (acentos).
// - Proteção contra "CSV injection": texto que começa com = + - @ (ou tab/CR) vira fórmula
//   no Excel; prefixamos com ' pra virar texto puro.

const PERIGOSO = /^[=+\-@\t\r]/;

/** Escapa uma célula de TEXTO (vinda do usuário). */
export function csvText(value: string | null | undefined): string {
  let s = (value ?? "").replace(/\r?\n/g, " ");
  if (PERIGOSO.test(s)) s = `'${s}`;
  return /[;"]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Centavos -> "1234,56" / "-1234,56" (número que o Excel pt-BR entende, sem "R$"). */
export function csvMoney(cents: number): string {
  const sinal = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sinal}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Monta o arquivo: cabeçalho + linhas (já escapadas), com BOM e CRLF. */
export function buildCsv(header: string[], rows: string[][]): string {
  const linhas = [header.map(csvText).join(";"), ...rows.map((r) => r.join(";"))];
  return "﻿" + linhas.join("\r\n") + "\r\n";
}
