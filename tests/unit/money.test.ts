import { describe, expect, it } from "vitest";
import { centsToInput, formatBRL, parseBRLToCents, parseSignedBRLToCents } from "@/lib/money";

describe("parseBRLToCents", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["50", 5000],
    ["50,5", 5050],
    ["0,01", 1],
    ["R$ 10,00", 1000],
    [" 2.000.000 ", 200000000],
  ])("converte %s em %i centavos", (texto, esperado) => {
    expect(parseBRLToCents(texto)).toBe(esperado);
  });

  it.each(["", "abc", "50.5", "1.23,4", "10,123", "-5", "1,2,3"])(
    "rejeita %s",
    (texto) => {
      expect(parseBRLToCents(texto)).toBeNull();
    },
  );

  it("não sofre com erro de float (0,1 + 0,2)", () => {
    expect(parseBRLToCents("0,1")! + parseBRLToCents("0,2")!).toBe(30);
  });
});

describe("parseSignedBRLToCents (saldo inicial)", () => {
  it("aceita positivo e negativo", () => {
    expect(parseSignedBRLToCents("1.500,00")).toBe(150000);
    expect(parseSignedBRLToCents("-200")).toBe(-20000);
    expect(parseSignedBRLToCents("R$ -10,50")).toBe(-1050);
    expect(parseSignedBRLToCents("0")).toBe(0);
  });

  it("rejeita lixo", () => {
    expect(parseSignedBRLToCents("--5")).toBeNull();
    expect(parseSignedBRLToCents("abc")).toBeNull();
  });

  it("centsToInput mostra o sinal e volta igual", () => {
    expect(centsToInput(-20050)).toBe("-200,50");
    expect(parseSignedBRLToCents(centsToInput(-123456))).toBe(-123456);
  });
});

describe("formatação", () => {
  it("formatBRL usa o padrão brasileiro", () => {
    // Intl usa espaço não separável depois do R$.
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });

  it("centsToInput devolve texto que o parse entende", () => {
    expect(centsToInput(123456)).toBe("1.234,56");
    expect(centsToInput(5)).toBe("0,05");
    expect(parseBRLToCents(centsToInput(987654321))).toBe(987654321);
  });
});
