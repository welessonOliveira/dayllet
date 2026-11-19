// Ícone do Dayllet desenhado em JSX pro ImageResponse (vira PNG no servidor, sem arquivo de imagem).
// `maskable`: deixa margem pro Android recortar em círculo/gota sem cortar a carteira.
export function AppIconImage({ size, maskable = false, rounded = true }: { size: number; maskable?: boolean; rounded?: boolean }) {
  const inner = Math.round(size * (maskable ? 0.5 : 0.62));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#7c3aed",
        borderRadius: rounded && !maskable ? Math.round(size * 0.22) : 0,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="6" width="19" height="13" rx="3" />
        <path d="M2.5 10.5h19" />
        <circle cx="16.5" cy="14.5" r="1.25" fill="#ffffff" stroke="none" />
      </svg>
    </div>
  );
}
