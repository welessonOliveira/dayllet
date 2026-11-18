// Leitura de extrato bancário (OFX e CSV), sem biblioteca (Decisão 20/25).
// Tudo puro: recebe texto/bytes e devolve linhas normalizadas. Nada de banco aqui.
//
// Armadilhas tratadas:
// - OFX de banco brasileiro geralmente é SGML (tags sem fechamento), não XML.
// - Arquivo em Windows-1252 (acentos quebram se ler como UTF-8).
// - Datas OFX "20261118120000[-3:BRT]" e CSV "18/11/2026".
// - Valores "-1.234,56", "1234.56", "(123,45)", "R$ 10,00" -> centavos sem float.

import { isValidDateInput, dateInputToUtc } from "./dates";

export type StatementFormat = "OFX" | "CSV";

export type StatementRow = {
  /** Data do lançamento (12:00 UTC). */
  date: Date;
  /** Valor com sinal, em centavos: negativo = saída (despesa), positivo = entrada. */
  signedCents: number;
  description: string;
  /** FITID do OFX (null no CSV: o servidor calcula um hash). */
  fitId: string | null;
};

export type ParseResult = { format: StatementFormat; rows: StatementRow[]; errors: string[] };

export const MAX_STATEMENT_BYTES = 1024 * 1024; // 1 MB
export const MAX_STATEMENT_ROWS = 2000;

// ---------- Texto ----------

/** Decodifica os bytes: UTF-8 se for válido, senão Windows-1252 (padrão dos bancos antigos). */
export function decodeStatement(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  return texto.replace(/^﻿/, ""); // tira o BOM
}

/** OFX ou CSV, pelo conteúdo (o nome do arquivo pode mentir). */
export function detectFormat(text: string): StatementFormat {
  return /OFXHEADER|<OFX>/i.test(text.slice(0, 2000)) ? "OFX" : "CSV";
}

// ---------- Valores ----------

/**
 * Valor de extrato -> centavos com sinal. Aceita "1.234,56", "-1234.56", "1234,5",
 * "(123,45)" (negativo), "R$ -10,00", "+50". Devolve null se não entender.
 * Decide o separador decimal pelo ÚLTIMO "," ou "." seguido de 1 ou 2 dígitos no fim.
 */
export function parseStatementAmount(raw: string): number | null {
  let s = raw.trim().replace(/R\$/i, "").replace(/\s/g, "");
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negativo = !negativo;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s.endsWith("-")) {
    // alguns bancos põem o sinal no fim: "123,45-"
    negativo = !negativo;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const m = /[.,](\d{1,2})$/.exec(s);
  let inteiros = s;
  let decimais = "";
  if (m) {
    inteiros = s.slice(0, m.index);
    decimais = m[1];
  }
  inteiros = inteiros.replace(/[.,]/g, ""); // separadores de milhar
  if (!/^\d+$/.test(inteiros || "0")) return null;
  const cents = Number(inteiros || "0") * 100 + Number(decimais.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return negativo ? -cents : cents;
}

// ---------- Datas ----------

/** "20261118", "20261118120000", "20261118120000.000[-3:BRT]" -> Date 12:00 UTC. */
export function parseOfxDate(raw: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidDateInput(iso) ? dateInputToUtc(iso) : null;
}

/** "18/11/2026", "18/11/26", "2026-11-18", "18-11-2026" -> Date 12:00 UTC. */
export function parseCsvDate(raw: string): Date | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return isValidDateInput(`${m[1]}-${m[2]}-${m[3]}`) ? dateInputToUtc(`${m[1]}-${m[2]}-${m[3]}`) : null;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidDateInput(iso) ? dateInputToUtc(iso) : null;
}

// ---------- OFX ----------

/** Valor de uma tag OFX dentro de um bloco (funciona com e sem tag de fechamento). */
function ofxTag(bloco: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(bloco);
  return m ? m[1].trim() : null;
}

function limpaTexto(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOfx(text: string): ParseResult {
  const rows: StatementRow[] = [];
  const errors: string[] = [];
  const blocos = text.split(/<STMTTRN>/i).slice(1);
  blocos.forEach((cru, i) => {
    const bloco = cru.split(/<\/STMTTRN>/i)[0];
    const date = parseOfxDate(ofxTag(bloco, "DTPOSTED") ?? "");
    const signedCents = parseStatementAmount(ofxTag(bloco, "TRNAMT") ?? "");
    const memo = ofxTag(bloco, "MEMO");
    const name = ofxTag(bloco, "NAME");
    const description = limpaTexto([name, memo].filter(Boolean).join(" - ") || "Sem descrição");
    const fitId = ofxTag(bloco, "FITID");
    if (!date || signedCents === null) {
      errors.push(`Lançamento ${i + 1}: data ou valor inválido.`);
      return;
    }
    if (signedCents === 0) return; // lançamento zerado não interessa
    rows.push({ date, signedCents, description: description.slice(0, 120), fitId: fitId || null });
  });
  return { format: "OFX", rows, errors };
}

// ---------- CSV ----------

/** Divide uma linha CSV respeitando aspas ("a;b" fica junto, "" vira "). */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (aspas) {
      if (c === '"' && line[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      out.push(atual);
      atual = "";
    } else atual += c;
  }
  out.push(atual);
  return out.map((v) => v.trim());
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const COLUNAS = {
  date: /^(data|date|dt)( (do )?lancamento| mov(imento)?)?$/,
  description: /^(descricao|historico|lancamento|description|memo|detalhe|estabelecimento)/,
  amount: /^(valor|amount|quantia)( \(r\$\))?( r\$)?$/,
  credit: /^(credito|credit|entrada)/,
  debit: /^(debito|debit|saida)/,
};

/**
 * CSV de banco. Detecta o separador (";" ou ","), a linha de cabeçalho e as colunas
 * por nome (data, descrição/histórico, valor — ou crédito e débito separados).
 * Linhas de saldo ("SALDO ...") são ignoradas.
 */
export function parseCsv(text: string): ParseResult {
  const errors: string[] = [];
  const linhas = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length === 0) return { format: "CSV", rows: [], errors: ["Arquivo vazio."] };

  const amostra = linhas.slice(0, 10).join("\n");
  const sep = (amostra.match(/;/g)?.length ?? 0) >= (amostra.match(/,/g)?.length ?? 0) / 2 ? ";" : ",";

  // Cabeçalho = primeira linha (das 10 primeiras) que tem coluna de data e de descrição.
  let headerIdx = -1;
  let idx = { date: -1, description: -1, amount: -1, credit: -1, debit: -1 };
  for (let i = 0; i < Math.min(10, linhas.length); i++) {
    const cols = splitCsvLine(linhas[i], sep).map(semAcento);
    const achar = (re: RegExp) => cols.findIndex((c) => re.test(c));
    const tentativa = {
      date: achar(COLUNAS.date),
      description: achar(COLUNAS.description),
      amount: achar(COLUNAS.amount),
      credit: achar(COLUNAS.credit),
      debit: achar(COLUNAS.debit),
    };
    if (tentativa.date >= 0 && tentativa.description >= 0 && (tentativa.amount >= 0 || tentativa.credit >= 0 || tentativa.debit >= 0)) {
      headerIdx = i;
      idx = tentativa;
      break;
    }
  }
  if (headerIdx < 0) {
    return {
      format: "CSV",
      rows: [],
      errors: ["Não achei as colunas de data, descrição e valor. O CSV precisa ter um cabeçalho com esses nomes."],
    };
  }

  const rows: StatementRow[] = [];
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const cols = splitCsvLine(linhas[i], sep);
    const descricao = (cols[idx.description] ?? "").replace(/\s+/g, " ").trim();
    if (/^saldo\b/i.test(semAcento(descricao))) continue;
    const date = parseCsvDate(cols[idx.date] ?? "");
    let signedCents: number | null;
    if (idx.amount >= 0) {
      signedCents = parseStatementAmount(cols[idx.amount] ?? "");
    } else {
      const cred = cols[idx.credit]?.trim() ? parseStatementAmount(cols[idx.credit]) : 0;
      const deb = cols[idx.debit]?.trim() ? parseStatementAmount(cols[idx.debit]) : 0;
      signedCents = cred === null || deb === null ? null : Math.abs(cred) - Math.abs(deb);
    }
    if (!date || signedCents === null) {
      errors.push(`Linha ${i + 1}: data ou valor inválido.`);
      continue;
    }
    if (signedCents === 0) continue;
    rows.push({ date, signedCents, description: (descricao || "Sem descrição").slice(0, 120), fitId: null });
  }
  return { format: "CSV", rows, errors };
}

/** Lê o extrato inteiro (bytes do arquivo) e aplica os limites de tamanho. */
export function parseStatement(bytes: Uint8Array): ParseResult {
  if (bytes.byteLength > MAX_STATEMENT_BYTES) {
    return { format: "CSV", rows: [], errors: ["Arquivo grande demais (máximo 1 MB)."] };
  }
  const texto = decodeStatement(bytes);
  const r = detectFormat(texto) === "OFX" ? parseOfx(texto) : parseCsv(texto);
  if (r.rows.length > MAX_STATEMENT_ROWS) {
    return { ...r, rows: [], errors: [`Arquivo com lançamentos demais (máximo ${MAX_STATEMENT_ROWS}).`] };
  }
  return r;
}
