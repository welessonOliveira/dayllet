// Inflação (IPCA) em inteiros, sem float (Decisão 23).
// Taxa mensal em pontos-base: 0,42% = 42 bps. Correção: valor × Π(1 + taxa).

export type MonthlyRate = { month: string; rateBps: number };

/**
 * Resposta da API SGS do Banco Central -> taxas mensais.
 * Formato: [{ "data": "01/10/2026", "valor": "0.14" }, ...]. Ignora linhas estranhas.
 */
export function parseSgsResponse(json: unknown): MonthlyRate[] {
  if (!Array.isArray(json)) return [];
  const out: MonthlyRate[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const { data, valor } = item as { data?: unknown; valor?: unknown };
    const m = typeof data === "string" ? /^\d{2}\/(\d{2})\/(\d{4})$/.exec(data) : null;
    const bps = typeof valor === "string" ? percentToBps(valor) : null;
    if (m && bps !== null) out.push({ month: `${m[2]}-${m[1]}`, rateBps: bps });
  }
  return out.sort((a, b) => (a.month < b.month ? -1 : 1));
}

/** "0.42" ou "0,42" (porcentagem) -> 42 bps. "-0.32" -> -32. Mais de 2 casas é arredondado. */
export function percentToBps(raw: string): number | null {
  const m = /^\s*(-?)(\d+)(?:[.,](\d+))?\s*$/.exec(raw);
  if (!m) return null;
  const dec = (m[3] ?? "").padEnd(3, "0");
  // arredonda pela 3ª casa (meio pra cima), tudo em inteiro
  let bps = Number(m[2]) * 100 + Number(dec.slice(0, 2)) + (Number(dec[2]) >= 5 ? 1 : 0);
  if (m[1] === "-") bps = -bps;
  return Number.isSafeInteger(bps) ? bps : null;
}

/**
 * Corrige `cents` pela inflação acumulada dos meses DEPOIS de `fromMonth` até `toMonth`
 * (inclusive). Ex.: um gasto de março corrigido até junho usa as taxas de abril, maio e junho.
 * Usa BigInt (fração exata) e arredonda só no fim. Mês sem taxa conhecida conta como 0%.
 */
export function adjustForInflation(cents: number, fromMonth: string, toMonth: string, rates: MonthlyRate[]): number {
  if (toMonth <= fromMonth) return cents;
  let num = BigInt(cents);
  let den = BigInt(1);
  for (const r of rates) {
    if (r.month > fromMonth && r.month <= toMonth) {
      num *= BigInt(10000 + r.rateBps);
      den *= BigInt(10000);
    }
  }
  // arredondamento "meio pra cima" (simétrico pra negativos)
  const negativo = num < BigInt(0);
  const abs = negativo ? -num : num;
  const q = (abs * BigInt(2) + den) / (den * BigInt(2));
  return Number(negativo ? -q : q);
}

/** Inflação acumulada no período, em bps (ex.: 1,23% = 123). */
export function accumulatedBps(fromMonth: string, toMonth: string, rates: MonthlyRate[]): number {
  // Corrige 1.000.000 e vê quanto cresceu: cada 100 a mais = 1 bp (0,01%).
  const corrigido = adjustForInflation(1_000_000, fromMonth, toMonth, rates);
  return Math.round((corrigido - 1_000_000) / 100);
}
