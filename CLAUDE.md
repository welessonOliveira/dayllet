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
(preencher quando o projeto estiver montado: dev, build, lint, test, db:seed, migrate)
