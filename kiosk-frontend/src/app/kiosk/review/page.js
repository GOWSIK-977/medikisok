"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClinicalSummary, generateFinalSummary } from "@/lib/api";
import { clearActiveSession, loadActiveSession, upsertQueueEntry } from "@/lib/registry";
import RedFlagBanner from "@/components/RedFlagBanner";

export default function ReviewPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(null);
  const [language, setLanguage] = useState("en");
  const [department, setDepartment] = useState("GENERAL_MEDICINE");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const loadSummary = useCallback(async (id, lang) => {
    setLoading(true);
    setError(null);
    try {
      const clinicalHistory = await getClinicalSummary(id);
      const merged = await generateFinalSummary(id, clinicalHistory, lang);
      setSummary(merged);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const active = loadActiveSession();
    if (!active?.sessionId) {
      router.push("/kiosk/identify");
      return;
    }
    const lang = active.language || active.schema?.patient?.preferred_language || "en";
    const dept = active.department || active.schema?.department || "GENERAL_MEDICINE";
    setSessionId(active.sessionId);
    setLanguage(lang);
    setDepartment(dept);
    loadSummary(active.sessionId, lang);
  }, [router, loadSummary]);

  function handleSubmit() {
    upsertQueueEntry(sessionId, {
      status: "ready_for_doctor",
      summary,
      department,
      redFlags: summary?.red_flags || [],
    });
    setDone(true);
  }

  function finish() {
    clearActiveSession();
    router.push("/kiosk");
  }

  const isAyush = department === "AYUSH" || summary?.department === "AYUSH";

  const labels = {
    step: language.startsWith("ta") ? "படி 6 / 6" : language.startsWith("hi") ? "चरण 6 / 6" : "Step 6 of 6",
    title: language.startsWith("ta")
      ? "மருத்துவரிடம் அனுப்புவதற்கு முன் உங்கள் விவரங்களைச் சரிபார்க்கவும்"
      : language.startsWith("hi")
      ? "डॉक्टर को भेजने से पहले अपनी जानकारी की समीक्षा करें"
      : "Review before we send this to your doctor",
    loading: language.startsWith("ta") ? "உங்கள் வருகை விவரங்கள் தொகுக்கப்படுகின்றன…" : language.startsWith("hi") ? "आपकी जानकारी तैयार की जा रही है…" : "Putting your visit together…",
    ccTitle: language.startsWith("ta") ? "முதன்மை ஆரோக்கியப் பிரச்சினை" : language.startsWith("hi") ? "मुख्य स्वास्थ्य समस्या (Chief Complaint)" : "Chief complaint",
    summaryTitle: language.startsWith("ta") ? "மருத்துவருக்கான மருத்துவ சுருக்க அறிக்கை" : language.startsWith("hi") ? "डॉक्टर के लिए क्लिनिकल रिपोर्ट" : "Summary for your doctor",
    disclaimer: language.startsWith("ta")
      ? "உங்கள் மருத்துவர் இதை மதிப்பாய்வு செய்து உறுதிப்படுத்தும் வரை இது உங்கள் மருத்துவப் பதிவேட்டில் நிரந்தரமாகச் சேமிக்கப்படாது."
      : language.startsWith("hi")
      ? "जब तक आपके डॉक्टर इसकी समीक्षा और पुष्टि नहीं करते, तब तक यह आपके मेडिकल रिकॉर्ड में स्थायी रूप से सहेजा नहीं जाएगा।"
      : "This won’t be saved to your record until your doctor reviews and confirms it.",
    sendBtn: language.startsWith("ta") ? "என் மருத்துவரிடம் அனுப்புக" : language.startsWith("hi") ? "मेरे डॉक्टर को भेजें" : "Send to my doctor",
    doneTitle: language.startsWith("ta") ? "அனைத்தும் முடிந்தது. நன்றி!" : language.startsWith("hi") ? "आपकी प्रक्रिया पूरी हो गई है।" : "You’re all set.",
    doneDesc: language.startsWith("ta")
      ? "நீங்கள் மருத்துவரின் காத்திருப்புப் பட்டியலில் சேர்க்கப்பட்டுள்ளீர்கள். தயவுசெய்து காத்திருப்பு பகுதியில் அமரவும்."
      : language.startsWith("hi")
      ? "आपको डॉक्टर की कतार में जोड़ दिया गया है। कृपया प्रतीक्षा क्षेत्र में बैठें।"
      : "You’ve been added to the doctor’s queue. Please have a seat in the waiting area.",
    doneBtn: language.startsWith("ta") ? "முடிந்தது" : language.startsWith("hi") ? "पूर्ण" : "Done",
  };

  const chiefComplaintText =
    summary?.chief_complaint?.text ||
    summary?.chief_complaint?.description ||
    summary?.chief_complaint?.text_en ||
    "—";

  return (
    <div>
      <p className="eyebrow">{labels.step}</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <span
          style={{
            background: isAyush ? "#ecfdf5" : "#e0f2fe",
            color: isAyush ? "#047857" : "#0369a1",
            padding: "4px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            border: isAyush ? "1px solid #a7f3d0" : "1px solid #bae6fd",
          }}
        >
          {isAyush ? "🌿 AYUSH OPD" : "🏥 GENERAL MEDICINE OPD"}
        </span>
      </div>

      <h1 style={{ fontSize: 28, marginTop: 4, marginBottom: 8 }}>
        {labels.title}
      </h1>

      {loading && (
        <p style={{ color: "var(--slate)" }}>{labels.loading}</p>
      )}

      {error && (
        <div className="banner banner-red" style={{ marginBottom: 16 }}>
          {error}
          <button
            style={{ marginLeft: 16, fontSize: 13, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
            onClick={() => sessionId && loadSummary(sessionId, language)}
          >
            Retry
          </button>
        </div>
      )}

      {summary && !done && (
        <>
          {summary.red_flags && summary.red_flags.length > 0 && (
            <RedFlagBanner flags={summary.red_flags} tone="red" />
          )}

          <div className="card" style={{ margin: "18px 0" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{labels.ccTitle}</div>
            <p style={{ marginBottom: 18, fontSize: 16, fontWeight: 500 }}>{chiefComplaintText}</p>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{labels.summaryTitle}</div>
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", fontSize: 14.5, background: "var(--surface)", padding: 14, borderRadius: 10, border: "1px solid var(--line)" }}>
              {summary.clinical_summary_text || "No summary text generated."}
            </p>
          </div>

          <p style={{ color: "var(--slate)", fontSize: 14, marginBottom: 20 }}>
            {labels.disclaimer}
          </p>

          <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 16, fontWeight: 600 }} onClick={handleSubmit}>
            {labels.sendBtn} ➔
          </button>
        </>
      )}

      {done && (
        <div className="card" style={{ textAlign: "center", background: "var(--teal-tint)", border: "none", padding: 30 }}>
          <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 20, color: "#065f46" }}>{labels.doneTitle}</p>
          <p style={{ color: "var(--slate)", marginBottom: 22, fontSize: 15.5 }}>
            {labels.doneDesc}
          </p>
          <button className="btn btn-primary" style={{ width: "100%", padding: 13, fontSize: 15 }} onClick={finish}>
            {labels.doneBtn}
          </button>
        </div>
      )}
    </div>
  );
}
