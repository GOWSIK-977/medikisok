import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <svg
        width="280"
        height="48"
        viewBox="0 0 280 48"
        fill="none"
        style={{ marginBottom: 8 }}
        aria-hidden="true"
      >
        <path
          d="M0 24 H90 L100 6 L112 42 L122 24 H160 L168 14 L176 24 H280"
          stroke="#0e7c7b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="eyebrow" style={{ marginBottom: 10 }}>
        SIH26047 · Ministry of Ayush · AIIA
      </p>
      <h1 style={{ fontSize: 44, marginBottom: 12 }}>MediKiosk</h1>
      <p style={{ color: "var(--slate)", maxWidth: 460, marginBottom: 40, fontSize: 16.5 }}>
        AI takes the case history. The physician makes every clinical call.
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/kiosk" className="btn btn-primary">
          Start patient kiosk
        </Link>
        <Link href="/dashboard" className="btn btn-secondary">
          Open doctor dashboard
        </Link>
      </div>
    </main>
  );
}
