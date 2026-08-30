"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClinicalSummary, getDocuments, generateFinalSummary, translateSummary } from "@/lib/api";
import { getQueueEntry, upsertQueueEntry } from "@/lib/registry";
import { buildMockFhirBundle } from "@/lib/fhir";
import RedFlagBanner from "@/components/RedFlagBanner";

function titleCase(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Generic renderer for the structured-history sections so the
// dashboard doesn't have to hardcode every field the schema defines.
function Field({ value }) {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--slate-soft)" }}>—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "var(--slate-soft)" }}>—</span>;
    return (
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {value.map((v, i) => (
          <li key={i}>{typeof v === "object" ? <Field value={v} /> : String(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
        {Object.entries(value)
          .filter(([k]) => k !== "source")
          .map(([k, v]) => (
            <div key={k}>
              <span style={{ color: "var(--slate)" }}>{titleCase(k)}: </span>
              <Field value={v} />
            </div>
          ))}
      </div>
    );
  }
  return <>{String(value)}</>;
}

function Section({ title, data }) {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      <Field value={data} />
    </div>
  );
}

const SECTION_KEYS = [
  ["chief_complaint", "Chief Complaint"],
  ["hpi", "History of Present Illness"],
  ["review_of_systems", "Review of Systems"],
  ["past_medical_history", "Past Medical History"],
  ["past_surgical_history", "Past Surgical History"],
  ["drug_allergy_history", "Drug & Allergy History"],
  ["family_history", "Family History"],
  ["personal_history", "Personal History"],
  ["ayush_history", "AYUSH History"],
];

export default function PatientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [queueEntry, setQueueEntry] = useState(null);
  const [summary, setSummary] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [fhirBundle, setFhirBundle] = useState(null);
  const [summaryLang, setSummaryLang] = useState("en");
  const [langCache, setLangCache] = useState({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    const entry = getQueueEntry(id);
    setQueueEntry(entry);
    try {
      if (entry?.summary) {
        setSummary(entry.summary);
        const text = entry.summary.clinical_summary_text || "";
        setEditedText(text);
        setLangCache({ en: text });
      } else {
        const clinicalHistory = await getClinicalSummary(id);
        setSummary(clinicalHistory);
        const text = clinicalHistory.clinical_summary_text || "";
        setEditedText(text);
        setLangCache({ en: text });
      }
      const docs = await getDocuments(id).catch(() => []);
      setDocuments(Array.isArray(docs) ? docs : docs.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLanguageChange(targetLang) {
    if (targetLang === summaryLang || translating) return;
    if (langCache[targetLang]) {
      setSummaryLang(targetLang);
      setEditedText(langCache[targetLang]);
      return;
    }

    setTranslating(true);
    try {
      const res = await translateSummary(id, editedText, targetLang);
      const translated = res.summaryText || editedText;
      setLangCache((prev) => ({ ...prev, [targetLang]: translated }));
      setSummaryLang(targetLang);
      setEditedText(translated);
    } catch (err) {
      setError("Translation failed: " + err.message);
    } finally {
      setTranslating(false);
    }
  }

  function handleSpeakSummary() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(editedText);
    utterance.lang = summaryLang === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  async function handleGenerateMerged() {
    setLoading(true);
    setError(null);
    try {
      const clinicalHistory = await getClinicalSummary(id);
      const merged = await generateFinalSummary(id, clinicalHistory, summaryLang);
      setSummary(merged);
      setEditedText(merged.clinical_summary_text || "");
      setLangCache({ [summaryLang]: merged.clinical_summary_text || "" });
      upsertQueueEntry(id, { summary: merged, redFlags: merged.red_flags || [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    const finalSummary = {
      ...summary,
      clinical_summary_text: editedText,
      meta: {
        ...(summary?.meta || {}),
        session_id: id,
        physician_edits: {
          ...(summary?.meta?.physician_edits || {}),
          confirmed: true,
          edited: editedText !== summary?.clinical_summary_text,
          editedAt: new Date().toISOString(),
          reviewedBy: "demo-doctor",
        },
      },
    };
    setSummary(finalSummary);
    upsertQueueEntry(id, { status: "confirmed", summary: finalSummary });
    setFhirBundle(buildMockFhirBundle(finalSummary));
  }

  function handleReject() {
    upsertQueueEntry(id, { status: "in_progress" });
    router.push("/dashboard");
  }

  if (loading) {
    return <main style={{ maxWidth: 800, margin: "0 auto", padding: 40 }}>Loading patient…</main>;
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }} onClick={() => router.push("/dashboard")}>
        ← Queue
      </button>

      <p className="eyebrow">Patient record</p>
      <h1 style={{ fontSize: 30, marginTop: 6, marginBottom: 4 }}>{queueEntry?.name || summary?.patient?.name || "Patient"}</h1>
      <p style={{ color: "var(--slate)", marginBottom: 24 }}>
        {queueEntry?.age ? `${queueEntry.age} yrs` : ""} {queueEntry?.gender ? `· ${queueEntry.gender}` : ""}{" "}
        {queueEntry?.abhaId ? `· ${queueEntry.abhaId}` : ""}
      </p>

      {error && <div className="banner banner-red" style={{ marginBottom: 20 }}>{error}</div>}

      <RedFlagBanner flags={summary?.red_flags} tone="red" />

      {!summary?.clinical_summary_text && (
        <div className="card" style={{ margin: "18px 0", textAlign: "center" }}>
          <p style={{ color: "var(--slate)", marginBottom: 12 }}>
            The merged AI summary hasn&rsquo;t been generated for this session yet.
          </p>
          <button className="btn btn-primary" onClick={handleGenerateMerged}>
            Generate merged summary
          </button>
        </div>
      )}

      {summary?.clinical_summary_text && (
        <div className="card" style={{ margin: "18px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="eyebrow">AI-generated summary</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Doctor Language Toggle */}
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  className="btn btn-sm"
                  style={{
                    borderRadius: 0,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: summaryLang === "en" ? "var(--teal-dark)" : "transparent",
                    color: summaryLang === "en" ? "#fff" : "var(--slate)",
                  }}
                  onClick={() => handleLanguageChange("en")}
                  disabled={translating}
                >
                  English
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    borderRadius: 0,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: summaryLang === "hi" ? "var(--teal-dark)" : "transparent",
                    color: summaryLang === "hi" ? "#fff" : "var(--slate)",
                  }}
                  onClick={() => handleLanguageChange("hi")}
                  disabled={translating}
                >
                  हिंदी
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    borderRadius: 0,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: summaryLang === "ta" ? "var(--teal-dark)" : "transparent",
                    color: summaryLang === "ta" ? "#fff" : "var(--slate)",
                  }}
                  onClick={() => handleLanguageChange("ta")}
                  disabled={translating}
                >
                  தமிழ்
                </button>
              </div>

              {/* TTS Audio Button */}
              <button className="btn btn-secondary btn-sm" onClick={handleSpeakSummary} title="Read Aloud">
                🔊 Listen
              </button>

              {!fhirBundle && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing((e) => !e)}>
                  {editing ? "Cancel edit" : "Edit"}
                </button>
              )}
            </div>
          </div>

          {translating && <div style={{ fontSize: 13, color: "var(--slate)", marginBottom: 8 }}>Translating clinical summary…</div>}

          {editing ? (
            <textarea
              rows={7}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              style={{ width: "100%", fontFamily: "var(--font-body)", fontSize: 15, padding: 12, borderRadius: 10, border: "1.5px solid var(--line)" }}
            />
          ) : (
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{editedText}</p>
          )}
        </div>
      )}

      {documents?.length > 0 && (
        <Section
          title="Extracted Documents"
          data={documents.map((d) => ({
            type: d.documentType || d.type,
            date: d.date,
            findings: d.extractedText ? undefined : d,
          }))}
        />
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        {SECTION_KEYS.map(([key, label]) => (
          <Section key={key} title={label} data={summary?.[key]} />
        ))}
      </div>

      {fhirBundle ? (
        <div className="card" style={{ background: "var(--teal-tint)", border: "none" }}>
          <div className="eyebrow" style={{ marginBottom: 8, color: "var(--teal-dark)" }}>
            Pushed to ABDM / HIS (mock)
          </div>
          <p style={{ marginBottom: 12 }}>
            Confirmed by physician and submitted. No real ABDM/FHIR endpoint is called in this demo — this is the payload that would be sent.
          </p>
          <pre
            style={{
              background: "#0f1b1b",
              color: "#c9e9e6",
              padding: 16,
              borderRadius: 10,
              fontSize: 12.5,
              overflowX: "auto",
              fontFamily: "var(--font-mono)",
            }}
          >
            {JSON.stringify(fhirBundle, null, 2)}
          </pre>
        </div>
      ) : (
        summary?.clinical_summary_text && (
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirm}>
              Confirm & submit
            </button>
            <button className="btn btn-secondary" onClick={handleReject}>
              Send back to interview
            </button>
          </div>
        )
      )}
    </main>
  );
}
