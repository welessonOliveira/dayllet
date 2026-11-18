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

---

## Decisões da v2: arquitetura de produto (2026-11-18, aprovadas pelo Welesson)

> Estas decisões **substituem** o que estiver em conflito acima. Em especial: multiusuário, autenticação e importação de extrato **entram no escopo**. Banco aberto (Open Finance) e investimentos continuam fora.

13. **Objetivo da v2:** sair do "CRUD de receitas e despesas" e virar um sistema com regras de negócio reais, pra portfólio: multiusuário com login, várias contas, lançamentos recorrentes e parcelados, projeção de saldo (previsto vs. realizado), importação de extrato (OFX/CSV) com revisão, categorização automática, metas, relatórios exportáveis e correção pela inflação (IPCA).
14. **Arquitetura:** monolito modular no próprio Next.js. Regras puras em `src/lib`, um módulo por domínio em `src/server` e Server Actions finas. **Toda função de `src/server` recebe o contexto `{ db, userId }`**, e toda consulta filtra por `userId` da sessão (nunca do cliente). Isso evita IDOR.
15. **Banco: PostgreSQL** em dev, teste e produção (produção no Neon). O SQLite sai, porque o Prisma não aceita migrations de dois bancos diferentes no mesmo projeto. Dinheiro continua em centavos (`Int`), e percentuais/taxas em pontos-base (`Int`).
16. **Autenticação:** Auth.js (NextAuth v5) com login pelo GitHub e uma **conta demo** que entra em 1 clique, com dados de exemplo e reset periódico. Toda Server Action confere a sessão.
17. **Multiusuário:** `userId` em toda tabela de dado do usuário. Nome de categoria é único **por usuário**.
18. **Contas (`Account`):** corrente, carteira e poupança, com saldo inicial. Toda transação pertence a uma conta. **Transferência** entre contas é o tipo `TRANSFER`, com duas pernas ligadas por `transferGroupId`, e **não conta** como receita nem despesa nos totais.
19. **Recorrência e parcelas:** a `RecurringRule` gera os lançamentos **na leitura** (sem cron), de forma idempotente (`@@unique([recurringRuleId, occurrenceDate])`). Dia 31 vira o último dia em meses curtos. No parcelamento, a última parcela leva o resto da divisão (R$ 100 em 3x = 33,33 + 33,33 + 33,34). Editar uma regra afeta só os lançamentos futuros.
20. **Importação:** o arquivo vai pra uma área de revisão (`ImportBatch` + `ImportRow`) e só vira `Transaction` depois de confirmado. As duplicatas são tiradas por FITID (OFX) ou hash de data + valor + descrição (CSV), e o mesmo arquivo é barrado pelo hash. Aceita OFX em SGML e Windows-1252, e CSV com `dd/mm/aaaa` e vírgula decimal. **Extrato real nunca vai pro git.**
21. **Categorização automática:** regras aprendidas (`CategoryRule`: padrão na descrição → categoria), criadas quando o usuário corrige uma categoria. IA fica como camada opcional no futuro.
22. **Calculado na hora, nunca guardado:** saldo, projeção, previsto vs. realizado e progresso de orçamento e de meta. Tudo em funções puras com teste.
23. **Inflação:** IPCA da API SGS do Banco Central (série 433), com cache na tabela `IndexRate`.
24. **Ordem de implementação:** (1) fundação multiusuário: Postgres, Auth.js, `userId`, `Account` e conta demo; (2) recorrentes e parcelas; (3) projeção e previsto vs. realizado; (4) importação OFX/CSV; (5) categorização automática; (6) metas; (7) relatórios e IPCA; (8) deploy (Vercel + Neon) desde a etapa 1, e README comercial no fim. Cartão de crédito (fatura) fica pra depois de tudo.
25. **Dependências novas permitidas na v2:** `next-auth@5` e `@auth/prisma-adapter` (login). Parser de OFX/CSV feito na mão, sem biblioteca, e com testes. Qualquer outra dependência continua precisando de justificativa.

### Ajustes feitos durante a implementação (2026-11-18)

- **Decisão 18 (transferência):** virou um model próprio, `Transfer` (conta de origem, conta de destino, valor e data), em vez de duas "pernas" de `Transaction` com tipo `TRANSFER`. Motivo: assim a transferência nunca entra por engano em receitas, despesas, orçamento, gráfico ou importação. Ela só mexe no saldo de cada conta, e a soma das contas não muda.
- **Decisão 15 (banco):** o Postgres local foi instalado sem serviço do Windows (sem admin). Liga com `npm run db:start`.
- **Decisão 16 (login):** o model do Auth.js se chama `Account`, então a conta financeira virou `Wallet` no código ("Conta" na tela).
- **Decisão 16 (conta demo):** em vez de uma demo compartilhada com reset de 1h, **cada login demo cria uma conta só do visitante**, apagada depois de 24h, com teto de 200 contas demo ao mesmo tempo. Motivo: na compartilhada, um visitante via (e editava) o que o outro tinha escrito.
- **Decisão 19 (recorrência):** ocorrências com data antes do dia em que a regra foi criada entram como **pagas** (histórico), e de lá pra frente como **pendentes**. Apagar uma ocorrência gera um `RecurringSkip`, então ela não volta.
