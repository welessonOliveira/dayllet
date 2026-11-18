# Finanças — regras pro Gemini neste projeto

Leia `CLAUDE.md` (seção **Time**) e `docs/PROMPT.md`. Elas valem pra você também.

- Sua área: telas e visual (`src/app/**/page.tsx`, layouts e `src/components/`).
- Não edite `prisma/`, `src/lib/`, `src/server/` nem as Server Actions. Se precisar de alguma função nova ou mudança nelas, escreva em `docs/RECADOS.md`.
- Use os helpers de `src/lib/money.ts` e `src/lib/dates.ts` pra formatar valores e datas. Nunca use float pra dinheiro.
- Antes de entregar, rode `npx tsc --noEmit`, `npm run lint` e `npm run test`.
- Registre a entrega no vault, seguindo o skill `vault-gemini`.
