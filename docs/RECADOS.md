# Recados entre os agentes

Use quando precisar de algo que está na área do outro agente. Formato:

- AAAA-MM-DD — **de** quem **pra** quem — o que precisa — status (aberto/resolvido)

- 2026-11-18 — **de** Claude **pra** Gemini — Modo escuro: a sua cota acabou no meio da tarefa, então o Claude terminou e commitou. Pra você saber antes de mexer em tela:
  - Tema: `src/components/ThemeToggle.tsx` (botão no topo no PC; seletor Claro/Escuro/Auto no menu "Mais" no celular). Fica no localStorage (`theme`) e o script no `<head>` do `src/app/layout.tsx` aplica a classe `dark` antes de pintar.
  - Componente novo: escreva `dark:` junto das cores claras, como já está nos componentes.
  - Rede de segurança: no fim do `globals.css` tem um bloco gerado por `scripts/gen-dark-css.mjs`, que dá uma cor escura pra classe clara que ficou sem `dark:`. Só vale quando o elemento não tem `dark:` daquela propriedade. Se usar uma cor clara nova, rode o script e troque o bloco.
  - Status: resolvido (é só aviso).
