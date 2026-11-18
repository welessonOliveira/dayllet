// Seed: cria (ou recria do zero) a conta de demonstração com dados de exemplo.
// Pode rodar quantas vezes quiser: os dados da demo são apagados e recriados,
// então nunca duplica. Não mexe em nenhum outro usuário.
// As datas são relativas ao dia em que roda (Decisão 6).
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser, resetDemoData } from "../src/server/demo";

const prisma = new PrismaClient();

async function main() {
  const user = await ensureDemoUser(prisma);
  await resetDemoData(prisma, user.id);

  const where = { userId: user.id };
  const [nw, nc, nt, nb] = await Promise.all([
    prisma.wallet.count({ where }),
    prisma.category.count({ where }),
    prisma.transaction.count({ where }),
    prisma.budget.count({ where }),
  ]);
  console.log(
    `Seed ok (conta demo ${user.email}): ${nw} contas, ${nc} categorias, ${nt} transações, ${nb} orçamentos.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
