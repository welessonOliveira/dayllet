// Contexto que TODA função de src/server recebe: o banco e o dono dos dados.
// O userId vem SEMPRE da sessão (nunca do navegador). Isso impede um usuário
// de ler ou mexer nos dados de outro trocando um id na requisição (IDOR).
import type { Db } from "./db";

export type Ctx = { db: Db; userId: string };
