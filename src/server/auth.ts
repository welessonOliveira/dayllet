// Configuração do login (Auth.js v5).
// - "demo": entra na conta de demonstração com 1 clique (sem senha).
// - "github": só aparece se AUTH_GITHUB_ID e AUTH_GITHUB_SECRET estiverem no .env.
// Sessão em JWT (cookie assinado com AUTH_SECRET); os usuários ficam no banco pelo adapter.
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { prisma } from "./db";
import { setupNewUser } from "./defaults";
import { ensureDemoUser, maybeResetDemo } from "./demo";

export const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...(githubEnabled ? [GitHub] : []),
    Credentials({
      id: "demo",
      name: "Conta de demonstração",
      credentials: {},
      async authorize() {
        const user = await ensureDemoUser(prisma);
        await maybeResetDemo(prisma, user);
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
    // Usuário novo (GitHub): ganha as categorias padrão e uma conta.
    async createUser({ user }) {
      if (user.id) await setupNewUser(prisma, user.id);
    },
  },
});
