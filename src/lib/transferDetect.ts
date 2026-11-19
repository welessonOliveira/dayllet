// Reconhece, numa linha de extrato, dinheiro que só MUDOU DE CONTA (não é receita nem despesa).
// Puro, sem banco.
import { normalizeDescription } from "./categorize";
import type { WalletKind } from "./constants";

export type TransferKind =
  | "OWN" // Pix/TED pra você mesmo (outra conta sua)
  | "INVOICE" // pagamento da fatura do cartão (saindo da conta)
  | "CARD_PAYMENT" // no extrato do cartão: "Pagamento recebido"
  | "SAVINGS"; // cofrinho, caixinha, dinheiro guardado/resgatado

const TEM = (re: RegExp, s: string) => re.test(` ${s} `);

/** Primeiro e último nome (normalizados), se a pessoa tiver pelo menos dois. */
function nomeESobrenome(nome: string | null | undefined): [string, string] | null {
  const t = normalizeDescription(nome ?? "").split(" ").filter((x) => x.length >= 2);
  return t.length >= 2 ? [t[0], t[t.length - 1]] : null;
}

/**
 * Tipo de transferência que a linha parece ser, ou null.
 * `ownerName` é o nome do usuário (do login): Pix com nome E sobrenome dele é pra ele mesmo.
 */
export function detectTransfer(
  description: string,
  type: "INCOME" | "EXPENSE",
  ownerName: string | null | undefined,
  walletKind: WalletKind,
): TransferKind | null {
  const n = normalizeDescription(description);
  if (walletKind === "CREDIT_CARD") {
    return type === "INCOME" && TEM(/ PAGAMENTO (RECEBIDO|DE FATURA|EFETUADO) /, n) ? "CARD_PAYMENT" : null;
  }
  if (TEM(/ FATURA /, n) && type === "EXPENSE") return "INVOICE";
  if (TEM(/ (COFRINHO|CAIXINHA|DINHEIRO GUARDADO|GUARDADO NO|RESGATE( DO)? COFRINHO|RESGATE CAIXINHA) /, n)) return "SAVINGS";
  const nome = nomeESobrenome(ownerName);
  if (nome && TEM(/ (PIX|TRANSF\w*|TED|DOC) /, n)) {
    const palavras = new Set(n.split(" "));
    if (palavras.has(nome[0]) && palavras.has(nome[1])) return "OWN";
  }
  return null;
}

/**
 * Sugere a outra conta da transferência, só quando não há dúvida (uma única conta que serve).
 * `wallets` são as contas do usuário, sem a do extrato.
 */
export function suggestTransferWallet(
  kind: TransferKind,
  wallets: { id: string; kind: WalletKind; isDefault: boolean }[],
): string | null {
  const unica = (ws: { id: string }[]) => (ws.length === 1 ? ws[0].id : null);
  const naoCartao = wallets.filter((w) => w.kind !== "CREDIT_CARD");
  switch (kind) {
    case "INVOICE":
      return unica(wallets.filter((w) => w.kind === "CREDIT_CARD"));
    case "SAVINGS":
      return unica(wallets.filter((w) => w.kind === "SAVINGS"));
    case "OWN":
      // Pix pra si mesmo costuma ir pra outra conta corrente; poupança/cofrinho só se for a única opção.
      return unica(wallets.filter((w) => w.kind === "CHECKING")) ?? unica(naoCartao);
    case "CARD_PAYMENT":
      return unica(naoCartao) ?? naoCartao.find((w) => w.isDefault)?.id ?? null;
  }
}

export const TRANSFER_KIND_NOTE: Record<TransferKind, string> = {
  OWN: "Parece Pix pra você mesmo: é transferência entre suas contas",
  INVOICE: "Pagamento de fatura: é transferência pro cartão",
  CARD_PAYMENT: "Pagamento da fatura: é transferência da sua conta pro cartão",
  SAVINGS: "Cofrinho/caixinha: é transferência entre suas contas",
};
