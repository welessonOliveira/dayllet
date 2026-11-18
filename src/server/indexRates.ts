// Cache do IPCA (série 433 do SGS / Banco Central). Global, não é dado de usuário.
// Busca na API só quando o cache está velho; se a API cair, usa o que tem.
import { currentMonth, shiftMonth } from "@/lib/dates";
import { type MonthlyRate, parseSgsResponse } from "@/lib/ipca";
import type { Db } from "./db";

export const IPCA = "IPCA";
/**
 * URL da série 433 dos últimos 3 anos. (O modo ".../ultimos/N" aceita no máximo N = 20,
 * por isso buscamos por período.)
 */
export function sgsUrl(now: Date): string {
  const [y, m] = shiftMonth(currentMonth(now), -36).split("-");
  const [fy, fm] = currentMonth(now).split("-");
  return (
    "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json" +
    `&dataInicial=01/${m}/${y}&dataFinal=01/${fm}/${fy}`
  );
}
/** Não chama a API de novo antes disso. */
const REFRESH_MS = 12 * 60 * 60 * 1000;

/** Função que busca o JSON da API. Os testes passam uma falsa (sem internet). */
export type Fetcher = (url: string) => Promise<unknown>;

const fetchJson: Fetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`SGS respondeu ${res.status}`);
  return res.json();
};

/**
 * Atualiza o cache se precisar. O IPCA de um mês sai no mês seguinte, então
 * "atualizado" = ter o mês retrasado (ou mais novo). Devolve se buscou na API.
 */
export async function refreshIpca(db: Db, now = new Date(), fetcher: Fetcher = fetchJson): Promise<boolean> {
  const ultimo = await db.indexRate.findFirst({ where: { series: IPCA }, orderBy: { month: "desc" } });
  const esperado = shiftMonth(currentMonth(now), -2);
  const recente = ultimo && now.getTime() - ultimo.fetchedAt.getTime() < REFRESH_MS;
  if (ultimo && (ultimo.month >= esperado || recente)) return false;

  try {
    const rates = parseSgsResponse(await fetcher(sgsUrl(now)));
    if (rates.length === 0) return false;
    await db.$transaction(
      rates.map((r) =>
        db.indexRate.upsert({
          where: { series_month: { series: IPCA, month: r.month } },
          create: { series: IPCA, month: r.month, rateBps: r.rateBps, fetchedAt: now },
          update: { rateBps: r.rateBps, fetchedAt: now },
        }),
      ),
    );
    return true;
  } catch (e) {
    console.error("Falha ao buscar IPCA (usando o cache):", e);
    return false;
  }
}

/** Taxas em cache (em ordem). Atualiza antes se estiver velho. */
export async function getIpcaRates(db: Db, now = new Date(), fetcher?: Fetcher): Promise<MonthlyRate[]> {
  await refreshIpca(db, now, fetcher);
  const rows = await db.indexRate.findMany({ where: { series: IPCA }, orderBy: { month: "asc" } });
  return rows.map((r) => ({ month: r.month, rateBps: r.rateBps }));
}
