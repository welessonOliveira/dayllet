# Finanças

App web de gestão financeira pessoal, em português do Brasil. Registra receitas e despesas, organiza por categorias, acompanha orçamentos mensais e mostra um resumo do mês.

> Especificação completa em [`docs/PROMPT.md`](docs/PROMPT.md). Funções e actions disponíveis pras telas em [`docs/CONTRATO.md`](docs/CONTRATO.md).

## Pré-requisitos

- Node.js 22 (ou mais novo) e npm.
- Nada mais: o banco é SQLite, um arquivo dentro de `prisma/`.

## Instalação

```bash
npm install                          # também roda o `prisma generate`
cp .env.example .env                 # no Windows: copy .env.example .env
npx prisma migrate dev --name init   # cria o banco prisma/dev.db
npm run db:seed                      # popula com dados de exemplo
```

## Rodando

```bash
npm run dev       # http://localhost:3000
npm run build     # build de produção
npm run start     # roda o build
```

## Banco de dados

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Cria/aplica migrations depois de mudar o `prisma/schema.prisma` (`prisma migrate dev`) |
| `npm run db:seed` | Popula com categorias, ~20 transações dos últimos 3 meses e 3 orçamentos. Pode rodar de novo: não duplica. |
| `npm run db:studio` | Abre o Prisma Studio pra ver os dados |

O seed usa IDs fixos (`seed-cat-moradia`, `seed-tx-01`...) com `upsert`. As datas são relativas ao dia em que ele roda, então mudam se rodar em outro dia.

## Testes e qualidade

```bash
npm run test        # Vitest (unitários + integração)
npm run test:watch  # Vitest em modo watch
npm run lint        # ESLint (next lint)
npx tsc --noEmit    # checagem de tipos
```

O teste de integração usa um banco separado, `prisma/test.db`, que é apagado e recriado (`prisma migrate deploy`) antes da suíte. O `dev.db` nunca é tocado.

## Arquitetura

```
prisma/              schema, migrations e seed
src/app/             rotas e telas (App Router)
src/components/      componentes reutilizáveis
src/lib/             helpers e regras puras (sem banco)
  money.ts           centavos <-> "R$ 1.234,56"
  dates.ts           mês/fuso America/Sao_Paulo <-> UTC
  validations.ts     schemas Zod (cliente e servidor)
  rules.ts           saldo do mês, progresso do orçamento, checagem de tipo
  constants.ts       tipos, status e rótulos em PT-BR
  errors.ts          DomainError e ActionResult
src/server/          acesso ao banco
  db.ts              Prisma Client único
  transactions.ts    queries e mutations (recebem o Prisma Client)
  categories.ts
  budgets.ts
  dashboard.ts
  actions/           Server Actions finas: validam, chamam src/server, revalidam
tests/               Vitest (unit/ e integration/)
```

Convenções principais:

- **Dinheiro em centavos** (inteiro) no banco. Formatação só na tela, com `formatBRL`.
- **Datas em UTC** no banco, mostradas no fuso `America/Sao_Paulo`. Data sem hora é gravada às 12:00 UTC.
- **Saldo do mês** conta só o que está pago. **Orçamento** conta despesas pagas e pendentes.
- Leitura em Server Components, escrita por Server Actions.
- Regras validadas no servidor: receita só em categoria de receita, despesa só em categoria de despesa, orçamento só em categoria de despesa e sem duplicar por mês, categoria com transações não pode ser excluída.
- Sem autenticação (app de uma pessoa só).
