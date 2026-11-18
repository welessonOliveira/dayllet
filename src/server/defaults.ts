// Dados que todo usuário novo ganha: categorias padrão e uma conta.
import type { CategoryType } from "@/lib/constants";
import type { Db } from "./db";

export const DEFAULT_CATEGORIES: { key: string; name: string; type: CategoryType; color: string }[] = [
  { key: "salario", name: "Salário", type: "INCOME", color: "#16a34a" },
  { key: "freelance", name: "Freelance", type: "INCOME", color: "#0d9488" },
  { key: "moradia", name: "Moradia", type: "EXPENSE", color: "#7c3aed" },
  { key: "alimentacao", name: "Alimentação", type: "EXPENSE", color: "#ea580c" },
  { key: "transporte", name: "Transporte", type: "EXPENSE", color: "#2563eb" },
  { key: "saude", name: "Saúde", type: "EXPENSE", color: "#dc2626" },
  { key: "lazer", name: "Lazer", type: "EXPENSE", color: "#db2777" },
  { key: "educacao", name: "Educação", type: "EXPENSE", color: "#ca8a04" },
  { key: "outros", name: "Outros", type: "EXPENSE", color: "#64748b" },
];

export const DEFAULT_WALLET_NAME = "Conta principal";

/**
 * Prepara um usuário recém-criado (categorias padrão + conta padrão).
 * Idempotente: pode chamar de novo sem duplicar nada.
 */
export async function setupNewUser(db: Db, userId: string): Promise<void> {
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map(({ name, type, color }) => ({ userId, name, type, color })),
    skipDuplicates: true,
  });
  await ensureDefaultWallet(db, userId);
}

/** Garante que o usuário tem uma conta padrão e devolve o id dela. */
export async function ensureDefaultWallet(db: Db, userId: string): Promise<string> {
  const padrao = await db.wallet.findFirst({ where: { userId, isDefault: true } });
  if (padrao) return padrao.id;

  // Sem padrão: usa a mais antiga, ou cria uma.
  const primeira = await db.wallet.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (primeira) {
    await db.wallet.update({ where: { id: primeira.id }, data: { isDefault: true } });
    return primeira.id;
  }
  const nova = await db.wallet.create({
    data: { userId, name: DEFAULT_WALLET_NAME, kind: "CHECKING", isDefault: true },
  });
  return nova.id;
}
