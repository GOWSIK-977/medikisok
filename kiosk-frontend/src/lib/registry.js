// Neither backend module exposes a "list all sessions" endpoint, and
// wiring real persistence is explicitly out of scope for the hackathon
// demo. This registry is the integration-glue stand-in: the kiosk
// writes a row here the moment a session starts, and the doctor
// dashboard reads it to build the queue. It only works when the kiosk
// and dashboard share a browser (the normal single-laptop demo setup).
// If real multi-device use is needed later, replace this with a GET
// /api/sessions endpoint on either backend — the shape below is a
// deliberately small target to migrate to.

const KEY = "medikiosk_queue_v1";

function readAll() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(rows) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function upsertQueueEntry(sessionId, patch) {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.sessionId === sessionId);
  const existing = idx >= 0 ? rows[idx] : { sessionId, createdAt: Date.now() };
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  if (idx >= 0) rows[idx] = updated;
  else rows.unshift(updated);
  writeAll(rows);
  return updated;
}

export function getQueue() {
  return readAll().sort((a, b) => {
    // Patients with unreviewed red flags float to the top.
    const aFlag = a.redFlags?.length && a.status !== "confirmed" ? 1 : 0;
    const bFlag = b.redFlags?.length && b.status !== "confirmed" ? 1 : 0;
    if (aFlag !== bFlag) return bFlag - aFlag;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

export function getQueueEntry(sessionId) {
  return readAll().find((r) => r.sessionId === sessionId) || null;
}

// ---- Active kiosk session (the patient currently at the kiosk) ----

const SESSION_KEY = "medikiosk_active_session_v1";

export function saveActiveSession(data) {
  const current = loadActiveSession() || {};
  const merged = { ...current, ...data };
  localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  return merged;
}

export function loadActiveSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearActiveSession() {
  localStorage.removeItem(SESSION_KEY);
}
