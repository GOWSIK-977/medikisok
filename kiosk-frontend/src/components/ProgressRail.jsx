"use client";

const STEPS = ["Welcome", "Identify", "Consent", "Interview", "Documents", "Review"];

export default function ProgressRail({ step }) {
  return (
    <div style={{ padding: "18px 28px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", maxWidth: 900, margin: "0 auto" }}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: active ? 14 : 10,
                    height: active ? 14 : 10,
                    borderRadius: "50%",
                    background: done || active ? "var(--teal)" : "var(--line)",
                    boxShadow: active ? "0 0 0 5px var(--teal-tint)" : "none",
                    transition: "all 0.2s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: 11.5,
                    fontFamily: "var(--font-mono)",
                    color: active ? "var(--teal-dark)" : "var(--slate-soft)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    margin: "0 6px 18px",
                    background: i < step ? "var(--teal)" : "var(--line)",
                    transition: "background 0.2s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
