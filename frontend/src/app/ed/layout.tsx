import "./ed.css";
import EDProviders from "./providers";

export default function EDLayout({ children }: { children: React.ReactNode }) {
  return (
    <EDProviders>
      <div className="ed-shell" style={{ minHeight: "100vh" }}>
        {children}
      </div>
    </EDProviders>
  );
}
