# Contrato entre a base (Claude) e as telas (Gemini)

Este arquivo lista tudo que as telas podem usar. **Não edite** `src/lib/`, `src/server/` nem as actions. Se faltar alguma coisa, peça em `docs/RECADOS.md`.

> **v2 (2026-11-18): o app agora é multiusuário, com login.** O que mudou pras telas:
> - Toda função de leitura recebe o **contexto `ctx`**, não mais o `prisma`. Pegue com `const ctx = await getPageCtx()`.
> - Entrou o conceito de **Conta** (`Wallet`): corrente, poupança ou carteira, com saldo. Toda transação é de uma conta.
> - Telas novas: `/login` e `/contas`.
> - **Etapas 6 e 7 (metas + relatórios):** telas novas `/metas` e `/relatorios`. Exportar CSV é um link (`/api/export/transacoes?...`), e o relatório de inflação usa o IPCA real do Banco Central.
> - **Etapas 4 e 5 (importação + categorização automática):** tela nova `/importar` (upload → revisão → confirmar). As categorias escolhidas viram regras, e a regra sugere a categoria na próxima importação e no formulário de transação (`suggestCategoryAction`).
> - **Etapa 3 (projeção):** `getMonthForecast`, `getCashflow` e `getBalanceProjection` em `@/server/forecast`: "vai sobrar R$ X no fim do mês", previsto vs. realizado e saldo dos próximos meses.
> - **Etapa 2 (contas fixas e parcelados):** tela nova `/recorrentes`. As ocorrências viram transações normais automaticamente (com `recurringRuleId`, e no parcelado `installmentNo`/`installmentOf`), então aparecem sozinhas na lista, no dashboard e nos orçamentos.

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
| `recurringRuleSchema` | `kind` ("FIXED" = conta fixa, "INSTALLMENT" = parcelado), `description`, `type`, `amount` (fixa: valor de cada vez; parcelado: **valor total**), `categoryId`, `walletId?`, `frequency?` (só fixa: "WEEKLY"/"MONTHLY"/"YEARLY", padrão MONTHLY), `startDate` ("YYYY-MM-DD", 1ª vez/1ª parcela), `endDate?` (só fixa, vazio = sem fim), `installments?` (só parcelado, "2" a "120"), `notes?` | `RecurringRuleFormValues` | `RecurringRuleFormOutput` |
| `goalSchema` | `name`, `target` ("4.000,00"), `targetDate?` ("YYYY-MM-DD" ou vazio = sem prazo), `color?` | `GoalFormValues` | `GoalFormOutput` |
| `goalContributionSchema` | `kind?` ("DEPOSIT" = guardar, "WITHDRAW" = retirar; padrão DEPOSIT), `amount`, `date` ("YYYY-MM-DD"), `note?` | `GoalContributionFormValues` | `GoalContributionFormOutput` |
| `transferSchema` | `fromWalletId`, `toWalletId` (diferente da origem), `amount`, `date` ("YYYY-MM-DD"), `note?` | `TransferFormValues` | `TransferFormOutput` |
| `walletSchema` | `name`, `kind?` ("CHECKING"/"SAVINGS"/"WALLET", padrão CHECKING), `openingBalance?` ("1.500,00", "-200" ou vazio = 0) | `WalletFormValues` | `WalletFormOutput` |
| `categorySchema` | `name`, `type`, `color?` ("#rrggbb" ou vazio) | `CategoryFormValues` | `CategoryFormOutput` |
| `budgetSchema` | `categoryId`, `month` ("YYYY-MM"), `limit` ("800,00") | `BudgetFormValues` | `BudgetFormOutput` |

- `parseTransactionFilters(searchParams)` → `TransactionFilters` `{ month: string; type?: CategoryType; categoryId?: string; walletId?: string; q?: string }`. Lê `?month=2026-11&type=EXPENSE&categoryId=...&walletId=...&q=texto`. Sem mês, usa o atual. Valores inválidos são ignorados.

### `@/lib/recurrence`
- `FREQUENCIES = ["WEEKLY", "MONTHLY", "YEARLY"]`, tipo `Frequency`. `FREQUENCY_LABEL`: `{ WEEKLY: "Toda semana", MONTHLY: "Todo mês", YEARLY: "Todo ano" }`.
- `splitInstallments(totalCents, n)` → `number[]`: prévia das parcelas no formulário (a última leva o resto: 10000 em 3 = 3333, 3333, 3334).

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
| `getMonthForecast(ctx, month)` | `@/server/forecast` | `"YYYY-MM"` | `MonthForecast` (projeção do mês; passado = realizado) |
| `getCashflow(ctx, { back?, ahead? })` | `@/server/forecast` | meses pra trás (padrão 5, máx 24) e pra frente (padrão 3, máx 12) | `MonthCashflow[]` (previsto vs. realizado, em ordem) |
| `getBalanceProjection(ctx, months?)` | `@/server/forecast` | quantos meses a partir do atual (padrão 6, máx 24) | `{ month, balanceCents }[]` (saldo projetado no fim de cada mês) |
| `listRecurringRules(ctx)` | `@/server/recurring` | — | `RecurringRuleView[]` (ativas primeiro, depois A-Z) |
| `getRecurringRule(ctx, id)` | `@/server/recurring` | `id` | `(RecurringRule & { category; wallet }) \| null` |
| `listGoals(ctx, { includeArchived? })` | `@/server/goals` | — | `GoalWithProgress[]` (não concluídas primeiro, depois por prazo) |
| `getGoal(ctx, id)` | `@/server/goals` | `id` | `Goal & { contributions: GoalContribution[]; progress: GoalProgress } \| null` (histórico mais recente primeiro) |
| `getInflationReport(ctx, months?)` | `@/server/reports` | meses (padrão 12, máx 36) | `InflationReport` |
| `listImports(ctx)` | `@/server/imports` | — | últimas 30 importações: `ImportBatch & { wallet, rowCount, importedCount }` (em revisão primeiro) |
| `getImport(ctx, id)` | `@/server/imports` | `id` | `ImportView \| null` (linhas em ordem + resumo) |
| `listCategoryRules(ctx)` | `@/server/categoryRules` | — | `(CategoryRule & { category })[]` (mais usadas primeiro): tela "Regras aprendidas" |
| `listTransfers(ctx, month?)` | `@/server/transfers` | `"YYYY-MM"` opcional | `(Transfer & { fromWallet; toWallet })[]` (mais recente primeiro) |
| `listWallets(ctx)` | `@/server/wallets` | — | `Wallet[]` (padrão primeiro, depois A-Z). Pro select de conta. |
| `listWalletsWithBalance(ctx)` | `@/server/wallets` | — | `WalletWithBalance[]` |
| `getSessionUser()` | `@/server/session` | — | `{ id, name, email, isDemo } \| null` (menu do usuário, selo "demo") |
| `githubEnabled` | `@/server/auth` | — | `boolean`: mostrar ou não o botão "Entrar com GitHub" |

Tipos:
```ts
type TransactionWithCategory = Transaction & { category: Category; wallet: Wallet };
type WalletWithBalance = Wallet & { balance: WalletBalance; transactionCount: number };
type GoalProgress = {
  targetCents; savedCents; remainingCents;   // number
  percent: number;      // pode passar de 100
  percentBar: number;   // até 100 (barra)
  done: boolean;        // bateu a meta
  monthsLeft: number | null;          // meses até o prazo (null = sem prazo; 0 = passou)
  monthlyNeededCents: number | null;  // "guarde R$ X por mês pra chegar lá"
  overdue: boolean;     // prazo passou e não bateu
};
type GoalWithProgress = Goal & { progress: GoalProgress; contributionCount: number };
// Goal: { id, name, targetCents, targetDate, color, archived }  GoalContribution: { id, amountCents (+ guardou, − tirou), date, note }
type InflationReport = {
  lastIpcaMonth: string | null;   // último IPCA publicado (null = sem dados: mostre "IPCA indisponível no momento")
  rows: { month; expenseCents; adjustedCents; inflationBps }[];  // gasto do mês, o mesmo gasto em dinheiro de hoje, inflação acumulada (bps: 123 = 1,23%)
};
type ImportSummary = { total; toImport; duplicates; possibleDuplicates; withoutCategory };  // todos number
type ImportView = ImportBatch & {
  wallet: Wallet;
  // ImportBatch: { id, fileName, format: "OFX"|"CSV", status: "REVIEW"|"COMMITTED"|"DISCARDED", createdAt, committedAt }
  rows: (ImportRow & { category: Category | null })[];
  // ImportRow: { id, date, amountCents (sempre +), type, description, categoryId, suggestedCategoryId,
  //              duplicateOfId (já importado = certeza), possibleDuplicate (parecido com manual), decision: "IMPORT"|"SKIP" }
  summary: ImportSummary;
};
// CategoryRule: { id, pattern (ex.: "UBER TRIP"), categoryId, hits }
type BalancePoint = { date: Date; balanceCents: number };
type MonthForecast = {
  month: string;
  mode: "past" | "current" | "future";     // passado = só realizado
  currentBalanceCents: number;             // saldo total das contas hoje
  endOfMonthBalanceCents: number;          // "vai terminar o mês com R$ X" (negativo = vai faltar)
  pendingIncomeCents: number;              // a receber no mês (no atual, inclui atrasados)
  pendingExpenseCents: number;             // a pagar no mês (no atual, inclui atrasados)
  overdueExpenseCents: number;             // contas atrasadas (pendentes com data antes de hoje)
  daily: BalancePoint[];                   // saldo no fim de cada dia (gráfico de linha). No mês atual começa HOJE.
  lowest: BalancePoint | null;             // dia em que o saldo fica mais baixo (se < 0, avisar!)
};
type MonthCashflow = {
  month: string;
  plannedIncomeCents: number; plannedExpenseCents: number;    // previsto = pago + pendente
  realizedIncomeCents: number; realizedExpenseCents: number;  // realizado = só pago
  plannedNetCents: number; realizedNetCents: number;          // receitas - despesas
};
type RecurringRuleView = RecurringRule & {
  category: Category; wallet: Wallet;
  scheduleLabel: string;            // "Todo mês, dia 10" | "Parcelado em 12x" | "Toda semana"
  nextDate: Date | null;            // próxima ocorrência a partir de hoje (null = pausada ou acabou)
  nextAmountCents: number | null;   // valor dela (parcela ou valor fixo)
  paidInstallments: number | null;  // parcelado: quantas já estão pagas (mostre "3 de 12 pagas")
  finished: boolean;                // não tem mais ocorrências
};
// RecurringRule: { id, description, type, amountCents (fixa: cada vez | parcelado: TOTAL), frequency, startDate, endDate, installments, active, notes, ... }
// Transaction ganhou: recurringRuleId (string | null), installmentNo e installmentOf (number | null)
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
- **Lançamento que veio de regra** (`recurringRuleId` preenchido): mostre um selo "Fixa" ou "Parcela 3/12" (`installmentNo`/`installmentOf`). Ao excluir, avise: "Só essa ocorrência some. Pra parar as próximas, pause ou exclua a conta fixa em Recorrentes." Editar o lançamento mexe só nele.
- **Regras novas geram lançamentos na hora**: o que é antes do dia de hoje entra como pago (histórico), e de hoje em diante entra como pendente.
- **Projeção:** destaque `endOfMonthBalanceCents` ("Previsão pro fim do mês"). Se `lowest.balanceCents < 0`, mostre um alerta: "Seu saldo fica negativo em DD/MM". Se `overdueExpenseCents > 0`, alerta de contas atrasadas. Gráficos sempre em SVG puro (Decisão 10).
- **Previsto vs. realizado:** barras lado a lado por mês (previsto mais claro, realizado sólido), separando receitas e despesas. Meses futuros só têm previsto.
- No formulário de parcelado, mostre a prévia das parcelas com `splitInstallments` (ex.: "12x de R$ 200,00").

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

### `@/server/actions/recurring`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createRecurringRuleAction(input)` | `RecurringRuleFormValues` | `RecurringRule` | "Conta fixa criada." / "Parcelamento criado." |
| `updateRecurringRuleAction(id, input)` | `string, RecurringRuleFormValues` | `RecurringRule` | "Atualizado. As mudanças valem daqui pra frente." |
| `setRecurringRuleActiveAction(id, active)` | `string, boolean` | `RecurringRule` | "Pausado." / "Retomado." |
| `deleteRecurringRuleAction(id)` | `string` | `{ deletedFuture: number }` | "Excluído. O histórico foi mantido." |

Regras: editar e pausar valem **só pra frente** (o que já passou ou foi pago não muda). Pausar apaga as ocorrências futuras pendentes. Excluir mantém o histórico e apaga só as futuras pendentes.
Erros possíveis: campos inválidos, "Informe de 2 a 120 parcelas.", "O fim precisa ser depois do começo.", "Categoria não encontrada.", "Despesa só pode usar uma categoria de despesa.", "Conta fixa ou parcelamento não encontrado."

Erros novos em outras actions: excluir categoria ou conta usada numa regra → "... é usada em conta fixa ou parcelamento e não pode ser excluída."

### `@/server/actions/imports`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createImportAction(formData)` | `FormData` com `walletId` e `file` (.ofx/.csv, até 1 MB) | `{ batchId, summary, errors }` | "Extrato lido. Revise os lançamentos antes de confirmar." |
| `updateImportRowAction(rowId, { decision?, categoryId? })` | `string, { decision?: "IMPORT"\|"SKIP"; categoryId?: string\|null }` | `ImportRow` | "Atualizado." |
| `commitImportAction(batchId)` | `string` | `{ imported, skipped }` | "Importação concluída." |
| `discardImportAction(batchId)` | `string` | `null` | "Importação descartada." |
| `undoImportAction(batchId)` | `string` | `{ deleted }` | "Importação desfeita." (apaga os lançamentos que ela criou) |
| `deleteCategoryRuleAction(id)` | `string` | `null` | "Regra apagada." |
| `suggestCategoryAction(description, type)` | `string, "INCOME"\|"EXPENSE"` | `{ categoryId: string \| null }` | (só leitura, sem toast) |

Fluxo de tela da importação:
1. `/importar`: escolher a conta + arquivo (`<input type="file" accept=".ofx,.csv">`) e enviar com `createImportAction(new FormData(form))`. Com sucesso, ir pra `/importar/[batchId]`. Mostrar `errors` (linhas que não deu pra ler) como aviso, se houver.
2. `/importar/[batchId]` (revisão): tabela com data, descrição, valor (verde/vermelho pelo `type`), select de categoria (só do tipo da linha; marque "sugerida" quando `categoryId === suggestedCategoryId`) e um toggle Importar/Pular. Selos: "Já importado" (`duplicateOfId`) e "Possível duplicata" (`possibleDuplicate`). Resumo no topo (`summary`). Botões "Confirmar importação" (desabilitado se `summary.withoutCategory > 0`) e "Descartar".
3. Lista de importações em `/importar` com status, conta e quantidade; nas confirmadas, um botão "Desfazer" com confirmação.
- Arquivos de exemplo pra testar (dados fictícios): `/exemplos/extrato-exemplo.ofx` e `/exemplos/extrato-exemplo.csv`. Deixe um link "Baixar extrato de exemplo" na tela.
- No formulário de transação: ao sair do campo descrição (ou com debounce), chame `suggestCategoryAction` e, **se a categoria ainda estiver vazia**, preencha com a sugerida (nunca sobrescreva a escolha do usuário).

### `@/server/actions/goals`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createGoalAction(input)` | `GoalFormValues` | `Goal` | "Meta criada." |
| `updateGoalAction(id, input)` | `string, GoalFormValues` | `Goal` | "Meta atualizada." |
| `setGoalArchivedAction(id, archived)` | `string, boolean` | `Goal` | "Meta arquivada." / "Meta reativada." |
| `deleteGoalAction(id)` | `string` | `null` | "Meta excluída." (apaga o histórico junto: avise na confirmação) |
| `addGoalContributionAction(goalId, input)` | `string, GoalContributionFormValues` | `GoalContribution` | "Valor guardado na meta." / "Valor retirado da meta." |
| `deleteGoalContributionAction(id)` | `string` | `null` | "Movimentação apagada." |

Erros possíveis: "Você já tem uma meta com esse nome.", "Não dá pra retirar mais do que está guardado nessa meta.", "Apagar esse depósito deixaria a meta negativa. ...", "Meta não encontrada."

### Exportar CSV (link, não action)
- `GET /api/export/transacoes?month=2026-11&type=&categoryId=&walletId=&q=` baixa o CSV (Excel pt-BR) com os mesmos filtros da tela de transações. Use um `<a href=... download>` "Exportar CSV" na tela de Transações e em Relatórios, montando a URL com os filtros atuais.

### `@/server/actions/transfers`
| Action | Entrada | `data` no sucesso | Mensagem |
|---|---|---|---|
| `createTransferAction(input)` | `TransferFormValues` | `Transfer` | "Transferência feita." |
| `deleteTransferAction(id)` | `string` | `null` | "Transferência apagada." |

Transferência **não é receita nem despesa**: muda o saldo das duas contas (`listWalletsWithBalance` já considera) e não aparece no resumo do mês nem nos orçamentos. Na tela `/contas`, um botão "Transferir" e a lista das transferências do mês. Conta com transferências não pode ser excluída ("Essa conta tem transferências...").

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
| `/importar` e `/importar/[batchId]` | Importação de extrato (**nova**): upload, revisão e histórico |
| `/metas` | Metas (**nova**): cards com barra de progresso, quanto falta, "guarde R$ X/mês até DD/MM", guardar/retirar, histórico, arquivar |
| `/relatorios` | Relatórios (**nova**): exportar CSV + "Gastos x inflação" (barras nominal vs. corrigido, texto do último IPCA) |
| `/recorrentes` | Contas fixas e parcelados (**nova**): lista com próxima data/valor, parcelas pagas, pausar/retomar, criar, editar e excluir |
| `/categorias` | Categorias |
| `/orcamentos` | Orçamentos (sugestão: `?month=` igual às transações) |

O menu atual fica em `src/components/MainNav.tsx` e as páginas são **placeholders**: pode substituir à vontade.
