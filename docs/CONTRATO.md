# Contrato entre a base (Claude) e as telas (Gemini)

Este arquivo lista tudo que as telas podem usar. **Não edite** `src/lib/`, `src/server/` nem as actions. Se faltar alguma coisa, peça em `docs/RECADOS.md`.

> **v2 (2026-11-18): o app agora é multiusuário, com login.** O que mudou pras telas:
> - Toda função de leitura recebe o **contexto `ctx`**, não mais o `prisma`. Pegue com `const ctx = await getPageCtx()`.
> - Entrou o conceito de **Conta** (`Wallet`): corrente, poupança ou carteira, com saldo. Toda transação é de uma conta.
> - Telas novas: `/login` e `/contas`.

## Como usar

- **Leitura** (Server Components, em `page.tsx`): no começo da página faça `const ctx = await getPageCtx();` (de `@/server/session`) e passe `ctx` como 1º argumento das funções de `src/server/*`. Se não tiver ninguém logado, o `getPageCtx` já manda pro `/login`. **Nunca** use o `prisma` direto numa página.
- **Login:** o middleware já manda quem não tem sessão pro `/login`. A página de login fica fora disso.
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
  defaultValues: { description: "", amount: "", type: "EXPENSE", status: "PAID", date: todayInput(), categoryId: "", walletId: "", notes: "" },
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
- Se a sessão expirou, toda action devolve `{ ok: false, error: "Sua sessão expirou. Entre de novo pra continuar." }`. Dá pra mostrar o erro e mandar pro `/login`.
- Depois de sucesso as actions já fazem `revalidatePath`, as páginas atualizam sozinhas.

---

## Helpers (`src/lib`)

### `@/lib/money`
| Função | Entrada | Saída | Pra quê |
|---|---|---|---|
| `formatBRL(cents)` | `number` | `string` | `123456` → `"R$ 1.234,56"` |
| `parseBRLToCents(texto)` | `string` | `number \| null` | `"1.234,56"` → `123456`; inválido → `null` |
| `centsToInput(cents)` | `number` | `string` | Preencher input de edição: `123456` → `"1.234,56"` (negativo: `"-200,00"`) |
| `parseSignedBRLToCents(texto)` | `string` | `number \| null` | Igual ao `parseBRLToCents`, mas aceita `-` (saldo inicial) |

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
- `WALLET_KINDS = ["CHECKING", "SAVINGS", "WALLET"]`, tipo `WalletKind`. `WALLET_KIND_LABEL`: `{ CHECKING: "Conta corrente", SAVINGS: "Poupança", WALLET: "Carteira" }`.

### `@/lib/validations` (schemas Zod)
| Schema | Campos do formulário (entrada, tudo string) | Tipo da entrada | Tipo da saída (3º genérico do `useForm`) |
|---|---|---|---|
| `transactionSchema` | `description`, `amount` ("1.234,56"), `type` ("INCOME"/"EXPENSE"), `status?` ("PAID"/"PENDING", padrão PAID), `date` ("YYYY-MM-DD"), `categoryId`, `walletId?` (vazio = conta padrão), `notes?` | `TransactionFormValues` | `TransactionFormOutput` |
| `walletSchema` | `name`, `kind?` ("CHECKING"/"SAVINGS"/"WALLET", padrão CHECKING), `openingBalance?` ("1.500,00", "-200" ou vazio = 0) | `WalletFormValues` | `WalletFormOutput` |
| `categorySchema` | `name`, `type`, `color?` ("#rrggbb" ou vazio) | `CategoryFormValues` | `CategoryFormOutput` |
| `budgetSchema` | `categoryId`, `month` ("YYYY-MM"), `limit` ("800,00") | `BudgetFormValues` | `BudgetFormOutput` |

- `parseTransactionFilters(searchParams)` → `TransactionFilters` `{ month: string; type?: CategoryType; categoryId?: string; walletId?: string; q?: string }`. Lê `?month=2026-11&type=EXPENSE&categoryId=...&walletId=...&q=texto`. Sem mês, usa o atual. Valores inválidos são ignorados.

### Tipos úteis de `@/lib/rules`
- `MonthSummary`: `{ incomeCents, expenseCents, balanceCents, pendingExpenseCents, pendingIncomeCents, count }`. Receitas/despesas/saldo contam só o que está **pago**. `count` conta todas.
- `BudgetProgress`: `{ limitCents, spentCents, remainingCents, percentUsed, percentBar, isOver }`. `remainingCents` fica negativo quando estoura; `percentUsed` pode passar de 100; `percentBar` vai até 100 (largura da barra); `isOver` = pintar de vermelho.
- `CategoryTotal`: `{ categoryId, name, color, totalCents, percent }` (pro gráfico).
- `WalletBalance`: `{ currentCents, projectedCents }`. `currentCents` é o saldo de hoje (saldo inicial + recebido − pago). `projectedCents` é como fica se tudo que está pendente for pago ou recebido.

---

## Leitura (`src/server`, Server Components)

Todas recebem `ctx` (de `await getPageCtx()`) como 1º argumento e só enxergam os dados do usuário logado. Os tipos `Category`, `Transaction` e `Budget` são os do `@prisma/client` (`date`, `createdAt` etc. são `Date`; valores em centavos).

| Função | Arquivo | Entrada | Saída |
|---|---|---|---|
| `getDashboardData(ctx, month)` | `@/server/dashboard` | `month: "YYYY-MM"` | `DashboardData` (abaixo) |
| `listTransactions(ctx, filters)` | `@/server/transactions` | `TransactionFilters` | `TransactionWithCategory[]` (mais recente primeiro) |
| `getTransaction(ctx, id)` | `@/server/transactions` | `id: string` | `TransactionWithCategory \| null` |
| `listCategories(ctx, type?)` | `@/server/categories` | `type?: CategoryType` | `Category[]` (A-Z). Use pra montar o select de categoria filtrando pelo tipo escolhido. |
| `listCategoriesGrouped(ctx)` | `@/server/categories` | — | `{ income: CategoryWithCounts[]; expense: CategoryWithCounts[] }` |
| `getCategory(ctx, id)` | `@/server/categories` | `id` | `Category \| null` |
| `listBudgetsWithProgress(ctx, month)` | `@/server/budgets` | `month: "YYYY-MM"` | `BudgetWithProgress[]` (A-Z pela categoria) |
| `getBudget(ctx, id)` | `@/server/budgets` | `id` | `(Budget & { category: Category }) \| null` |
| `listWallets(ctx)` | `@/server/wallets` | — | `Wallet[]` (padrão primeiro, depois A-Z). Pro select de conta. |
| `listWalletsWithBalance(ctx)` | `@/server/wallets` | — | `WalletWithBalance[]` |
| `getSessionUser()` | `@/server/session` | — | `{ id, name, email, isDemo } \| null` (menu do usuário, selo "demo") |
| `githubEnabled` | `@/server/auth` | — | `boolean`: mostrar ou não o botão "Entrar com GitHub" |

Tipos:
```ts
type TransactionWithCategory = Transaction & { category: Category; wallet: Wallet };
type WalletWithBalance = Wallet & { balance: WalletBalance; transactionCount: number };
// Wallet: { id, name, kind, openingBalanceCents, isDefault, ... }
type CategoryWithCounts = Category & { transactionCount: number; budgetCount: number };
type BudgetWithProgress = Budget & { category: Category; progress: BudgetProgress };
type DashboardData = {
  month: string;
  summary: MonthSummary;                       // cards de saldo, receitas, despesas, "A pagar", quantidade
  topExpenses: TransactionWithCategory[];      // 5 maiores despesas (pagas e pendentes)
  budgets: BudgetWithProgress[];               // progresso dos orçamentos do mês
  expensesByCategory: CategoryTotal[];         // gráfico (SVG/CSS puro, sem lib)
  wallets: WalletWithBalance[];                // contas com saldo atual e previsto
  totalBalanceCents: number;                   // soma do saldo atual de todas as contas
};
```

Dicas de tela:
- Na confirmação de exclusão de categoria: se `transactionCount > 0`, avise que não dá pra excluir (o servidor bloqueia de qualquer jeito). Se `budgetCount > 0`, avise que **os orçamentos dela serão apagados junto**.
- No formulário de transação, o select de categoria mostra só as do tipo escolhido.
- Orçamento só aceita categoria de despesa: use `listCategories(ctx, "EXPENSE")`.
- **Saldo do mês** (`summary.balanceCents`) é o resultado do mês (recebido − pago no mês). **Saldo total** (`totalBalanceCents`) é quanto dinheiro tem nas contas hoje. São coisas diferentes, então mostre os dois com nomes claros.
- Na exclusão de conta: se `transactionCount > 0`, avise que não dá. A última conta também não pode ser excluída.

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

Erros possíveis: "Você já tem uma categoria com esse nome.", "Essa categoria tem N transações e não pode ser excluída. ...", "Não dá pra trocar o tipo de uma categoria que já tem transações." (ou "que tem orçamentos."), "Categoria não encontrada."

### `@/server/actions/wallets`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createWalletAction(input)` | `WalletFormValues` | `Wallet` | "Conta criada." |
| `updateWalletAction(id, input)` | `string, WalletFormValues` | `Wallet` | "Conta atualizada." |
| `setDefaultWalletAction(id)` | `string` | `null` | "Conta padrão alterada." |
| `deleteWalletAction(id)` | `string` | `null` | "Conta excluída." |

Erros possíveis: "Você já tem uma conta com esse nome.", "Essa conta tem N lançamentos e não pode ser excluída. ...", "Você precisa ter pelo menos uma conta.", "Conta não encontrada."

### `@/server/actions/auth` (use em `<form action={...}>`)
| Action | O que faz |
|---|---|
| `signInDemoAction()` | Entra na conta demo e vai pro `/` |
| `signInGithubAction()` | Entra com GitHub (só mostre se `githubEnabled`) |
| `signOutAction()` | Sai e volta pro `/login` |

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
| `/login` | Login: "Entrar como visitante (demo)" e "Entrar com GitHub" (se `githubEnabled`). Hoje é **placeholder**. |
| `/transacoes` | Transações (filtros via `?month=&type=&categoryId=&walletId=&q=`) |
| `/contas` | Contas (**nova**, ainda não existe): lista com saldo, criar, editar, excluir e tornar padrão |
| `/categorias` | Categorias |
| `/orcamentos` | Orçamentos (sugestão: `?month=` igual às transações) |

O menu atual fica em `src/components/MainNav.tsx` e as páginas são **placeholders**: pode substituir à vontade.
