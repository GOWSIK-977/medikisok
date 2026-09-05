"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQueue, clearQueueKeepLast5 } from "@/lib/registry";

const STATUS_LABEL = {
  in_progress: "Interview in progress",
  interview_complete: "Interview complete",
  documents_uploaded: "Documents uploaded",
  ready_for_doctor: "Ready for review",
  confirmed: "Confirmed",
};

const STATUS_COLOR = {
  in_progress: "var(--slate-soft)",
  interview_complete: "var(--slate-soft)",
  documents_uploaded: "var(--slate-soft)",
  ready_for_doctor: "var(--amber)",
  confirmed: "var(--teal)",
};

export default function DashboardPage() {
  const [queue, setQueue] = useState([]);

  function refresh() {
    setQueue(getQueue().slice(0, 5));
  }

  function handleTrimQueue() {
    setQueue(clearQueueKeepLast5());
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Doctor dashboard</p>
          <h1 style={{ fontSize: 30, marginTop: 6 }}>Patient queue (Recent 5)</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleTrimQueue}>
            🧹 Keep Last 5 Records
          </button>
          <button className="btn btn-secondary btn-sm" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>

      {queue.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--slate)" }}>
          No patients yet. Once someone completes the kiosk intake, they&rsquo;ll show up here.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {queue.map((p) => {
          const urgent = p.redFlags?.length > 0 && p.status !== "confirmed";
          return (
            <Link
              key={p.sessionId}
              href={`/dashboard/patient/${p.sessionId}`}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                textDecoration: "none",
                color: "inherit",
                borderColor: urgent ? "#e6b6a9" : "var(--line)",
                background: urgent ? "var(--red-tint)" : "var(--surface)",
              }}
            >
              <div
                style={{
                  width: 4,
                  alignSelf: "stretch",
                  borderRadius: 4,
                  background: urgent ? "var(--red)" : "var(--teal)",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{p.name || "Unnamed patient"}</div>
                <div style={{ color: "var(--slate)", fontSize: 14 }}>
                  {p.age ? `${p.age} yrs` : ""} {p.gender ? `· ${p.gender}` : ""} {p.abhaId ? `· ${p.abhaId}` : ""}
                </div>
              </div>
              {urgent && <span className="banner banner-red" style={{ padding: "6px 12px" }}>Red flag</span>}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: STATUS_COLOR[p.status] || "var(--slate)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {STATUS_LABEL[p.status] || p.status}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
