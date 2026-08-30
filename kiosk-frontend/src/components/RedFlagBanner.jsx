"use client";

export default function RedFlagBanner({ flags, tone = "red" }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className={`banner banner-${tone}`} role="alert">
      <span aria-hidden="true">&#9888;</span>
      <div>
        <strong>{flags.length === 1 ? "Red flag detected" : `${flags.length} red flags detected`}</strong>
        <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
          {flags.map((f, i) => (
            <li key={i}>{typeof f === "string" ? f : f.label || f.type || JSON.stringify(f)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
