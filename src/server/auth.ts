// Configuração do login (Auth.js v5).
// - "demo": cria uma conta de demonstração só do visitante, com dados de exemplo (1 clique, sem senha).
// - "google": só aparece se AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET estiverem no .env.
// - "github": só aparece se AUTH_GITHUB_ID e AUTH_GITHUB_SECRET estiverem no .env.
// Google e GitHub com o mesmo e-mail caem na MESMA pessoa (os dois só entregam e-mail verificado).
// Sessão em JWT (cookie assinado com AUTH_SECRET); os usuários ficam no banco pelo adapter.
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { prisma } from "./db";
import { setupNewUser } from "./defaults";
import { createVisitorDemo } from "./demo";

export const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...(googleEnabled ? [Google({ allowDangerousEmailAccountLinking: true })] : []),
    ...(githubEnabled ? [GitHub({ allowDangerousEmailAccountLinking: true })] : []),
    Credentials({
      id: "demo",
      name: "Conta de demonstração",
      credentials: {},
      async authorize() {
        // Cada visitante ganha a própria conta demo (apagada em 24h).
        const user = await createVisitorDemo(prisma);
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    // Usuário novo (Google ou GitHub): ganha as categorias padrão e uma conta.
    async createUser({ user }) {
      if (user.id) await setupNewUser(prisma, user.id);
    },
  },
});
