import { describe, expect, it } from "vitest";
import {
  normalizeDescription,
  ruleKey,
  ruleMatches,
  significantTokens,
  suggestCategory,
} from "@/lib/categorize";
import { toDateInput } from "@/lib/dates";
import {
  decodeStatement,
  detectFormat,
  parseCsv,
  parseCsvDate,
  parseOfx,
  parseOfxDate,
  parseStatement,
  parseStatementAmount,
  splitCsvLine,
} from "@/lib/statement";

// OFX "de verdade" de banco brasileiro: SGML (sem fechar as tags), cabeçalho antigo.
const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKTRANLIST>
<DTSTART>20261101
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105120000[-3:BRT]
<TRNAMT>-52.34
<FITID>2026110500001
<MEMO>COMPRA CARTAO - SUPERMERCADO BOM PRECO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261106
<TRNAMT>4500,00
<FITID>2026110600002
<NAME>SALARIO EMPRESA X
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>2026XX06
<TRNAMT>-1.00
<FITID>RUIM
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("valores do extrato (centavos, sem float)", () => {
  it.each([
    ["-52.34", -5234],
    ["4500,00", 450000],
    ["-1.234,56", -123456],
    ["1,234.56", 123456],
    ["1234.5", 123450],
    ["(123,45)", -12345],
    ["R$ -10,00", -1000],
    ["+50", 5000],
    ["123,45-", -12345],
    ["1.234", 123400],
    ["0,1", 10],
  ])("%s -> %i", (raw, cents) => {
    expect(parseStatementAmount(raw)).toBe(cents);
  });

  it.each(["", "abc", "1,2,3x", "--"])("rejeita %j", (raw) => {
    expect(parseStatementAmount(raw)).toBeNull();
  });
});

describe("datas do extrato", () => {
  it("OFX com hora e fuso, e CSV em vários formatos", () => {
    expect(toDateInput(parseOfxDate("20261105120000.000[-3:BRT]")!)).toBe("2026-11-05");
    expect(parseOfxDate("20260230")).toBeNull();
    expect(toDateInput(parseCsvDate("05/11/2026")!)).toBe("2026-11-05");
    expect(toDateInput(parseCsvDate("5/1/26")!)).toBe("2026-01-05");
    expect(toDateInput(parseCsvDate("2026-11-05")!)).toBe("2026-11-05");
    expect(parseCsvDate("31/02/2026")).toBeNull();
  });
});

describe("OFX", () => {
  it("lê SGML sem tags de fechamento, junta NAME/MEMO e aponta linha ruim", () => {
    expect(detectFormat(OFX_SGML)).toBe("OFX");
    const r = parseOfx(OFX_SGML);
    expect(r.rows.map((x) => [toDateInput(x.date), x.signedCents, x.description, x.fitId])).toEqual([
      ["2026-11-05", -5234, "COMPRA CARTAO - SUPERMERCADO BOM PRECO", "2026110500001"],
      ["2026-11-06", 450000, "SALARIO EMPRESA X", "2026110600002"],
    ]);
    expect(r.errors).toEqual(["Lançamento 3: data ou valor inválido."]);
  });

  it("também lê OFX em XML (com tags fechadas)", () => {
    const xml = `<?xml version="1.0"?><OFX><STMTTRN><DTPOSTED>20261110</DTPOSTED><TRNAMT>-9.90</TRNAMT><FITID>A1</FITID><MEMO>NETFLIX.COM</MEMO></STMTTRN></OFX>`;
    expect(parseOfx(xml).rows).toMatchObject([{ signedCents: -990, description: "NETFLIX.COM", fitId: "A1" }]);
  });
});

describe("CSV", () => {
  it("separador ;, aspas, cabeçalho com acento, linha de saldo ignorada", () => {
    const csv = [
      "Extrato conta corrente",
      "Data;Histórico;Valor (R$)",
      '05/11/2026;"PIX ENVIADO; JOAO";-150,00',
      "06/11/2026;SALARIO;4.500,00",
      "06/11/2026;SALDO DO DIA;4.350,00",
      "xx/11/2026;QUEBRADA;1,00",
    ].join("\r\n");
    const r = parseCsv(csv);
    expect(r.rows.map((x) => [toDateInput(x.date), x.signedCents, x.description])).toEqual([
      ["2026-11-05", -15000, "PIX ENVIADO; JOAO"],
      ["2026-11-06", 450000, "SALARIO"],
    ]);
    expect(r.errors).toEqual(["Linha 6: data ou valor inválido."]);
  });

  it("separador , com colunas de crédito e débito separadas", () => {
    const csv = "date,description,credit,debit\n2026-11-05,Mercado,,52.34\n2026-11-06,Salario,4500.00,";
    expect(parseCsv(csv).rows.map((x) => x.signedCents)).toEqual([-5234, 450000]);
  });

  it("conta Nubank: ponto decimal e o Identificador vira id (não duplica na reimportação)", () => {
    const csv = [
      "Data,Valor,Identificador,Descrição",
      "01/11/2026,-45.90,6543a1b2-0000-4000-8000-000000000001,Compra no débito - IFOOD",
      "05/11/2026,2500.00,6543a1b2-0000-4000-8000-000000000002,Transferência recebida pelo Pix - EMPRESA",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows.map((x) => [toDateInput(x.date), x.signedCents, x.description, x.fitId])).toEqual([
      ["2026-11-01", -4590, "Compra no débito - IFOOD", "6543a1b2-0000-4000-8000-000000000001"],
      ["2026-11-05", 250000, "Transferência recebida pelo Pix - EMPRESA", "6543a1b2-0000-4000-8000-000000000002"],
    ]);
  });

  it("fatura do cartão Nubank (date,title,amount): compra positiva vira saída, pagamento vira entrada", () => {
    const csv = "date,title,amount\n2026-11-03,Uber *Trip,23.45\n2026-11-10,Pagamento recebido,-500.00";
    expect(parseCsv(csv).rows.map((x) => [x.description, x.signedCents])).toEqual([
      ["Uber *Trip", -2345],
      ["Pagamento recebido", 50000],
    ]);
  });

  it("PicPay: BOM, menos tipográfico (−R$), descrição com o tipo e compra no cartão fica de fora", () => {
    const csv = [
      '﻿data,hora,tipo,"origem / destino",valor,"forma de pagamento"',
      '2026-11-13,21:20,"Compra realizada",Uber,"−R$ 12,95","Com saldo"',
      '2026-11-12,10:00,"Pix enviado","Maria Souza","−R$ 1.050,00",',
      '2026-11-11,09:00,"Pix recebido","Joao Lima","R$ 300,00",',
      '2026-11-10,08:00,"Compra realizada","Loja X","−R$ 99,90","Com cartão"',
    ].join("\n");
    const r = parseStatement(new TextEncoder().encode(csv));
    expect(r.rows.map((x) => [toDateInput(x.date), x.description, x.signedCents])).toEqual([
      ["2026-11-13", "Uber", -1295],
      ["2026-11-12", "Pix enviado - Maria Souza", -105000],
      ["2026-11-11", "Pix recebido - Joao Lima", 30000],
    ]);
    expect(r.errors).toEqual([
      "1 compra(s) no cartão de crédito ficaram de fora: elas entram na fatura do cartão, não no saldo da conta.",
    ]);
  });

  it("sem cabeçalho reconhecível dá erro claro", () => {
    expect(parseCsv("a;b;c\n1;2;3").errors[0]).toMatch(/colunas de data, descrição e valor/);
  });

  it("splitCsvLine respeita aspas escapadas", () => {
    expect(splitCsvLine('a;"b ""c"";d";e', ";")).toEqual(["a", 'b "c";d', "e"]);
  });
});

describe("codificação e limites", () => {
  it("Windows-1252 vira texto com acento certo", () => {
    // "Padaria São João" em Windows-1252 (ã = 0xE3, ã... ç etc.)
    const bytes = new Uint8Array([0x50, 0x61, 0x64, 0x61, 0x72, 0x69, 0x61, 0x20, 0x53, 0xe3, 0x6f]);
    expect(decodeStatement(bytes)).toBe("Padaria São");
  });

  it("parseStatement detecta o formato e barra arquivo grande", () => {
    expect(parseStatement(new TextEncoder().encode(OFX_SGML)).format).toBe("OFX");
    const grande = new Uint8Array(1024 * 1024 + 1);
    expect(parseStatement(grande).errors[0]).toMatch(/grande demais/);
  });
});

describe("categorização automática", () => {
  it("normaliza e tira palavras que não dizem nada", () => {
    expect(normalizeDescription("Uber *Trip 8731 São Paulo")).toBe("UBER TRIP SAO PAULO");
    expect(significantTokens("COMPRA CARTAO - IFOOD *RESTAURANTE 123")).toEqual(["IFOOD", "RESTAURANTE"]);
    expect(ruleKey("PIX ENVIADO JOAO DA SILVA")).toBe("JOAO SILVA");
    expect(ruleKey("PIX 123")).toBeNull();
  });

  it("regra casa por palavras inteiras, em sequência", () => {
    expect(ruleMatches("UBER", "UBER *TRIP 8731")).toBe(true);
    expect(ruleMatches("UBER", "SUBERBAN LTDA")).toBe(false);
    expect(ruleMatches("UBER TRIP", "UBER EATS")).toBe(false);
  });

  it("sugere a mais específica, só do mesmo tipo; empate = mais usada", () => {
    const rules = [
      { pattern: "UBER", categoryId: "transporte", categoryType: "EXPENSE" as const, hits: 5 },
      { pattern: "UBER EATS", categoryId: "alimentacao", categoryType: "EXPENSE" as const, hits: 1 },
      { pattern: "SALARIO", categoryId: "salario", categoryType: "INCOME" as const, hits: 1 },
      { pattern: "NETFLIX", categoryId: "lazer", categoryType: "EXPENSE" as const, hits: 1 },
      { pattern: "NETFLIX", categoryId: "assinaturas", categoryType: "EXPENSE" as const, hits: 9 },
    ];
    expect(suggestCategory("UBER *TRIP", "EXPENSE", rules)?.categoryId).toBe("transporte");
    expect(suggestCategory("UBER EATS PEDIDO", "EXPENSE", rules)?.categoryId).toBe("alimentacao");
    expect(suggestCategory("SALARIO EMPRESA", "EXPENSE", rules)).toBeNull(); // tipo errado
    expect(suggestCategory("NETFLIX.COM", "EXPENSE", rules)?.categoryId).toBe("assinaturas");
  });
});
