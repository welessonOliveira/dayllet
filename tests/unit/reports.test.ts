import { describe, expect, it } from "vitest";
import { buildCsv, csvMoney, csvText } from "@/lib/csv";
import { accumulatedBps, adjustForInflation, parseSgsResponse, percentToBps } from "@/lib/ipca";

describe("IPCA em inteiros", () => {
  it("porcentagem -> pontos-base", () => {
    expect(percentToBps("0.42")).toBe(42);
    expect(percentToBps("0,42")).toBe(42);
    expect(percentToBps("-0.32")).toBe(-32);
    expect(percentToBps("1.5")).toBe(150);
    expect(percentToBps("0.125")).toBe(13); // arredonda meio pra cima
    expect(percentToBps("abc")).toBeNull();
  });

  it("lê a resposta da API do Banco Central e ignora lixo", () => {
    expect(
      parseSgsResponse([
        { data: "01/10/2026", valor: "0.14" },
        { data: "01/09/2026", valor: "0.82" },
        { data: "lixo", valor: "1" },
        null,
      ]),
    ).toEqual([
      { month: "2026-09", rateBps: 82 },
      { month: "2026-10", rateBps: 14 },
    ]);
    expect(parseSgsResponse({ erro: true })).toEqual([]);
  });

  it("corrige pelos meses DEPOIS do original até o final, com arredondamento só no fim", () => {
    const rates = [
      { month: "2026-04", rateBps: 100 }, // 1%
      { month: "2026-05", rateBps: 100 },
      { month: "2026-06", rateBps: -50 }, // deflação
    ];
    // março -> junho: 10000 × 1,01 × 1,01 × 0,995 = 10149,995 -> 10150
    expect(adjustForInflation(10000, "2026-03", "2026-06", rates)).toBe(10150);
    // e um caso que arredonda pra baixo: 10000 × 1,0001 = 10001 exato; 333 × 1,01 = 336,33 -> 336
    expect(adjustForInflation(333, "2026-03", "2026-04", rates)).toBe(336);
    expect(adjustForInflation(10000, "2026-06", "2026-06", rates)).toBe(10000);
    expect(adjustForInflation(10000, "2026-06", "2026-03", rates)).toBe(10000);
    expect(adjustForInflation(0, "2026-01", "2026-06", rates)).toBe(0);
    expect(accumulatedBps("2026-03", "2026-05", rates)).toBe(201); // 1,01² = 2,01%
  });
});

describe("CSV pro Excel", () => {
  it("valor em formato pt-BR sem R$", () => {
    expect(csvMoney(123456)).toBe("1234,56");
    expect(csvMoney(-5)).toBe("-0,05");
  });

  it("protege contra CSV injection e escapa ; e aspas", () => {
    expect(csvText("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvText("+55 11")).toBe("'+55 11");
    expect(csvText("-10")).toBe("'-10");
    expect(csvText("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvText("Café; pão")).toBe('"Café; pão"');
    expect(csvText("linha1\nlinha2")).toBe("linha1 linha2");
    expect(csvText(null)).toBe("");
  });

  it("arquivo com BOM, cabeçalho e CRLF", () => {
    const csv = buildCsv(["Data", "Valor"], [["01/11/2026", "10,00"]]);
    expect(csv).toBe("﻿Data;Valor\r\n01/11/2026;10,00\r\n");
  });
});
