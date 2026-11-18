// Helpers de dinheiro. Tudo em centavos (inteiro). Nunca use float pra conta.

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata centavos como moeda: 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

// Aceita "1.234,56", "1234,56", "50", "50,5" e "R$ 10,00".
// O ponto é sempre separador de milhar (padrão pt-BR).
const COM_MILHAR = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
const SEM_MILHAR = /^\d+(,\d{1,2})?$/;

/**
 * Converte o texto digitado (pt-BR) pra centavos.
 * Retorna `null` se o texto não for um valor válido.
 * A conta é feita só com strings e inteiros, sem float.
 */
export function parseBRLToCents(input: string): number | null {
  const texto = input.replace(/R\$/i, "").replace(/\s/g, "");
  if (!COM_MILHAR.test(texto) && !SEM_MILHAR.test(texto)) return null;

  const [inteiros, decimais = ""] = texto.replace(/\./g, "").split(",");
  const centavos =
    Number(inteiros) * 100 + Number(decimais.padEnd(2, "0") || "0");

  return Number.isSafeInteger(centavos) ? centavos : null;
}

/**
 * Igual ao parseBRLToCents, mas aceita sinal de menos ("-150,00" -> -15000).
 * Usado no saldo inicial de uma conta, que pode começar negativo (cheque especial).
 */
export function parseSignedBRLToCents(input: string): number | null {
  const texto = input.trim();
  const negativo = /^-/.test(texto) || /^R\$\s*-/i.test(texto);
  const cents = parseBRLToCents(texto.replace("-", ""));
  if (cents === null) return null;
  return negativo ? -cents : cents;
}

/** Centavos -> texto pra preencher input de edição: 123456 -> "1.234,56". */
export function centsToInput(cents: number): string {
  const sinal = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const inteiros = Math.trunc(abs / 100);
  const decimais = String(abs % 100).padStart(2, "0");
  return `${sinal}${inteiros.toLocaleString("pt-BR")},${decimais}`;
}
