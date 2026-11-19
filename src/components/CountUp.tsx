"use client";

// Valor em reais que "conta" até o número final quando a tela abre (respeita "reduzir movimento").
import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";

export function CountUp({ cents, durationMs = 700 }: { cents: number; durationMs?: number }) {
  // Começa em 0 (o valor certo fica sempre disponível pro leitor de tela no sr-only).
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || cents === 0) {
      setValor(cents);
      return;
    }
    let frame = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min((agora - inicio) / durationMs, 1);
      const suave = 1 - (1 - t) ** 3; // começa rápido e freia no fim
      setValor(Math.round(cents * suave));
      if (t < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [cents, durationMs]);

  return (
    <>
      <span aria-hidden="true">{formatBRL(valor)}</span>
      <span className="sr-only">{formatBRL(cents)}</span>
    </>
  );
}
