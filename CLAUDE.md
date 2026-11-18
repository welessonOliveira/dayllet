# Finanças — app de gestão financeira pessoal

Especificação completa: `docs/PROMPT.md`. A seção **Decisões** de lá vale mais que o resto.

## Time (leia antes de tudo)
- **Claude no chat (conversasComuns) é o líder.** Ele divide o trabalho, revisa e documenta no Obsidian.
  - **Atualização (2026-11-18, do Welesson):** é o mesmo Claude, então o Claude daqui do terminal **também lidera**. Ele pode decidir, despachar o Gemini pelo Orca (`orca orchestration worker-start --agent antigravity --worktree current --keep-open`), revisar as entregas e documentar no Obsidian. Só pergunta ao Welesson o que for decisão dele (visual, escopo, push, instalar programa).
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
- Não adicionar dependência fora da lista em `docs/PROMPT.md` (Decisões 11 e 25) sem justificar.
- **Multiusuário:** toda função de `src/server` recebe `ctx: { db, userId }` e toda consulta filtra por `ctx.userId`. Nunca aceitar `userId` vindo do navegador. Toda função nova que lê ou escreve dado de usuário precisa de teste de isolamento (IDOR) em `tests/integration/`.
- Antes de dizer que uma etapa terminou: `npx tsc --noEmit`, `npm run lint` e `npm run test`, tudo passando.

## Comandos
- `npm run dev`: sobe o app em http://localhost:3000.
- `npm run build` / `npm run start`: build de produção e roda o build.
- `npm run lint`: ESLint (`next lint`).
- `npm run test`: Vitest (unitários + integração). `npm run test:watch` pra modo watch.
- `npx tsc --noEmit`: checagem de tipos.
- `npm run db:start` / `db:stop` / `db:status`: liga, desliga e confere o PostgreSQL local (`D:\Claude\Ferramentas\postgresql-17`, sem serviço do Windows; precisa ligar depois de reiniciar o PC).
- `npm run db:migrate`: `prisma migrate dev` (depois de mudar o schema; passe `--name <nome>`).
- `npm run db:seed`: recria a conta demo (idempotente, não mexe em outros usuários).
- `npm run db:studio`: Prisma Studio.

## Convenções da base
- Banco: PostgreSQL 17 (`financas_dev` e `financas_test`). A senha fica só no `.env` (fora do git). Sem Docker e sem admin nesta máquina.
- **Migrations sem interação:** o `prisma migrate dev` falha aqui porque quer confirmar avisos. Gere o SQL com `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<nome>/migration.sql` e aplique com `npx prisma migrate deploy`.
- Funções de `src/server/*` recebem `ctx: { db, userId }` como 1º argumento. As páginas pegam o contexto com `getPageCtx()` e as actions com `runMutation`, que já confere a sessão (ambos em `src/server/session.ts` e `src/server/actions/run.ts`).
- Conta financeira = model `Wallet` (o nome `Account` é reservado pelo Auth.js pra conta de login).
- **Gemini travou com `NOT_FOUND (code 404): Requested entity was not found`?** É um bug conhecido do `agy`: um 404 passageiro do servidor do Google no meio da resposta não é tentado de novo e encerra o turno ([issue #1485](https://github.com/google-antigravity/antigravity-cli/issues/1485), aberta). Não é culpa do tamanho do projeto. Faça nesta ordem:
  1. Mande `orca orchestration send --to dispatch:<id>` com "continue de onde parou" na **mesma** sessão (até 2 vezes). Normalmente a próxima mensagem funciona.
  2. Se continuar falhando, `worker-abandon` + `worker-start` numa sessão nova. Não perde nada, porque o contexto mora nos arquivos (`docs/CONTRATO.md`, `GEMINI.md`, `CLAUDE.md`, fila em `Tarefas.md` e as notas de entrega no vault).
  3. Mande tarefas em lotes com começo e fim (um lote = uma sessão), sempre apontando os arquivos de contexto. Assim nenhuma sessão fica gigante.
- **Repositório compartilhado com o Gemini:** os dois trabalham na mesma pasta e no mesmo índice do git ao mesmo tempo. Nunca use `git commit -a` nem `git add -A`. Faça `git add <seus arquivos>` e `git commit -m "..." -- <seus arquivos>`, senão você leva junto o que o outro deixou "staged".
- `npm audit`: quase tudo é de ferramenta de dev (ESLint, Vitest, CLI do Prisma). A correção de verdade é Next 16 / Prisma 7 (versões maiores, fora da Decisão 1). O `npm audit fix` sem `--force` trava com um bug do npm ("reading 'edgesOut'").
- Ao derrubar um `next dev` que você subiu, mate a **árvore** de processos (o pai `next dev` + o `start-server.js`), senão o motor do Prisma fica travado e o `prisma generate` dá EPERM. Matar pelo PID da porta 3000 pega só o filho: o pai `next dev` continua vivo. Mate pelo pai (procure `next dev` na linha de comando dos `node.exe`).
- Não rode `npm run build` com um `next dev` ligado: os dois usam a pasta `.next`, e o app abre sem CSS ou com erro `ENOENT ... .next/server/...page.js`. Se acontecer, derrube todos os `next dev`, apague a `.next` e suba um só.
- Server Actions ficam em `src/server/actions/`, são finas e retornam `ActionResult` (`@/lib/errors`). Regra de negócio quebrada vira `DomainError` com mensagem em PT-BR; qualquer outro erro vira mensagem genérica.
- O que as telas podem usar está em `docs/CONTRATO.md`. Mudou assinatura em `src/server` ou nas actions? Atualize o contrato.
- Banco de teste: `financas_test` (variável `TEST_DATABASE_URL`), recriado pelo `tests/global-setup.ts` (apaga o schema `public` + `prisma migrate deploy`). Só aceita banco com nome terminando em `_test`. Não usar `migrate reset` (o Prisma bloqueia quando chamado por IA, e não precisa).
- Testes ficam em `tests/unit/` e `tests/integration/`.
