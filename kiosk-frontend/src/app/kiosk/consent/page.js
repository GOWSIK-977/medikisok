"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveActiveSession, loadActiveSession } from "@/lib/registry";

const POINTS = [
  "An AI assistant will ask you questions about your symptoms and history.",
  "Your answers, and any documents you upload, will be shown to your doctor.",
  "A doctor reviews and confirms everything before it is saved to your record — the AI does not diagnose you.",
  "You can ask a staff member for help at any point.",
];

export default function ConsentPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  function handleContinue() {
    const active = loadActiveSession();
    if (!active?.sessionId) {
      router.push("/kiosk/identify");
      return;
    }
    saveActiveSession({ consentGiven: true, consentAt: Date.now() });
    router.push("/kiosk/interview");
  }

  return (
    <div>
      <p className="eyebrow">Step 3 of 6</p>
      <h1 style={{ fontSize: 30, marginTop: 8, marginBottom: 6 }}>Before we begin</h1>
      <p style={{ color: "var(--slate)", marginBottom: 24 }}>
        Please read this and confirm you&rsquo;re comfortable continuing.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {POINTS.map((p, i) => (
            <li key={i} style={{ lineHeight: 1.5 }}>{p}</li>
          ))}
        </ul>
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 24, cursor: "pointer" }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
        <span>I understand and consent to this process.</span>
      </label>

      <button className="btn btn-primary" style={{ width: "100%" }} disabled={!agreed} onClick={handleContinue}>
        Begin interview
      </button>
    </div>
  );
}
