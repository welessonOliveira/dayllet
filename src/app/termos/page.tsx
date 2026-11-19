import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termos de Uso — Dayllet" };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso" updated="18/11/2026">
      <section>
        <p>
          O Dayllet é gratuito e foi feito como projeto pessoal e de portfólio. Ao usar, você concorda com estes termos.
        </p>
      </section>
      <section>
        <h2>Uso</h2>
        <ul>
          <li>Use o app pra organizar as suas finanças. Não tente acessar dados de outras pessoas nem atrapalhar o serviço.</li>
          <li>Você é responsável pelo que cadastra e importa.</li>
        </ul>
      </section>
      <section>
        <h2>Sem garantia</h2>
        <ul>
          <li>
            O app é oferecido &quot;como está&quot;. Pode sair do ar, mudar ou ter erros. Confira valores importantes no
            seu banco.
          </li>
          <li>As previsões e relatórios são estimativas e não são recomendação financeira.</li>
        </ul>
      </section>
      <section>
        <h2>Seus dados</h2>
        <p>
          Veja a <Link href="/privacidade">Política de Privacidade</Link>. Você pode baixar ou apagar seus dados quando
          quiser, em Minha conta.
        </p>
      </section>
    </LegalPage>
  );
}
