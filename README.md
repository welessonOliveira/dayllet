# Finanças

App web de gestão financeira pessoal, em português do Brasil. Registra receitas e despesas em várias contas, organiza por categorias, acompanha orçamentos mensais e mostra o resumo do mês e o saldo de cada conta. É multiusuário, com login, e tem uma **conta de demonstração** que entra em 1 clique.

> Especificação e decisões: [`docs/PROMPT.md`](docs/PROMPT.md) (veja as "Decisões da v2"). Funções e actions disponíveis pras telas: [`docs/CONTRATO.md`](docs/CONTRATO.md).

## Pré-requisitos

- Node.js 22 (ou mais novo) e npm.
- PostgreSQL 17 rodando localmente (veja abaixo).

### Banco de dados local

Qualquer Postgres serve (instalador oficial, Docker ou um banco no Neon). Crie dois bancos: `financas_dev` e `financas_test`.

Neste PC o Postgres foi instalado **sem serviço do Windows** (binários em `D:\Claude\Ferramentas\postgresql-17`), então ele precisa ser ligado depois de reiniciar:

```bash
npm run db:start    # liga o Postgres local
npm run db:status   # confere se está no ar
npm run db:stop     # desliga
```

Se o Postgres estiver em outra pasta, defina `PG_HOME` antes de usar esses comandos.

## Instalação

```bash
npm install                     # também roda o `prisma generate`
cp .env.example .env            # no Windows: copy .env.example .env
# edite o .env: senha do Postgres e AUTH_SECRET (gere com: npx auth secret)
npx prisma migrate deploy       # cria as tabelas
npm run db:seed                 # cria a conta demo com dados de exemplo
npm run dev                     # http://localhost:3000
```

### Login

- **Conta demo:** botão "Entrar como visitante (demo)" no `/login`. Os dados dela são recriados do zero a cada 1 hora (no login seguinte).
- **GitHub (opcional):** crie um OAuth App em https://github.com/settings/developers com callback `http://localhost:3000/api/auth/callback/github` e preencha `AUTH_GITHUB_ID` e `AUTH_GITHUB_SECRET` no `.env`. Sem isso, o botão do GitHub não aparece.
- Usuário novo ganha as categorias padrão e uma conta ("Conta principal").

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o app em modo desenvolvimento |
| `npm run build` / `npm run start` | Build de produção e roda o build |
| `npm run lint` | ESLint (`next lint`) |
| `npm run test` | Vitest: testes unitários + integração (usa o banco `financas_test`, que é apagado e recriado) |
| `npx tsc --noEmit` | Checagem de tipos |
| `npm run db:migrate` | `prisma migrate dev` (cria migration depois de mudar o schema) |
| `npm run db:seed` | Recria a conta demo. Pode rodar quantas vezes quiser: não duplica e não mexe em outros usuários. |
| `npm run db:studio` | Prisma Studio pra ver os dados |

## Arquitetura

Monolito modular em Next.js 15 (App Router), com regras de negócio separadas da tela e do banco:

```
prisma/              schema, migrations e seed
src/middleware.ts    manda pro /login quem não tem sessão
src/app/             rotas e telas (App Router) + /api/auth (Auth.js)
src/components/      componentes reutilizáveis
src/lib/             regras PURAS, sem banco (fáceis de testar)
  money.ts           centavos <-> "R$ 1.234,56"
  dates.ts           mês/fuso America/Sao_Paulo <-> UTC
  validations.ts     schemas Zod (cliente e servidor)
  rules.ts           saldo do mês, saldo da conta, progresso do orçamento...
src/server/          acesso ao banco, sempre com o contexto { db, userId }
  auth.ts            Auth.js v5 (demo + GitHub)
  session.ts         getPageCtx() / getActionCtx(): usuário logado -> contexto
  wallets.ts         contas e saldos
  transactions.ts, categories.ts, budgets.ts, dashboard.ts
  defaults.ts        categorias e conta de todo usuário novo
  demo.ts            conta demo e reset dos dados dela
  actions/           Server Actions finas: conferem a sessão, validam, chamam src/server
tests/               Vitest (unit/ e integration/)
```

Decisões principais:

- **Dinheiro em centavos** (inteiro). Nada de float. A formatação acontece só na tela.
- **Datas em UTC** no banco, exibidas no fuso `America/Sao_Paulo`. Data sem hora é gravada às 12:00 UTC.
- **Isolamento entre usuários:** toda função de `src/server` recebe `{ db, userId }` e toda consulta filtra pelo `userId` **da sessão**, nunca por um id vindo do navegador. Há testes que tentam ler, editar e apagar dados de outro usuário (IDOR) e precisam falhar.
- **Server Actions conferem a sessão** antes de qualquer coisa, porque são endpoints públicos.
- **Saldo do mês** conta só o que está pago. **Orçamento** conta despesas pagas e pendentes. **Saldo da conta** = saldo inicial + recebido − pago.
- Regras validadas no servidor: receita só em categoria de receita, orçamento só de despesa e sem duplicar por mês, categoria com transações não pode ser excluída, conta com lançamentos também não.

Próximos passos (veja a Decisão 24): lançamentos recorrentes e parcelados, projeção de saldo (previsto vs. realizado), importação de extrato OFX/CSV, categorização automática, metas, relatórios e IPCA.
