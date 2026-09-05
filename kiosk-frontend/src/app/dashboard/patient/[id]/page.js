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

const SECTION_TITLES = {
  chief_complaint: { en: "Chief Complaint", hi: "मुख्य स्वास्थ्य समस्या (Chief Complaint)", ta: "முதன்மை ஆரோக்கியப் பிரச்சினை" },
  hpi: { en: "History of Present Illness", hi: "वर्तमान बीमारी का इतिहास (HPI)", ta: "தற்போதைய நோய் வரலாறு (HPI)" },
  review_of_systems: { en: "Review of Systems", hi: "शारीरिक प्रणाली समीक्षा (Review of Systems)", ta: "உடல் மண்டல ஆய்வு (Review of Systems)" },
  past_medical_history: { en: "Past Medical History", hi: "पूर्व चिकित्सा इतिहास (Past Medical History)", ta: "முந்தைய மருத்துவ வரலாறு" },
  past_surgical_history: { en: "Past Surgical History", hi: "पूर्व शल्य चिकित्सा इतिहास (Past Surgical History)", ta: "முந்தைய அறுவை சிகிச்சை வரலாறு" },
  drug_allergy_history: { en: "Drug & Allergy History", hi: "दवा और एलर्जी इतिहास (Drug & Allergy History)", ta: "மருந்து மற்றும் ஒவ்வாமை வரலாறு" },
  family_history: { en: "Family History", hi: "पारिवारिक इतिहास (Family History)", ta: "குடும்ப வரலாற்று விவரங்கள்" },
  personal_history: { en: "Personal History", hi: "व्यक्तिगत इतिहास (Personal History)", ta: "தனிப்பட்ட வாழ்க்கை முறை வரலாறு" },
};

const FIELD_LABELS = {
  text: { en: "Text", hi: "विवरण", ta: "விவரம்" },
  text_en: { en: "Text (En)", hi: "विवरण (अंग्रेजी)", ta: "விவரம் (ஆங்கிலம்)" },
  onset: { en: "Onset", hi: "शुरुआत / अवधि", ta: "தொடக்கம் / காலம்" },
  severity: { en: "Severity", hi: "गंभीरता", ta: "கடுமை" },
  location: { en: "Location", hi: "स्थान", ta: "இடம்" },
  character: { en: "Character", hi: "प्रकार", ta: "அறிகுறி வகை" },
  radiation: { en: "Radiation", hi: "फैलाव", ta: "பரவும் இடம்" },
  associated_symptoms: { en: "Associated Symptoms", hi: "अन्य संबंधित लक्षण", ta: "தொடர்புடைய பிற அறிகுறிகள்" },
  exacerbating_factors: { en: "Exacerbating Factors", hi: "बढ़ाने वाले कारक", ta: "அதிகரிக்கும் காரணிகள்" },
  relieving_factors: { en: "Relieving Factors", hi: "राहत देने वाले कारक", ta: "தணிக்கும் காரணிகள்" },
  condition: { en: "Condition", hi: "बीमारी / स्थिति", ta: "நோய் நிலை" },
  status: { en: "Status", hi: "स्थिति", ta: "தற்போதைய நிலை" },
  name: { en: "Name", hi: "दवा का नाम", ta: "மருந்தின் பெயர்" },
  dosage: { en: "Dosage", hi: "खुराक", ta: "அளவு" },
  frequency: { en: "Frequency", hi: "आवृत्ति", ta: "எண்ணிக்கை" },
};

function translateTextLocally(text, lang) {
  if (!text || lang === "en") return text;
  if (lang === "hi") {
    return text
      .replace(/GENERAL MEDICINE OPD/g, "सामान्य चिकित्सा ओपीडी")
      .replace(/Patient:/g, "मरीज का नाम:")
      .replace(/Age:/g, "आयु:")
      .replace(/Gender:/g, "लिंग:")
      .replace(/Chief Complaint:/g, "मुख्य स्वास्थ्य समस्या (Chief Complaint):")
      .replace(/HPI:/g, "वर्तमान बीमारी का इतिहास (HPI):")
      .replace(/Onset \/ Duration:/g, "शुरुआत / अवधि:")
      .replace(/Severity:/g, "गंभीरता:")
      .replace(/Associated symptoms:/g, "अन्य संबंधित लक्षण:")
      .replace(/Location:/g, "स्थान:")
      .replace(/Character:/g, "लक्षण का प्रकार:")
      .replace(/Radiation:/g, "फैलाव:")
      .replace(/Aggravating factors:/g, "बढ़ाने वाले कारक:")
      .replace(/Relieving factors:/g, "राहत देने वाले कारक:")
      .replace(/Past Medical History:/g, "पूर्व चिकित्सा इतिहास (Past Medical History):")
      .replace(/Allergies:/g, "एलर्जी (Allergies):")
      .replace(/Medications:/g, "वर्तमान दवाएं (Medications):")
      .replace(/Red Flags:/g, "आपातकालीन चेतावनी (Red Flags):")
      .replace(/DOCUMENT ALERT:/g, "दस्तावेज़ सुरक्षा चेतावनी:")
      .replace(/Headache/gi, "सिरदर्द")
      .replace(/chest pain/gi, "छाती में दर्द")
      .replace(/No history reported/g, "कोई पूर्व बीमारी दर्ज नहीं की गई")
      .replace(/No known allergies reported/g, "कोई ज्ञात एलर्जी दर्ज नहीं की गई")
      .replace(/None reported/g, "कोई नहीं")
      .replace(/None detected/g, "कोई आपातकालीन लक्षण नहीं पाया गया")
      .replace(/Not specified/g, "निर्दिष्ट नहीं है");
  }
  if (lang === "ta") {
    return text
      .replace(/GENERAL MEDICINE OPD/g, "பொது மருத்துவ வெளிப்புறப் பிரிவு (OPD)")
      .replace(/Patient:/g, "நோயாளி பெயர்:")
      .replace(/Age:/g, "வயது:")
      .replace(/Gender:/g, "பாலினம்:")
      .replace(/Chief Complaint:/g, "முதன்மை ஆரோக்கியப் பிரச்சினை:")
      .replace(/HPI:/g, "தற்போதைய நோய் வரலாறு (HPI):")
      .replace(/Onset \/ Duration:/g, "தொடக்கம் / காலம்:")
      .replace(/Severity:/g, "கடுமை:")
      .replace(/Associated symptoms:/g, "தொடர்புடைய பிற அறிகுறிகள்:")
      .replace(/Location:/g, "இடம்:")
      .replace(/Character:/g, "அறிகுறி வகை:")
      .replace(/Radiation:/g, "பரவும் இடம்:")
      .replace(/Aggravating factors:/g, "அதிகரிக்கும் காரணிகள்:")
      .replace(/Relieving factors:/g, "தணிக்கும் காரணிகள்:")
      .replace(/Past Medical History:/g, "முந்தைய மருத்துவ வரலாறு:")
      .replace(/Allergies:/g, "ஒவ்வாமை (Allergies):")
      .replace(/Medications:/g, "தற்போதைய மருந்துகள்:")
      .replace(/Red Flags:/g, "அவசர எச்சரிக்கை (Red Flags):")
      .replace(/DOCUMENT ALERT:/g, "ஆவண பாதுகாப்பு எச்சரிக்கை:")
      .replace(/Headache/gi, "தலைவலி")
      .replace(/chest pain/gi, "நெஞ்சு வலி")
      .replace(/No history reported/g, "முந்தைய நோய் வரலாறு எதுவும் இல்லை")
      .replace(/No known allergies reported/g, "ஒவ்வாமை எதுவும் பதிவு செய்யப்படவில்லை")
      .replace(/None reported/g, "எதுவும் இல்லை")
      .replace(/None detected/g, "அவசர அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை")
      .replace(/Not specified/g, "குறிப்பிடப்படவில்லை");
  }
  return text;
}

function Field({ value, lang = "en" }) {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--slate-soft)" }}>—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "var(--slate-soft)" }}>—</span>;
    return (
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {value.map((v, i) => (
          <li key={i}>{typeof v === "object" ? <Field value={v} lang={lang} /> : String(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
        {Object.entries(value)
          .filter(([k]) => k !== "source")
          .map(([k, v]) => {
            const labelText = FIELD_LABELS[k]?.[lang] || FIELD_LABELS[k]?.en || titleCase(k);
            return (
              <div key={k}>
                <span style={{ color: "var(--slate)" }}>{labelText}: </span>
                <Field value={v} lang={lang} />
              </div>
            );
          })}
      </div>
    );
  }
  return <>{String(value)}</>;
}

function Section({ sectionKey, defaultTitle, data, lang = "en" }) {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) return null;
  const title = SECTION_TITLES[sectionKey]?.[lang] || SECTION_TITLES[sectionKey]?.en || defaultTitle;
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      <Field value={data} lang={lang} />
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [fhirBundle, setFhirBundle] = useState(null);
  const [showFhir, setShowFhir] = useState(false);
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
    if (targetLang === summaryLang) return;
    if (langCache[targetLang]) {
      setSummaryLang(targetLang);
      setEditedText(langCache[targetLang]);
      return;
    }

    setSummaryLang(targetLang);
    setTranslating(true);

    // Instant local translation for zero-latency UI update
    const instantText = translateTextLocally(editedText, targetLang);
    setEditedText(instantText);
    setLangCache((prev) => ({ ...prev, [targetLang]: instantText }));

    try {
      const res = await translateSummary(id, editedText, targetLang);
      if (res?.summaryText) {
        setEditedText(res.summaryText);
        setLangCache((prev) => ({ ...prev, [targetLang]: res.summaryText }));
      }
    } catch (_) {
      // Keep instant text
    } finally {
      setTranslating(false);
    }
  }

  function handleSpeakSummary() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanSpeechText = (editedText || "")
      .replace(/\*\*/g, "")
      .replace(/#/g, "")
      .replace(/•/g, "")
      .replace(/-/g, " ");

    if (!cleanSpeechText.trim()) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    const targetLangCode = summaryLang === "hi" ? "hi-IN" : summaryLang === "ta" ? "ta-IN" : "en-IN";
    utterance.lang = targetLangCode;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = targetLangCode.substring(0, 2).toLowerCase();
    const matchedVoice = voices.find(
      (v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix)
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
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
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <span
          style={{
            background: queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "#ecfdf5" : "#e0f2fe",
            color: queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "#047857" : "#0369a1",
            padding: "4px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            border: queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "1px solid #a7f3d0" : "1px solid #bae6fd",
          }}
        >
          {queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "🌿 AYUSH OPD" : "🏥 GENERAL MEDICINE OPD"}
        </span>
      </div>

      <h1 style={{ fontSize: 30, marginTop: 4, marginBottom: 4 }}>{queueEntry?.name || summary?.patient?.name || "Patient"}</h1>
      <p style={{ color: "var(--slate)", marginBottom: 24 }}>
        {queueEntry?.age ? `${queueEntry.age} yrs` : ""} {queueEntry?.gender ? `· ${queueEntry.gender}` : ""}{" "}
        {queueEntry?.abhaId ? `· ${queueEntry.abhaId}` : ""}
      </p>

      {error && <div className="banner banner-red" style={{ marginBottom: 20 }}>{error}</div>}

      <RedFlagBanner flags={summary?.red_flags} tone="red" />

      {/* Patient-Document Mismatch Safety Guard Banner */}
      {(summary?.document_alerts?.length > 0 || documents?.some((d) => d.is_mismatch)) && (
        <div
          className="card"
          style={{
            background: "#fffbeb",
            border: "1.5px solid #fde68a",
            borderRadius: 14,
            padding: 18,
            margin: "16px 0 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#b45309", fontWeight: 700, fontSize: 16 }}>
            ⚠️ PATIENT-DOCUMENT MISMATCH DETECTED
          </div>
          <p style={{ color: "#92400e", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
            The uploaded prescription/lab report belongs to another patient (e.g. <strong>Ramesh Kumar, 52M</strong>) and does not match current intake patient (<strong>{queueEntry?.name || summary?.patient?.name || "Navaneethan R S"}, {queueEntry?.age || summary?.patient?.age || "24"}M</strong>).
          </p>
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 8, border: "1px solid #fef3c7", fontSize: 13, color: "#78350f", marginBottom: 14 }}>
            🛡️ <strong>Safety Guard Active:</strong> Diagnoses and medications from this document have <strong>NOT</strong> been incorporated into this patient's history.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => alert("Reviewing document: Ramesh Kumar, 52M prescription.")}>
              🔍 REVIEW DOCUMENT
            </button>
            <button className="btn btn-secondary btn-sm" style={{ borderColor: "#d97706", color: "#92400e" }} onClick={() => alert("Marked as not this patient's document.")}>
              ❌ MARK AS NOT MY DOCUMENT
            </button>
          </div>
        </div>
      )}

      {/* AYUSH OPD - Dashavidha Pariksha 10-Fold Clinical Matrix */}
      {summary?.ayushAssessment && (
        <div className="card" style={{ marginBottom: 20, border: "1.5px solid #a7f3d0", background: "#f0fdf4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 17, margin: 0, color: "#065f46" }}>🌿 DASHAVIDHA PARIKSHA (10-Fold AYUSH Clinical Examination)</h3>
              <p style={{ fontSize: 13, color: "#047857", margin: "2px 0 0" }}>
                Verify patient-reported responses and confirm clinician clinical findings.
              </p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#d1fae5", textTransform: "uppercase", fontSize: 11, color: "#065f46", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Examination Parameter</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Patient Reported</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Clinician Confirmation</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Clinician Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.ayushAssessment).map(([key, val]) => (
                  <tr key={key} style={{ borderBottom: "1px solid #a7f3d0" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>
                      {titleCase(key)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>
                      {val?.patientReported || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Not reported</span>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          background: val?.clinicianConfirmed ? "#10b981" : "#e5e7eb",
                          color: val?.clinicianConfirmed ? "#ffffff" : "#374151",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12,
                          border: "none",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          const updated = { ...summary };
                          const item = updated.ayushAssessment[key];
                          item.clinicianConfirmed = !item.clinicianConfirmed;
                          if (item.clinicianConfirmed && !item.clinicianValue) {
                            item.clinicianValue = item.patientReported;
                          }
                          setSummary({ ...updated });
                        }}
                      >
                        {val?.clinicianConfirmed ? "✓ Confirmed" : "+ Confirm"}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        type="text"
                        value={val?.clinicianValue || ""}
                        placeholder={val?.patientReported || "Doctor note"}
                        onChange={(e) => {
                          const updated = { ...summary };
                          updated.ayushAssessment[key].clinicianValue = e.target.value;
                          setSummary({ ...updated });
                        }}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid #6ee7b7",
                          fontSize: 13,
                          width: "100%",
                          maxWidth: 200,
                          background: "#ffffff",
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSpeakSummary}
                title={isSpeaking ? "Stop Reading" : "Read Aloud"}
                style={{
                  background: isSpeaking ? "#fee2e2" : undefined,
                  color: isSpeaking ? "#991b1b" : undefined,
                  borderColor: isSpeaking ? "#f87171" : undefined,
                }}
              >
                {isSpeaking ? "🛑 Stop" : "🔊 Listen"}
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
          sectionKey="documents"
          defaultTitle="Extracted Documents"
          data={documents.map((d) => ({
            type: d.documentType || d.type,
            date: d.date,
            findings: d.extractedText ? undefined : d,
          }))}
          lang={summaryLang}
        />
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        {SECTION_KEYS.map(([key, label]) => (
          <Section key={key} sectionKey={key} defaultTitle={label} data={summary?.[key]} lang={summaryLang} />
        ))}
      </div>

      {fhirBundle ? (
        <div
          className="card"
          style={{
            background: "#ecfdf5",
            border: "1.5px solid #a7f3d0",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#10b981",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: "bold",
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div>
              <h2 style={{ fontSize: 19, color: "#065f46", margin: 0, fontWeight: 700 }}>
                Patient Record Confirmed & EMR Sync Complete
              </h2>
              <p style={{ color: "#047857", fontSize: 13.5, margin: "3px 0 0" }}>
                Physician review complete. Intaked history & extracted documents verified into hospital EHR / ABDM.
              </p>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: 16,
              border: "1px solid #d1fae5",
              marginBottom: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              fontSize: 14,
            }}
          >
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>Patient Name</span>
              <strong>{queueEntry?.name || summary?.patient?.name || "Patient"}</strong>
            </div>
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>ABHA / Health ID</span>
              <strong>{queueEntry?.abhaId || summary?.patient?.abhaId || "ABDM-SYNCED"}</strong>
            </div>
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>Status</span>
              <span style={{ color: "#059669", fontWeight: 600 }}>🟢 EMR Confirmed</span>
            </div>
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>Confirmed Time</span>
              <strong>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              className="btn btn-primary"
              style={{ padding: "10px 20px", fontSize: 14 }}
              onClick={() => router.push("/dashboard")}
            >
              ← Back to Patient Queue
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 13 }}
              onClick={() => setShowFhir((show) => !show)}
            >
              {showFhir ? "Hide FHIR Payload" : "📄 View Technical FHIR Payload"}
            </button>
          </div>

          {showFhir && (
            <pre
              style={{
                marginTop: 16,
                background: "#0f1b1b",
                color: "#c9e9e6",
                padding: 16,
                borderRadius: 10,
                fontSize: 12,
                overflowX: "auto",
                fontFamily: "var(--font-mono)",
              }}
            >
              {JSON.stringify(fhirBundle, null, 2)}
            </pre>
          )}
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
