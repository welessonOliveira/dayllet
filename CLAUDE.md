# Finanças — app de gestão financeira pessoal

Especificação completa: `docs/PROMPT.md`. A seção **Decisões** de lá vale mais que o resto.

## Time (leia antes de tudo)
- **Claude no chat (conversasComuns) é o líder.** Ele divide o trabalho, revisa e documenta no Obsidian.
- **Claude aqui no terminal (este projeto):** cuida da base e da qualidade.
  - `prisma/`, seed, `src/lib/`, `src/server/` e Server Actions;
  - testes, README e configuração (lint, tsconfig, scripts).
- **Gemini (Antigravity, `agy`):** cuida das telas e do visual.
  - `src/app/**/page.tsx` e layouts;
  - `src/components/`.
  - Ele consome as funções de `src/server/` e as actions, e não mexe nelas.
- Se precisar mexer na área do outro, deixe um recado em `docs/RECADOS.md` em vez de editar.
- O usuário é o Welesson, iniciante em programação. Fale com ele em português do Brasil informal. Comentários no código em PT-BR quando ajudarem a entender.

## Regras
- Dinheiro em centavos (inteiro). Datas em UTC no banco e exibidas em `America/Sao_Paulo`. Use os helpers de `src/lib/money.ts` e `src/lib/dates.ts`.
- Interface 100% em PT-BR.
- Commits pequenos, com mensagem em PT-BR, só no git local. **Não dar push** sem o Welesson pedir.
- Não adicionar dependência fora da lista em `docs/PROMPT.md` (Decisão 11) sem justificar.
- Antes de dizer que uma etapa terminou: `npx tsc --noEmit`, `npm run lint` e `npm run test`, tudo passando.

## Comandos
- `npm run dev`: sobe o app em http://localhost:3000.
- `npm run build` / `npm run start`: build de produção e roda o build.
- `npm run lint`: ESLint (`next lint`).
- `npm run test`: Vitest (unitários + integração). `npm run test:watch` pra modo watch.
- `npx tsc --noEmit`: checagem de tipos.
- `npm run db:migrate`: `prisma migrate dev` (depois de mudar o schema; passe `--name <nome>`).
- `npm run db:seed`: seed idempotente (pode rodar de novo sem duplicar).
- `npm run db:studio`: Prisma Studio.

## Convenções da base
- Funções de `src/server/*` recebem o Prisma Client (`db`) como 1º argumento; as páginas passam o `prisma` de `@/server/db`.
- Server Actions ficam em `src/server/actions/`, são finas e retornam `ActionResult` (`@/lib/errors`). Regra de negócio quebrada vira `DomainError` com mensagem em PT-BR; qualquer outro erro vira mensagem genérica.
- O que as telas podem usar está em `docs/CONTRATO.md`. Mudou assinatura em `src/server` ou nas actions? Atualize o contrato.
- Banco de teste: `prisma/test.db`, recriado pelo `tests/global-setup.ts` (apaga o arquivo + `prisma migrate deploy`). Não usar `migrate reset` (o Prisma bloqueia quando chamado por IA, e não precisa).
- Testes ficam em `tests/unit/` e `tests/integration/`.
