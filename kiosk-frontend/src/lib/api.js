// Thin client over Person 1 (conversation-engine, :4000) and
// Person 2 (document-engine, :4001). Every function throws on
// non-2xx so callers can catch and show an inline error — a kiosk
// screen should never show a raw stack trace to a patient.

const CONVO = process.env.NEXT_PUBLIC_CONVERSATION_API || "http://localhost:4000";
const DOCS = process.env.NEXT_PUBLIC_DOCUMENT_API || "http://localhost:4001";

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (err) {
    throw new Error(
      `Could not reach ${url}. Is the service running? (${err.message})`
    );
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      (isJson && (body.error || body.message)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

// ---- ABHA Validation ----

export function validateAbha(input) {
  return request("/api/validate-abha", {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

// ---- Person 1: Conversation Engine ----

export function startSession({ name, age, gender, language, department = "GENERAL_MEDICINE" }) {
  return request(`${CONVO}/api/session/start`, {
    method: "POST",
    body: JSON.stringify({ name, age, gender, language, department }),
  });
}

export function sendAnswer(sessionId, answerText) {
  return request(`${CONVO}/api/session/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ answerText }),
  });
}

export function getClinicalSummary(sessionId) {
  return request(`${CONVO}/api/session/${sessionId}/summary`);
}

export function finalizeSession(sessionId) {
  return request(`${CONVO}/api/session/${sessionId}/finalize`, {
    method: "POST",
  });
}


// ---- Person 2: Document Engine ----

export function uploadDocument(sessionId, documentType, imageBase64) {
  return request(`${DOCS}/api/documents/${sessionId}/upload`, {
    method: "POST",
    body: JSON.stringify({ documentType, imageBase64 }),
  });
}

export function getDocuments(sessionId) {
  return request(`${DOCS}/api/documents/${sessionId}`);
}

export function generateFinalSummary(sessionId, clinicalHistory, language = "en") {
  // Per the frozen contract: clinicalHistory must be Person 1's FULL,
  // unmodified summary JSON — never a hand-trimmed subset — or the
  // merge silently produces an incomplete result instead of erroring.
  return request(`${DOCS}/api/summary/${sessionId}/generate`, {
    method: "POST",
    body: JSON.stringify({ clinicalHistory, language }),
  });
}

export function translateSummary(sessionId, summaryText, targetLanguage) {
  return request(`${DOCS}/api/summary/${sessionId}/translate`, {
    method: "POST",
    body: JSON.stringify({ summaryText, targetLanguage }),
  });
}
