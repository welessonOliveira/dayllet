// Categorização automática por regras aprendidas (Decisão 21). Puro, sem banco.
//
// Ideia: a descrição do banco vem suja ("UBER *TRIP 8731 SAO PAULO BR").
// 1) Normaliza: maiúsculas, sem acento, sem números e sem símbolos.
// 2) Tira palavras que não dizem nada ("COMPRA", "PIX", "CARTAO"...).
// 3) A "chave" é o começo do que sobra (até 2 palavras): "UBER TRIP".
// Quando o usuário escolhe uma categoria, guardamos chave -> categoria.
// Na próxima, a regra que casar com a descrição sugere a categoria.
import type { CategoryType } from "./constants";

const PALAVRAS_VAZIAS = new Set([
  "COMPRA", "COMPRAS", "CARTAO", "CREDITO", "DEBITO", "DEB", "CRED", "PAG", "PAGTO", "PAGAMENTO",
  "PIX", "TED", "DOC", "TEF", "TRANSF", "TRANSFERENCIA", "ENVIADO", "ENVIADA", "RECEBIDO", "RECEBIDA",
  "ELO", "VISA", "MASTER", "MASTERCARD", "INT", "NAC", "BR", "BRA", "SAO", "PAULO", "RIO", "DE", "DA", "DO",
  "DAS", "DOS", "E", "LTDA", "ME", "SA", "EIRELI", "COM", "WWW", "APLICACAO", "APP", "ONLINE", "PARC", "PARCELA",
  // Palavras que o PicPay e outros bancos põem antes/depois do nome ("Compra estornada - Uber", "Uber Brasil Tecnologia").
  "ESTORNADA", "ESTORNO", "REALIZADO", "REALIZADA", "BRASIL", "TECNOLOGIA", "SERVICOS", "INSTITUICAO", "PAGAMENTOS",
]);

/** "Uber *Trip 8731 São Paulo" -> "UBER TRIP SAO PAULO" (só letras, sem acento). */
export function normalizeDescription(desc: string): string {
  return desc
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras que identificam o estabelecimento (sem as vazias e sem letras soltas). */
export function significantTokens(desc: string): string[] {
  return normalizeDescription(desc)
    .split(" ")
    .filter((t) => t.length >= 2 && !PALAVRAS_VAZIAS.has(t));
}

/** Chave da regra que será aprendida: até as 2 primeiras palavras significativas. */
export function ruleKey(desc: string): string | null {
  const t = significantTokens(desc);
  return t.length === 0 ? null : t.slice(0, 2).join(" ");
}

export type CategoryRuleLike = {
  pattern: string;
  categoryId: string;
  categoryType: CategoryType;
  hits: number;
};

/** A regra casa se TODAS as palavras dela aparecem, em sequência, na descrição. */
export function ruleMatches(pattern: string, desc: string): boolean {
  const alvo = ` ${significantTokens(desc).join(" ")} `;
  return alvo.includes(` ${pattern} `);
}

/**
 * Sugere a categoria pra uma descrição. Só considera regras do mesmo tipo
 * (receita/despesa). Ganha a regra mais específica (mais palavras); empate = mais usada.
 */
export function suggestCategory(
  desc: string,
  type: CategoryType,
  rules: CategoryRuleLike[],
): { categoryId: string; pattern: string } | null {
  let melhor: CategoryRuleLike | null = null;
  for (const r of rules) {
    if (r.categoryType !== type || !ruleMatches(r.pattern, desc)) continue;
    const palavras = r.pattern.split(" ").length;
    const melhorPalavras = melhor ? melhor.pattern.split(" ").length : -1;
    if (!melhor || palavras > melhorPalavras || (palavras === melhorPalavras && r.hits > melhor.hits)) melhor = r;
  }
  return melhor ? { categoryId: melhor.categoryId, pattern: melhor.pattern } : null;
}

// ---------- Dicionário de estabelecimentos conhecidos ----------
// Vale quando o usuário ainda não ensinou nada pra aquela descrição (o que ele ensina sempre ganha).
// As palavras já estão no formato de `significantTokens` (maiúsculas, sem acento).
// A categoria é achada pelo NOME (padrão do app); se o usuário apagou/renomeou, a regra some.
export const BUILTIN_KEYWORDS: { category: string; type: CategoryType; patterns: string[] }[] = [
  {
    category: "Transporte",
    type: "EXPENSE",
    patterns: ["UBER", "CABIFY", "INDRIVE", "BUSER", "POSTO", "IPIRANGA", "SHELL", "PETROBRAS", "ESTACIONAMENTO", "PEDAGIO", "SEM PARAR", "VELOE", "CONECTCAR", "METRO", "ONIBUS"],
  },
  {
    category: "Alimentação",
    type: "EXPENSE",
    patterns: [
      "IFOOD", "RAPPI", "PADARIA", "PANIFICADORA", "SUPERMERCADO", "SUPERMERCADOS", "MERCADINHO", "ATACADAO", "ASSAI", "CARREFOUR",
      "PAO ACUCAR", "BAHAMAS", "BRETAS", "EMPORIO", "ACOUGUE", "HORTIFRUTI", "SACOLAO", "RESTAURANTE", "LANCHONETE", "PIZZARIA", "PASTEIS",
      "PASTELARIA", "SORVETERIA", "BURGER KING", "MCDONALDS", "MC DONALDS", "HABIBS", "SUBWAY", "BOBS", "OUTBACK", "STARBUCKS", "CACAU SHOW",
    ],
  },
  {
    category: "Saúde",
    type: "EXPENSE",
    patterns: ["FARMACIA", "DROGARIA", "DROGASIL", "RAIA", "PAGUE MENOS", "PACHECO", "HOSPITAL", "CLINICA", "LABORATORIO", "ODONTO", "UNIMED", "SMART FIT", "ACADEMIA"],
  },
  {
    category: "Lazer",
    type: "EXPENSE",
    patterns: [
      "NETFLIX", "SPOTIFY", "DISNEY", "PRIME VIDEO", "HBO", "YOUTUBE", "DEEZER", "GLOBOPLAY", "CRUNCHYROLL", "STEAM", "PLAYSTATION",
      "XBOX", "NINTENDO", "HOYOVERSE", "CINEMA", "CINEMARK", "INGRESSO", "SYMPLA", "TWITCH",
    ],
  },
  {
    category: "Moradia",
    type: "EXPENSE",
    patterns: ["ALUGUEL", "CONDOMINIO", "CEMIG", "COPASA", "DMAE", "SABESP", "ENEL", "CPFL", "ALGAR", "VIVO", "TELEFONICA", "CLARO", "TIM", "NET VIRTUA", "GAS"],
  },
  {
    category: "Educação",
    type: "EXPENSE",
    patterns: ["UDEMY", "ALURA", "ROCKETSEAT", "DIO", "SENAI", "SENAC", "ESCOLA", "FACULDADE", "UNIVERSIDADE", "LIVRARIA", "CURSO"],
  },
  { category: "Salário", type: "INCOME", patterns: ["SALARIO", "FOLHA", "PROVENTOS", "VENCIMENTOS"] },
];

/** Regras do dicionário pras categorias que o usuário tem (procuradas pelo nome, sem acento). */
export function builtinRules(categories: { id: string; name: string; type: CategoryType }[]): CategoryRuleLike[] {
  const porNome = new Map(categories.map((c) => [`${c.type}:${normalizeDescription(c.name)}`, c.id]));
  const out: CategoryRuleLike[] = [];
  for (const grupo of BUILTIN_KEYWORDS) {
    const categoryId = porNome.get(`${grupo.type}:${normalizeDescription(grupo.category)}`);
    if (!categoryId) continue;
    for (const pattern of grupo.patterns) out.push({ pattern, categoryId, categoryType: grupo.type, hits: 0 });
  }
  return out;
}

/** O que o usuário ensinou primeiro; se nada casar, o dicionário. */
export function suggestWithBuiltins(
  desc: string,
  type: CategoryType,
  learned: CategoryRuleLike[],
  builtins: CategoryRuleLike[],
): { categoryId: string; pattern: string } | null {
  return suggestCategory(desc, type, learned) ?? suggestCategory(desc, type, builtins);
}
