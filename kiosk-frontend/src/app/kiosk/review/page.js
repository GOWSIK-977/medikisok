"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClinicalSummary, generateFinalSummary } from "@/lib/api";
import { clearActiveSession, loadActiveSession, upsertQueueEntry } from "@/lib/registry";
import RedFlagBanner from "@/components/RedFlagBanner";

export default function ReviewPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const loadSummary = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const clinicalHistory = await getClinicalSummary(id);
      const merged = await generateFinalSummary(id, clinicalHistory);
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
    setSessionId(active.sessionId);
    loadSummary(active.sessionId);
  }, [router, loadSummary]);

  function handleSubmit() {
    upsertQueueEntry(sessionId, {
      status: "ready_for_doctor",
      summary,
      redFlags: summary?.red_flags || [],
    });
    setDone(true);
  }

  function finish() {
    clearActiveSession();
    router.push("/kiosk");
  }

  const chiefComplaintText =
    summary?.chief_complaint?.text ||
    summary?.chief_complaint?.description ||
    summary?.chief_complaint?.text_en ||
    "—";

  return (
    <div>
      <p className="eyebrow">Step 6 of 6</p>
      <h1 style={{ fontSize: 30, marginTop: 8, marginBottom: 6 }}>
        Review before we send this to your doctor
      </h1>

      {loading && (
        <p style={{ color: "var(--slate)" }}>Putting your visit together…</p>
      )}
      {error && (
        <div className="banner banner-red" style={{ marginBottom: 16 }}>
          {error}
          <button
            style={{ marginLeft: 16, fontSize: 13, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
            onClick={() => sessionId && loadSummary(sessionId)}
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
            <div className="eyebrow" style={{ marginBottom: 8 }}>Chief complaint</div>
            <p style={{ marginBottom: 18 }}>{chiefComplaintText}</p>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Summary for your doctor</div>
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {summary.clinical_summary_text || "No summary text generated."}
            </p>
          </div>

          <p style={{ color: "var(--slate)", fontSize: 14, marginBottom: 20 }}>
            This won&rsquo;t be saved to your record until your doctor reviews and confirms it.
          </p>

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSubmit}>
            Send to my doctor
          </button>
        </>
      )}

      {done && (
        <div className="card" style={{ textAlign: "center", background: "var(--teal-tint)", border: "none" }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>You&rsquo;re all set.</p>
          <p style={{ color: "var(--slate)", marginBottom: 18 }}>
            You&rsquo;ve been added to the doctor&rsquo;s queue. Please have a seat in the waiting area.
          </p>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={finish}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
