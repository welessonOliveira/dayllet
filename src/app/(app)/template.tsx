// Recriado a cada troca de página: dá o fade curto de entrada (classe .page-in no globals.css).
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
