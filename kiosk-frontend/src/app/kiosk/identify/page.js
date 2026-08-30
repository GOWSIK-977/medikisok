"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startSession } from "@/lib/api";
import { loadActiveSession, saveActiveSession, upsertQueueEntry } from "@/lib/registry";

function mockAbhaId() {
  const n = () => Math.floor(1000 + Math.random() * 9000);
  return `${n()}-${n()}-${n()}`;
}

export default function IdentifyPage() {
  const router = useRouter();
  const [abhaId] = useState(mockAbhaId);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !age) {
      setError("Please enter the patient's name and age.");
      return;
    }
    setLoading(true);
    try {
      const active = loadActiveSession();
      const { sessionId, ...first } = await startSession({
        name: name.trim(),
        age: Number(age),
        gender,
        language: active?.language || "en",
      });

      saveActiveSession({
        sessionId,
        name: name.trim(),
        age: Number(age),
        gender,
        abhaId,
        firstQuestion: first.question || first.nextQuestion || first,
        redFlags: [],
        sessionComplete: false,
      });

      upsertQueueEntry(sessionId, {
        name: name.trim(),
        age: Number(age),
        gender,
        abhaId,
        status: "in_progress",
        redFlags: [],
      });

      router.push("/kiosk/consent");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="eyebrow">Step 2 of 6</p>
      <h1 style={{ fontSize: 30, marginTop: 8, marginBottom: 6 }}>Who is this visit for?</h1>
      <p style={{ color: "var(--slate)", marginBottom: 24 }}>
        A demo ABHA ID has been generated for this session.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <span className="tag">Mock ABHA ID</span>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, marginTop: 8 }}>{abhaId}</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="age">Age</label>
            <input id="age" type="number" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="gender">Gender</label>
            <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {error && <div className="banner banner-red" style={{ marginBottom: 16 }}>{error}</div>}

        <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Starting session…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
