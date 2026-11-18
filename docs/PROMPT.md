# Especificação do app "Finanças"

> Prompt original do Welesson, revisado pelo Claude (líder) em 2026-11-18.
> A seção **Decisões** no fim resolve as ambiguidades e **vale mais que o resto** em caso de conflito.

## Objetivo
Aplicativo web de gestão financeira pessoal em português do Brasil, chamado **"Finanças"**. Ele serve pra registrar receitas e despesas, organizar por categorias, acompanhar orçamentos mensais e ver um resumo claro de saldo e gastos.

MVP funcional, bem estruturado e pronto pra evoluir. **Fora do escopo:** banco aberto, importação bancária, investimentos e multiusuário.

## Stack e arquitetura
- Next.js (App Router), TypeScript e Tailwind CSS.
- Prisma com SQLite.
- Zod pra validação.
- React Hook Form nos formulários.
- Pastas:
  - `src/app/`: rotas e telas.
  - `src/components/`: componentes reutilizáveis.
  - `src/lib/`: helpers, validações e regras de negócio puras.
  - `src/server/`: queries, mutations e acesso ao banco.
  - `prisma/`: schema e migrations.
- Server Components pra leitura. Server Actions pra criar, editar e remover.
- Sem autenticação e sem tabela de usuário.
- Dinheiro sempre em **centavos (inteiro)** no banco. Formatação só na interface, com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Datas em UTC no banco, exibidas no fuso `America/Sao_Paulo`.

## Modelo de dados
1. **Category**
   - `id` (string, PK)
   - `name`
   - `type` (`INCOME` | `EXPENSE`)
   - `color?`
   - `createdAt`, `updatedAt`
2. **Transaction**
   - `id` (string, PK)
   - `description`
   - `amountCents` (inteiro > 0)
   - `type` (`INCOME` | `EXPENSE`)
   - `status` (`PAID` | `PENDING`), ver Decisões
   - `date` (DateTime)
   - `categoryId` (FK)
   - `notes?`
   - `createdAt`, `updatedAt`
3. **Budget**
   - `id` (string, PK)
   - `categoryId` (FK)
   - `month` (`YYYY-MM`)
   - `limitCents` (inteiro > 0)
   - índice único em `categoryId + month`

Regras:
- Receita só em categoria `INCOME`, e despesa só em categoria `EXPENSE`. Validar no servidor, nunca confiar no cliente.
- Categoria com transações não pode ser excluída. Mostrar uma mensagem clara.
- Orçamento duplicado (mesma categoria e mesmo mês) é proibido.
- Orçamento só pode ser de categoria `EXPENSE`.

## Funcionalidades
1. **Dashboard**
   - Saldo do mês atual (receitas pagas menos despesas pagas).
   - Total de receitas, total de despesas e quantidade de transações do mês.
   - Total "a pagar" (despesas pendentes do mês), em destaque separado.
   - Os 5 maiores gastos do mês.
   - Progresso de cada orçamento do mês atual.
   - Gráfico simples de despesas por categoria.
2. **Transações**
   - Lista com data, descrição, categoria, tipo, status e valor.
   - Filtros por mês, tipo, categoria e texto na descrição.
   - Criar, editar e excluir.
   - Status pago/pendente.
   - Feedback de sucesso ou erro em toda ação.
3. **Categorias**
   - Lista separada em receitas e despesas, com a quantidade de transações de cada uma.
   - Criar, editar e excluir.
4. **Orçamentos**
   - Limite mensal por categoria de despesa.
   - Mostrar quanto foi gasto, quanto resta e o percentual usado.
   - Vermelho quando o limite for ultrapassado.
   - Criar, editar e excluir.
5. **Seed**
   - Categorias padrão: Salário, Freelance (receitas); Moradia, Alimentação, Transporte, Saúde, Lazer, Educação e Outros (despesas).
   - Entre 15 e 25 transações nos últimos 3 meses.
   - Orçamentos de exemplo pra Moradia, Alimentação e Transporte.
   - Idempotente: pode ser rodado de novo sem duplicar nada.

## Qualidade
- Interface 100% em PT-BR, responsiva (celular e desktop), limpa e bonita.
- Validação dos formulários no cliente e no servidor.
- Erros amigáveis, sem nunca mostrar stack trace.
- Confirmação antes de excluir qualquer coisa.
- Estados de loading e estados vazios.
- Código tipado, sem `any` desnecessário.
- **Testes unitários:**
  - saldo mensal;
  - validação de transação;
  - progresso de orçamento;
  - bloqueio de categoria com tipo errado.
- **Teste de integração:** criar uma transação e o orçamento refletir esse gasto.

## Entregáveis
- Projeto completo.
- `prisma/schema.prisma`.
- Seed.
- As 4 telas.
- Testes.
- `README.md` em PT-BR: pré-requisitos, instalação, dev, migrations, seed, testes e arquitetura.
- `CLAUDE.md` com comandos e convenções. Ele já existe com as regras do time: **acrescente**, não apague.

## Definição de pronto
- `npm install` sem erros.
- `npx prisma migrate dev --name init` cria o banco.
- `npm run db:seed` popula os dados, e rodar de novo não duplica.
- `npm run dev` sobe sem erros.
- As telas navegam e funcionam.
- `npm run lint`, `npm run test` e `npx tsc --noEmit` passam.
- Nenhum erro de TypeScript, lint ou runtime.

## Fluxo
Implementar em etapas: schema, seed, regras, server/actions, telas e testes. Depois de cada etapa, rodar typecheck, lint e testes, e corrigir antes de seguir. No final, listar os comandos que foram rodados e os resultados. Não adicionar dependência desnecessária; se uma for imprescindível, justificar.

---

## Decisões (resolvem as ambiguidades; valem mais que o resto)

1. **Versões fixas:**
   - Next.js **15**, com `next lint` e ESLint 9 (flat config). Lembrar que `params` e `searchParams` são async no 15.
   - Prisma **6** (a versão mais nova da 6.x), com enum nativo no SQLite. Se a versão instalada não suportar enum em SQLite, usar `String` e restringir os valores com Zod e constantes TS.
   - Tailwind 4 ou 3, o que o `create-next-app` do Next 15 trouxer.
   - Node 22.
2. **Status de pagamento:** o campo `status` (`PAID` | `PENDING`) vale pra receita e despesa, com padrão `PAID`. Na interface, despesa mostra "Pago / Pendente" e receita mostra "Recebido / A receber".
   - **Saldo do mês** conta só o que está `PAID`.
   - Despesas `PENDING` aparecem num card separado, "A pagar".
   - **Orçamento** conta despesas `PAID` e `PENDING`, porque o dinheiro já tá comprometido.
3. **"Outros"** é categoria de **despesa**. `name` continua único no banco todo.
4. **Tipo duplicado:** `Transaction.type` existe pra facilitar os filtros. O servidor **sempre** confere se ele bate com `Category.type`. No formulário, o seletor de categoria mostra só as categorias do tipo escolhido.
5. **Fuso:**
   - Toda conta de "mês" (`YYYY-MM`, início e fim do mês) é feita em `America/Sao_Paulo` e só depois convertida pra intervalo UTC.
   - Data sem hora vinda do formulário é gravada como **12:00 UTC** daquele dia, pra nunca mudar de dia.
   - Tudo isso fica centralizado em `src/lib/dates.ts`, com testes.
6. **Seed idempotente:** IDs fixos (ex.: `seed-cat-moradia`, `seed-tx-01`) com `upsert`. As datas são relativas ao dia em que o seed roda, então podem mudar se ele for rodado em outro mês. Isso é esperado.
7. **Valor digitado:**
   - O input aceita formato pt-BR ("1.234,56", "50", "50,5").
   - Converter pra centavos com um helper em `src/lib/money.ts`, com testes. **Nunca** usar float pra conta.
8. **Exclusão de categoria:** com transações, bloqueia e mostra mensagem. Sem transações mas com orçamentos, apaga os orçamentos junto (`onDelete: Cascade` no Budget), avisando isso na confirmação.
9. **Testes:** Vitest.
   - Toda regra de negócio fica em funções puras (`src/lib`) ou em funções de `src/server` que recebem o Prisma Client como dependência.
   - As Server Actions são **finas**: só validam, chamam `src/server` e fazem `revalidatePath`.
   - O teste de integração chama `src/server` direto, num SQLite só de teste (`prisma/test.db`, recriado com `prisma migrate reset --force --skip-seed` ou `db push` antes da suíte).
10. **Gráfico:** feito em SVG ou CSS puro, sem biblioteca de gráfico.
11. **Dependências permitidas:** next, react, react-dom, typescript, tailwind, prisma/@prisma/client, zod, react-hook-form, @hookform/resolvers, vitest, tsx (pra rodar o seed) e eslint (o do Next). Qualquer outra precisa de justificativa no commit.
12. **Ambiente sem interação:** use flags que não fazem perguntas (`--name init`, `--yes`, etc.). O `create-next-app` não roda em pasta que já tem arquivos: gere numa pasta temporária e mova pra cá, ou monte a estrutura na mão.
