// Gera a "rede de segurança" do modo escuro: pra cada classe clara usada nas telas,
// uma cor escura que só vale quando o elemento NÃO tem um dark: próprio daquela propriedade.
// Uso: node scripts/gen-dark-css.mjs src  (imprime o bloco; cole no fim do src/app/globals.css, dentro do @layer utilities,
// no lugar do bloco antigo, sempre que uma tela nova usar uma cor clara sem dark:)
import fs from "node:fs";
import path from "node:path";

const P = {
  slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
  violet: { 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065" },
  emerald: { 300: "#6ee7b7", 400: "#34d399", 800: "#065f46", 900: "#064e3b", 950: "#022c22" },
  rose: { 300: "#fda4af", 400: "#fb7185", 800: "#9f1239", 900: "#881337", 950: "#4c0519" },
  amber: { 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
};
const mix = (hex, pct) => (pct >= 100 ? hex : `color-mix(in oklab, ${hex} ${Math.round(pct)}%, transparent)`);

/** Cor escura pra uma classe clara, ou null se não precisa mudar. */
function darkFor(prop, color, shade, alpha) {
  const a = alpha ?? 100;
  const n = shade ? Number(shade) : null;
  if (prop === "bg") {
    if (color === "white") return mix(P.slate[900], a);
    if (color === "slate") {
      if (n === 50) return mix(P.slate[800], 55 * a / 100);
      if (n === 100) return mix(P.slate[800], a);
      if (n === 200) return mix(P.slate[700], a);
      return null;
    }
    if (!P[color] || n > 200) return null;
    if (n === 50) return mix(P[color][950], 45 * a / 100);
    if (n === 100) return mix(P[color][900], 45 * a / 100);
    return mix(P[color][900], 65 * a / 100);
  }
  if (prop === "text" || prop === "fill") {
    if (color === "slate") {
      const m = { 950: 100, 900: 100, 800: 200, 700: 300, 600: 400, 500: 400, 400: 500 };
      if (prop === "fill" && n === 500) return P.slate[400];
      return m[n] ? mix(P.slate[m[n]], a) : null;
    }
    if (!P[color]) return null;
    if (prop === "fill" && n <= 200) return P[color][950] ?? null;
    if (n >= 800) return mix(P[color][300], a);
    if (n >= 600) return mix(P[color][400], a);
    return null;
  }
  if (prop.startsWith("border") || prop === "ring" || prop === "divide") {
    if (color === "slate") {
      if (n <= 200) return mix(P.slate[800], a);
      if (n <= 400) return mix(P.slate[700], a);
      return null;
    }
    if (!P[color] || n > 300) return null;
    return mix(P[color][900], 70 * a / 100);
  }
  return null;
}

const CSSPROP = { bg: "background-color", text: "color", fill: "fill", border: "border-color", ring: "--tw-ring-color", divide: "border-color" };
const VARIANT = { "": "", "hover:": ":hover", "focus:": ":focus", "group-hover:": null };

const found = new Set();
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx"))
      for (const m of fs.readFileSync(p, "utf8").matchAll(/(?<=[\s"'`])((?:hover:|focus:)?)(bg|text|border|ring|divide|fill)-(white|slate|violet|emerald|rose|amber)(?:-(\d+))?(?:\/(\d+))?(?=[\s"'`])/g))
        found.add(m[0]);
  }
})(process.argv[2]);

const out = ["/* ===== Modo escuro: rede de segurança (gerado por gen-dark-css.mjs) =====",
  "   Cada classe clara ganha uma cor escura, mas só quando o elemento não tem um dark: próprio",
  "   daquela propriedade (o :not cuida disso). Pra ajustar um caso, ponha dark:... no componente. */"];
for (const cls of [...found].sort()) {
  const m = cls.match(/^((?:hover:|focus:)?)(bg|text|border|ring|divide|fill)-(white|slate|violet|emerald|rose|amber)(?:-(\d+))?(?:\/(\d+))?$/);
  const [, v, prop, color, shade, alpha] = m;
  const val = darkFor(prop, color, shade, alpha ? Number(alpha) : undefined);
  if (!val) continue;
  const pseudo = VARIANT[v];
  const sel = `html.dark [class~="${cls}"]${pseudo}:not([class*="dark:${v}${prop}-"])`;
  const target = prop === "divide" ? `${sel} > :not(:last-child)` : sel;
  out.push(`${target} { ${CSSPROP[prop]}: ${val}; }`);
}
out.push("/* ===== fim da rede de segurança ===== */");
console.log(out.join("\n"));
