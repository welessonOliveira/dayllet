// Diz pro TypeScript que session.user tem "id" (colocado no callback de sessão).
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
