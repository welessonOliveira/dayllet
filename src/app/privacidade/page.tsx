import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade — Dayllet" };

const REPO = "https://github.com/welessonOliveira/dayllet";

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updated="18/11/2026">
      <section>
        <p>
          O Dayllet é um app de finanças pessoais feito como projeto de portfólio. Esta página explica, de forma direta,
          quais dados ele guarda e o que faz com eles, conforme a Lei Geral de Proteção de Dados (LGPD).
        </p>
      </section>
      <section>
        <h2>O que a gente guarda</h2>
        <ul>
          <li>
            <strong>Do login com Google ou GitHub:</strong> seu nome, e-mail e foto de perfil. Não temos acesso à sua
            senha.
          </li>
          <li>
            <strong>O que você cadastra ou importa:</strong> contas, lançamentos, categorias, orçamentos, metas e
            extratos que você enviar.
          </li>
        </ul>
      </section>
      <section>
        <h2>Pra que serve</h2>
        <p>
          Só pra fazer o app funcionar pra você: mostrar saldos, previsões, relatórios e lembrar suas categorias. Seus
          dados não são vendidos, não são usados pra anúncio e não são compartilhados com ninguém. Cada pessoa só
          enxerga os próprios dados.
        </p>
      </section>
      <section>
        <h2>Onde fica</h2>
        <p>
          No banco de dados Neon (PostgreSQL), em São Paulo, e o app roda na Vercel. A conexão é sempre criptografada
          (HTTPS).
        </p>
      </section>
      <section>
        <h2>Seus direitos</h2>
        <ul>
          <li>
            <strong>Baixar seus dados:</strong> em Minha conta → Baixar meus dados (arquivo JSON com tudo).
          </li>
          <li>
            <strong>Apagar sua conta:</strong> em Minha conta → Excluir conta. Apaga tudo na hora, sem volta.
          </li>
          <li>
            A <strong>conta de demonstração</strong> (visitante) é apagada sozinha em 24 horas.
          </li>
        </ul>
      </section>
      <section>
        <h2>Contato</h2>
        <p>
          Dúvidas ou pedidos: abra uma issue em <a href={`${REPO}/issues`}>github.com/welessonOliveira/dayllet</a>.
        </p>
      </section>
    </LegalPage>
  );
}
