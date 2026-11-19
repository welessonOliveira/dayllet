// Redireciona pro /login quem nem tem cookie de sessão (resposta 307 rápida,
// antes de começar a renderizar a página). É só um atalho: a checagem DE VERDADE
// (sessão válida + usuário existe) continua no servidor, em getPageCtx/getActionCtx.
import { type NextRequest, NextResponse } from "next/server";

const COOKIES_DE_SESSAO = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(req: NextRequest) {
  const temSessao = COOKIES_DE_SESSAO.some((nome) => req.cookies.has(nome));
  if (temSessao) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo, menos: login, privacidade, termos, ícones/manifesto do PWA, rotas do Auth.js, arquivos do Next e arquivos estáticos.
  matcher: ["/((?!login|privacidade|termos|pwa-icon|apple-icon|manifest|api/auth|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
