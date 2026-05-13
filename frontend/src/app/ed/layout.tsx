import "./ed.css";

export default function EDLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ed-shell" style={{ minHeight: "100vh" }}>
      {children}
    </div>
  );
}
