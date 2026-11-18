# Contrato entre a base (Claude) e as telas (Gemini)

Este arquivo lista tudo que as telas podem usar. **Não edite** `src/lib/`, `src/server/` nem as actions. Se faltar alguma coisa, peça em `docs/RECADOS.md`.

## Como usar

- **Leitura** (Server Components, em `page.tsx`): importe `prisma` de `@/server/db` e chame as funções de `src/server/*` passando ele como 1º argumento.
- **Escrita** (Client Components com React Hook Form): chame as Server Actions de `@/server/actions/*` passando os **valores do formulário** (strings). Elas validam de novo no servidor.
- **Formulários:** use os schemas de `@/lib/validations` com `zodResolver`. Os schemas transformam os dados (ex.: `"1.234,56"` → `123456`), então o `useForm` tem tipo de entrada e de saída diferentes:

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, type TransactionFormValues, type TransactionFormOutput } from "@/lib/validations";
import { createTransactionAction } from "@/server/actions/transactions";
import { todayInput } from "@/lib/dates";

// 3 genéricos: <entrada do form, contexto, saída do zod>. Sem eles o TS reclama.
const form = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
  resolver: zodResolver(transactionSchema),
  defaultValues: { description: "", amount: "", type: "EXPENSE", status: "PAID", date: todayInput(), categoryId: "", notes: "" },
});

async function onSubmit() {
  // Mande os valores CRUS do form (getValues), não os transformados.
  const result = await createTransactionAction(form.getValues());
  if (result.ok) {/* mostrar result.message */}
  else {/* mostrar result.error e, se tiver, result.fieldErrors[campo] */}
}
// <form onSubmit={form.handleSubmit(onSubmit)}>
```

> Importante: o `handleSubmit` entrega os dados já transformados (centavos, `Date`). A action espera os valores do formulário (strings), por isso use `form.getValues()`.

- **Páginas que leem o banco** sem usar `searchParams`: deixe `export const dynamic = "force-dynamic";` (senão o Next gera a página no build e ela fica parada).
- **`searchParams` é `Promise`** no Next 15: `const filters = parseTransactionFilters(await searchParams);`.

## Retorno das actions: `ActionResult<T>` (`@/lib/errors`)

```ts
type ActionResult<T> =
  | { ok: true; data: T; message: string }            // message pronta pra toast, em PT-BR
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

- `error` sempre é uma mensagem amigável em PT-BR (nunca stack trace).
- `fieldErrors` vem quando a validação falha; a chave é o nome do campo (`amount`, `date`...).
- Depois de sucesso as actions já fazem `revalidatePath`, as páginas atualizam sozinhas.

---

## Helpers (`src/lib`)

### `@/lib/money`
| Função | Entrada | Saída | Pra quê |
|---|---|---|---|
| `formatBRL(cents)` | `number` | `string` | `123456` → `"R$ 1.234,56"` |
| `parseBRLToCents(texto)` | `string` | `number \| null` | `"1.234,56"` → `123456`; inválido → `null` |
| `centsToInput(cents)` | `number` | `string` | Preencher input de edição: `123456` → `"1.234,56"` |

### `@/lib/dates` (tudo no fuso `America/Sao_Paulo`)
| Função | Entrada | Saída | Pra quê |
|---|---|---|---|
| `currentMonth(now?)` | `Date?` | `"YYYY-MM"` | Mês atual |
| `shiftMonth(mes, delta)` | `string, number` | `"YYYY-MM"` | Botões mês anterior/próximo |
| `formatMonthLabel(mes)` | `"YYYY-MM"` | `string` | `"novembro de 2026"` |
| `formatDate(date)` | `Date` | `string` | `"18/11/2026"` |
| `toDateInput(date)` | `Date` | `"YYYY-MM-DD"` | Preencher `<input type="date">` na edição |
| `todayInput(now?)` | `Date?` | `"YYYY-MM-DD"` | Valor padrão do campo data |
| `isValidMonth(s)` | `string` | `boolean` | |
| `monthOf(date)` | `Date` | `"YYYY-MM"` | |

### `@/lib/constants`
- `CATEGORY_TYPES = ["INCOME", "EXPENSE"]`, tipo `CategoryType`.
- `TRANSACTION_STATUSES = ["PAID", "PENDING"]`, tipo `TransactionStatus`.
- `CATEGORY_TYPE_LABEL`: `{ INCOME: "Receita", EXPENSE: "Despesa" }`.
- `statusLabel(type, status)`: despesa → "Pago"/"Pendente"; receita → "Recebido"/"A receber".

### `@/lib/validations` (schemas Zod)
| Schema | Campos do formulário (entrada, tudo string) | Tipo da entrada | Tipo da saída (3º genérico do `useForm`) |
|---|---|---|---|
| `transactionSchema` | `description`, `amount` ("1.234,56"), `type` ("INCOME"/"EXPENSE"), `status?` ("PAID"/"PENDING", padrão PAID), `date` ("YYYY-MM-DD"), `categoryId`, `notes?` | `TransactionFormValues` | `TransactionFormOutput` |
| `categorySchema` | `name`, `type`, `color?` ("#rrggbb" ou vazio) | `CategoryFormValues` | `CategoryFormOutput` |
| `budgetSchema` | `categoryId`, `month` ("YYYY-MM"), `limit` ("800,00") | `BudgetFormValues` | `BudgetFormOutput` |

- `parseTransactionFilters(searchParams)` → `TransactionFilters` `{ month: string; type?: CategoryType; categoryId?: string; q?: string }`. Lê `?month=2026-11&type=EXPENSE&categoryId=...&q=texto`. Sem mês, usa o atual. Valores inválidos são ignorados.

### Tipos úteis de `@/lib/rules`
- `MonthSummary`: `{ incomeCents, expenseCents, balanceCents, pendingExpenseCents, pendingIncomeCents, count }`. Receitas/despesas/saldo contam só o que está **pago**. `count` conta todas.
- `BudgetProgress`: `{ limitCents, spentCents, remainingCents, percentUsed, percentBar, isOver }`. `remainingCents` fica negativo quando estoura; `percentUsed` pode passar de 100; `percentBar` vai até 100 (largura da barra); `isOver` = pintar de vermelho.
- `CategoryTotal`: `{ categoryId, name, color, totalCents, percent }` (pro gráfico).

---

## Leitura (`src/server`, Server Components)

Todas recebem `prisma` (de `@/server/db`) como 1º argumento. Os tipos `Category`, `Transaction` e `Budget` são os do `@prisma/client` (`date`, `createdAt` etc. são `Date`; valores em centavos).

| Função | Arquivo | Entrada | Saída |
|---|---|---|---|
| `getDashboardData(db, month)` | `@/server/dashboard` | `month: "YYYY-MM"` | `DashboardData` (abaixo) |
| `listTransactions(db, filters)` | `@/server/transactions` | `TransactionFilters` | `TransactionWithCategory[]` (mais recente primeiro) |
| `getTransaction(db, id)` | `@/server/transactions` | `id: string` | `TransactionWithCategory \| null` |
| `listCategories(db, type?)` | `@/server/categories` | `type?: CategoryType` | `Category[]` (A-Z). Use pra montar o select de categoria filtrando pelo tipo escolhido. |
| `listCategoriesGrouped(db)` | `@/server/categories` | — | `{ income: CategoryWithCounts[]; expense: CategoryWithCounts[] }` |
| `getCategory(db, id)` | `@/server/categories` | `id` | `Category \| null` |
| `listBudgetsWithProgress(db, month)` | `@/server/budgets` | `month: "YYYY-MM"` | `BudgetWithProgress[]` (A-Z pela categoria) |
| `getBudget(db, id)` | `@/server/budgets` | `id` | `(Budget & { category: Category }) \| null` |

Tipos:
```ts
type TransactionWithCategory = Transaction & { category: Category };
type CategoryWithCounts = Category & { transactionCount: number; budgetCount: number };
type BudgetWithProgress = Budget & { category: Category; progress: BudgetProgress };
type DashboardData = {
  month: string;
  summary: MonthSummary;                       // cards de saldo, receitas, despesas, "A pagar", quantidade
  topExpenses: TransactionWithCategory[];      // 5 maiores despesas (pagas e pendentes)
  budgets: BudgetWithProgress[];               // progresso dos orçamentos do mês
  expensesByCategory: CategoryTotal[];         // gráfico (SVG/CSS puro, sem lib)
};
```

Dicas de tela:
- Na confirmação de exclusão de categoria: se `transactionCount > 0`, avise que não dá pra excluir (o servidor bloqueia de qualquer jeito). Se `budgetCount > 0`, avise que **os orçamentos dela serão apagados junto**.
- No formulário de transação, o select de categoria mostra só as do tipo escolhido.
- Orçamento só aceita categoria de despesa: use `listCategories(prisma, "EXPENSE")`.

---

## Escrita (Server Actions, Client Components)

Arquivos com `"use server"`. Todas retornam `Promise<ActionResult<...>>`.

### `@/server/actions/transactions`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createTransactionAction(input)` | `TransactionFormValues` | `Transaction` | "Transação criada." |
| `updateTransactionAction(id, input)` | `string, TransactionFormValues` | `Transaction` | "Transação atualizada." |
| `setTransactionStatusAction(id, status)` | `string, "PAID" \| "PENDING"` | `Transaction` | "Status atualizado." |
| `deleteTransactionAction(id)` | `string` | `null` | "Transação excluída." |

Erros possíveis: campos inválidos, "Categoria não encontrada.", "Receita só pode usar uma categoria de receita.", "Despesa só pode usar uma categoria de despesa.", "Transação não encontrada."

### `@/server/actions/categories`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createCategoryAction(input)` | `CategoryFormValues` | `Category` | "Categoria criada." |
| `updateCategoryAction(id, input)` | `string, CategoryFormValues` | `Category` | "Categoria atualizada." |
| `deleteCategoryAction(id)` | `string` | `{ deletedBudgets: number }` | "Categoria excluída." |

Erros possíveis: "Já existe uma categoria com esse nome.", "Essa categoria tem N transações e não pode ser excluída. ...", "Não dá pra trocar o tipo de uma categoria que já tem transações." (ou "que tem orçamentos."), "Categoria não encontrada."

### `@/server/actions/budgets`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createBudgetAction(input)` | `BudgetFormValues` | `Budget` | "Orçamento criado." |
| `updateBudgetAction(id, input)` | `string, BudgetFormValues` | `Budget` | "Orçamento atualizado." |
| `deleteBudgetAction(id)` | `string` | `null` | "Orçamento excluído." |

Erros possíveis: "Já existe um orçamento dessa categoria nesse mês.", "Orçamento só pode ser criado para uma categoria de despesa.", "Orçamento não encontrado."

---

## Rotas

| Rota | Tela |
|---|---|
| `/` | Dashboard |
| `/transacoes` | Transações (filtros via `?month=&type=&categoryId=&q=`) |
| `/categorias` | Categorias |
| `/orcamentos` | Orçamentos (sugestão: `?month=` igual às transações) |

O menu atual fica em `src/components/MainNav.tsx` e as páginas são **placeholders**: pode substituir à vontade.
