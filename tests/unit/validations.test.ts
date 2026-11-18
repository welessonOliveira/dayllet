import { describe, expect, it } from "vitest";
import {
  budgetSchema,
  categorySchema,
  fieldErrorsOf,
  parseTransactionFilters,
  toTransactionData,
  transactionSchema,
} from "@/lib/validations";

const valido = {
  description: "  Supermercado  ",
  amount: "1.234,56",
  type: "EXPENSE",
  status: "PENDING",
  date: "2026-11-18",
  categoryId: "cat-1",
  notes: "",
};

describe("validação de transação", () => {
  it("aceita e converte os dados do formulário", () => {
    const r = transactionSchema.safeParse(valido);
    expect(r.success).toBe(true);
    if (!r.success) return;
    const data = toTransactionData(r.data);
    expect(data).toEqual({
      description: "Supermercado",
      amountCents: 123456,
      type: "EXPENSE",
      status: "PENDING",
      date: new Date("2026-11-18T12:00:00.000Z"),
      categoryId: "cat-1",
      notes: null,
    });
  });

  it("status padrão é PAID", () => {
    const { status, ...semStatus } = valido;
    void status;
    const r = transactionSchema.parse(semStatus);
    expect(r.status).toBe("PAID");
  });

  it.each([
    ["description", "", "Informe a descrição."],
    ["amount", "0", "O valor precisa ser maior que zero."],
    ["amount", "abc", "Valor inválido. Use o formato 1.234,56."],
    ["date", "2026-02-30", "Data inválida."],
    ["categoryId", "", "Escolha uma categoria."],
  ])("rejeita %s = %j", (campo, valor, mensagem) => {
    const r = transactionSchema.safeParse({ ...valido, [campo]: valor });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(fieldErrorsOf(r.error)[campo]).toContain(mensagem);
  });

  it("rejeita tipo e status desconhecidos", () => {
    expect(transactionSchema.safeParse({ ...valido, type: "OUTRO" }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...valido, status: "OUTRO" }).success).toBe(false);
  });

  it("rejeita descrição longa demais", () => {
    const r = transactionSchema.safeParse({ ...valido, description: "a".repeat(121) });
    expect(r.success).toBe(false);
  });
});

describe("validação de categoria e orçamento", () => {
  it("categoria: cor vazia vira null e cor inválida é rejeitada", () => {
    expect(categorySchema.parse({ name: "Pets", type: "EXPENSE", color: "" }).color).toBeNull();
    expect(categorySchema.parse({ name: "Pets", type: "EXPENSE", color: "#AABBCC" }).color).toBe(
      "#aabbcc",
    );
    expect(categorySchema.safeParse({ name: "Pets", type: "EXPENSE", color: "azul" }).success).toBe(
      false,
    );
  });

  it("orçamento: mês no formato AAAA-MM e limite positivo", () => {
    expect(budgetSchema.parse({ categoryId: "c", month: "2026-11", limit: "800" }).limit).toBe(
      80000,
    );
    expect(budgetSchema.safeParse({ categoryId: "c", month: "2026-13", limit: "800" }).success).toBe(
      false,
    );
    expect(budgetSchema.safeParse({ categoryId: "c", month: "2026-11", limit: "0" }).success).toBe(
      false,
    );
  });
});

describe("filtros da URL", () => {
  const agora = new Date("2026-11-18T15:00:00.000Z");

  it("sem nada usa o mês atual", () => {
    expect(parseTransactionFilters({}, agora)).toEqual({
      month: "2026-11",
      type: undefined,
      categoryId: undefined,
      q: undefined,
    });
  });

  it("lê os filtros e ignora os inválidos", () => {
    expect(
      parseTransactionFilters(
        { month: "2026-09", type: "INCOME", categoryId: "c1", q: " mercado " },
        agora,
      ),
    ).toEqual({ month: "2026-09", type: "INCOME", categoryId: "c1", q: "mercado" });
    expect(parseTransactionFilters({ month: "xx", type: "ABC" }, agora)).toMatchObject({
      month: "2026-11",
      type: undefined,
    });
  });
});
