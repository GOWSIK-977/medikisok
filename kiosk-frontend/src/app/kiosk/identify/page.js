"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startSession, validateAbha } from "@/lib/api";
import { loadActiveSession, saveActiveSession, upsertQueueEntry } from "@/lib/registry";

export default function IdentifyPage() {
  const router = useRouter();

  // ABHA Login Option: null | "yes" | "no"
  const [hasAbhaOption, setHasAbhaOption] = useState(null);

  // If HAS ABHA ID ("yes")
  const [abhaInput, setAbhaInput] = useState("");
  const [validatingAbha, setValidatingAbha] = useState(false);
  const [abhaSuccessMessage, setAbhaSuccessMessage] = useState(null);
  const [abhaErrorMessage, setAbhaErrorMessage] = useState(null);
  const [validatedProfile, setValidatedProfile] = useState(null);

  // If DOES NOT HAVE ABHA ID ("no")
  const [willingToCreate, setWillingToCreate] = useState(null); // null | "yes" | "no"

  // Patient Demographic Form
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleVerifyAbha() {
    setAbhaErrorMessage(null);
    setAbhaSuccessMessage(null);
    setValidatedProfile(null);

    if (!abhaInput.trim()) {
      setAbhaErrorMessage("Please enter your ABHA Number or ABHA Address.");
      return;
    }

    setValidatingAbha(true);
    try {
      const res = await validateAbha(abhaInput.trim());
      if (res.valid) {
        setAbhaSuccessMessage(res.message || "Valid Original Card Checked");
        setValidatedProfile(res.profile || { abhaAddress: abhaInput.trim() });

        // Auto-fill patient name, age, and gender from verified ABHA profile
        if (res.profile?.name) setName(res.profile.name);
        if (res.profile?.age) setAge(String(res.profile.age));
        if (res.profile?.gender) setGender(res.profile.gender);
      } else {
        setAbhaErrorMessage(res.message || "Invalid ABHA ID. Card details not found.");
      }
    } catch (err) {
      setAbhaErrorMessage(err.message || "Invalid ABHA ID or Card details not found.");
    } finally {
      setValidatingAbha(false);
    }
  }

  function handleCreateAbhaRedirect() {
    window.open("https://abha.abdm.gov.in/abha/v3", "_blank");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!hasAbhaOption) {
      setError("Please select whether you have an ABHA ID.");
      return;
    }

    if (hasAbhaOption === "yes" && !validatedProfile) {
      setError("Please verify your ABHA ID before continuing.");
      return;
    }

    if (hasAbhaOption === "no" && willingToCreate === null) {
      setError("Please indicate if you are willing to create an ABHA ID.");
      return;
    }

    if (!name.trim() || !age) {
      setError("Please enter the patient's name and age.");
      return;
    }

    setLoading(true);
    try {
      const active = loadActiveSession();

      const finalAbhaId =
        hasAbhaOption === "yes"
          ? validatedProfile?.abhaAddress || validatedProfile?.abhaNumber || abhaInput.trim()
          : willingToCreate === "yes"
          ? "PENDING_CREATION"
          : "NOT_REGISTERED";

      const department = active?.department || "GENERAL_MEDICINE";

      const { sessionId, ...first } = await startSession({
        name: name.trim(),
        age: Number(age),
        gender,
        language: active?.language || "en",
        department,
      });

      saveActiveSession({
        sessionId,
        name: name.trim(),
        age: Number(age),
        gender,
        department,
        abhaId: finalAbhaId,
        firstQuestion: first.question || first.nextQuestion || first,
        redFlags: [],
        sessionComplete: false,
      });

      upsertQueueEntry(sessionId, {
        name: name.trim(),
        age: Number(age),
        gender,
        department,
        language: active?.language || "en",
        abhaId: finalAbhaId,
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
      <h1 style={{ fontSize: 30, marginTop: 8, marginBottom: 6 }}>Patient Identification</h1>
      <p style={{ color: "var(--slate)", marginBottom: 24 }}>
        Choose your ABHA ID login preference to begin patient intake.
      </p>

      {/* LOGIN OPTIONS SECTION */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 14 }}>
          Do you have an ABHA ID (Ayushman Bharat Health Account)?
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setHasAbhaOption("yes");
              setWillingToCreate(null);
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "12px 18px",
              border: "1.5px solid var(--line)",
              background: hasAbhaOption === "yes" ? "var(--teal)" : "var(--surface)",
              color: hasAbhaOption === "yes" ? "#fff" : "var(--ink)",
            }}
          >
            ✓ I have an ABHA ID
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setHasAbhaOption("no");
              setAbhaSuccessMessage(null);
              setAbhaErrorMessage(null);
              setValidatedProfile(null);
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "12px 18px",
              border: "1.5px solid var(--line)",
              background: hasAbhaOption === "no" ? "var(--teal)" : "var(--surface)",
              color: hasAbhaOption === "no" ? "#fff" : "var(--ink)",
            }}
          >
            ✕ I do NOT have an ABHA ID
          </button>
        </div>
      </div>

      {/* OPTION 1: USER HAS ABHA ID */}
      {hasAbhaOption === "yes" && (
        <div className="card" style={{ marginBottom: 24, background: "var(--paper)" }}>
          <span className="tag">ABHA Verification</span>
          <div style={{ marginTop: 12 }} className="field">
            <label htmlFor="abhaInput">Enter ABHA Number (14-digit) or ABHA Address</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="abhaInput"
                value={abhaInput}
                onChange={(e) => {
                  setAbhaInput(e.target.value);
                  setAbhaSuccessMessage(null);
                  setAbhaErrorMessage(null);
                  setValidatedProfile(null);
                }}
                placeholder="e.g. 91-7867-6724-4217 or navaneethanrs_18@abdm"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleVerifyAbha}
                disabled={validatingAbha}
              >
                {validatingAbha ? "Validating…" : "Verify ABHA ID"}
              </button>
            </div>
          </div>

          {abhaSuccessMessage && (
            <div className="banner banner-green" style={{ marginTop: 12 }}>
              <div>
                <strong>✓ {abhaSuccessMessage}</strong>
                {validatedProfile && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    ABHA Number: <code>{validatedProfile.abhaNumber}</code> | Address: <code>{validatedProfile.abhaAddress}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {abhaErrorMessage && (
            <div className="banner banner-red" style={{ marginTop: 12 }}>
              ✖ {abhaErrorMessage}
            </div>
          )}
        </div>
      )}

      {/* OPTION 2: USER DOES NOT HAVE ABHA ID */}
      {hasAbhaOption === "no" && (
        <div className="card" style={{ marginBottom: 24, background: "var(--paper)" }}>
          <span className="tag">ABHA Creation</span>
          <div style={{ fontWeight: 600, fontSize: 15, marginTop: 10, marginBottom: 12 }}>
            Are you willing to create an ABHA ID?
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setWillingToCreate("yes");
                handleCreateAbhaRedirect();
              }}
              style={{
                background: willingToCreate === "yes" ? "var(--teal)" : "var(--surface)",
                color: willingToCreate === "yes" ? "#fff" : "var(--ink)",
                border: "1.5px solid var(--line)",
              }}
            >
              Yes, Create ABHA ID (Redirect to Official Site)
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setWillingToCreate("no")}
              style={{
                background: willingToCreate === "no" ? "var(--teal)" : "var(--surface)",
                color: willingToCreate === "no" ? "#fff" : "var(--ink)",
                border: "1.5px solid var(--line)",
              }}
            >
              No, Continue Without ABHA ID
            </button>
          </div>

          {willingToCreate === "yes" && (
            <div className="banner banner-amber">
              ℹ Redirecting to official portal (https://abha.abdm.gov.in/abha/v3). You can complete registration there and fill in your details below to continue.
            </div>
          )}

          {willingToCreate === "no" && (
            <div className="banner banner-green">
              ✓ Continuing as guest intake without ABHA ID.
            </div>
          )}
        </div>
      )}

      {/* DEMOGRAPHIC FORM */}
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
