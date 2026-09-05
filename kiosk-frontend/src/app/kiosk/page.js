"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession, saveActiveSession } from "@/lib/registry";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
];

const DEPARTMENTS = [
  { code: "GENERAL_MEDICINE", label: "🏥 General Medicine OPD", desc: "Standard OPD clinical intake & history" },
  { code: "AYUSH", label: "🌿 AYUSH OPD", desc: "Ayurveda intake & Dashavidha Pariksha (10-fold examination)" },
];

export default function KioskWelcome() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");
  const [department, setDepartment] = useState("GENERAL_MEDICINE");

  function begin() {
    clearActiveSession();
    saveActiveSession({ language, department });
    router.push("/kiosk/identify");
  }

  return (
    <div style={{ textAlign: "center" }}>
      <p className="eyebrow">Patient kiosk</p>
      <h1 style={{ fontSize: 34, marginTop: 8, marginBottom: 12 }}>Welcome to AIIA</h1>
      <p style={{ color: "var(--slate)", fontSize: 16.5, marginBottom: 28 }}>
        Select your department and language to begin intake.
      </p>

      {/* DEPARTMENT SELECTION */}
      <div className="card" style={{ textAlign: "left", marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>1. Choose OPD Department</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DEPARTMENTS.map((d) => (
            <button
              key={d.code}
              type="button"
              className="btn"
              onClick={() => setDepartment(d.code)}
              style={{
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "14px 18px",
                border: department === d.code ? "2px solid var(--teal)" : "1.5px solid var(--line)",
                background: department === d.code ? "var(--teal-tint)" : "var(--surface)",
                color: "var(--ink)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>{d.label}</div>
              <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 2 }}>{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* LANGUAGE SELECTION */}
      <div className="card" style={{ textAlign: "left", marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>2. Choose your language</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className="btn btn-sm"
              onClick={() => setLanguage(l.code)}
              style={{
                border: "1.5px solid var(--line)",
                background: language === l.code ? "var(--teal)" : "var(--surface)",
                color: language === l.code ? "#fff" : "var(--ink)",
                fontSize: 15,
                padding: "10px 18px",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: "100%", padding: "14px" }} onClick={begin}>
        Continue to Patient Identification ➔
      </button>
    </div>
  );
}
