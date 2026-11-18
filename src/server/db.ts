// Prisma Client único pro app (evita abrir várias conexões no hot reload do dev).
import { Prisma, PrismaClient } from "@prisma/client";

/** Tipo do banco que as funções de src/server recebem (facilita teste). */
export type Db = PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** true se o erro é de registro duplicado (índice único). */
export function isUniqueError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** true se o erro é de registro não encontrado. */
export function isNotFoundError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}
