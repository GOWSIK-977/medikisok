"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession, saveActiveSession } from "@/lib/registry";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
];

export default function KioskWelcome() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");

  function begin() {
    clearActiveSession();
    saveActiveSession({ language });
    router.push("/kiosk/identify");
  }

  return (
    <div style={{ textAlign: "center" }}>
      <p className="eyebrow">Patient kiosk</p>
      <h1 style={{ fontSize: 34, marginTop: 8, marginBottom: 12 }}>Welcome to AIIA</h1>
      <p style={{ color: "var(--slate)", fontSize: 16.5, marginBottom: 32 }}>
        We&rsquo;ll ask a few questions about why you&rsquo;re here today. A doctor
        reviews everything before it goes into your record.
      </p>

      <div className="card" style={{ textAlign: "left", marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Choose your language</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className="btn btn-sm"
              onClick={() => setLanguage(l.code)}
              style={{
                border: "1.5px solid var(--line)",
                background: language === l.code ? "var(--teal)" : "var(--surface)",
                color: language === l.code ? "#fff" : "var(--ink)",
                fontSize: 16,
                padding: "10px 20px",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={begin}>
        Continue
      </button>
    </div>
  );
}
