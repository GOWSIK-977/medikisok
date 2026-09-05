/**
 * Real Gemini LLM Provider for document-engine (Person 2)
 * Uses official @google/genai SDK for clinical summary generation and translation.
 */

const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let ai = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
  console.log('[document-engine geminiProvider] Google GenAI initialized successfully.');
} else {
  console.warn('[document-engine geminiProvider] Warning: GEMINI_API_KEY not set.');
}

const MODEL_NAME = 'gemini-3.6-flash';

/**
 * Robust caller with exponential retry for temporary Google API 503 / 429 spikes.
 */
async function generateContentWithRetry(prompt, retries = 2, delayMs = 700) {
  if (!ai) return null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      return response;
    } catch (err) {
      const isTransient =
        err.message?.includes('503') ||
        err.message?.includes('429') ||
        err.message?.includes('demand') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (attempt < retries && isTransient) {
        console.warn(`[document-engine geminiProvider] Gemini transient spike (${err.message.substring(0, 60)}...). Retrying attempt ${attempt + 1}/${retries} in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(1.5, attempt)));
        continue;
      }
      throw err;
    }
  }
  return null;
}

/**
 * Safely parse JSON from Gemini markdown output block or raw string.
 */
function cleanAndParseJSON(text) {
  if (!text) return null;
  let raw = text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/g, '').trim();
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[geminiProvider] JSON parse error:', err.message, 'Raw text:', text);
    return null;
  }
}

/**
 * Generate a cohesive clinical summary paragraph using Gemini.
 * MUST NOT INVENT ANY INFORMATION.
 */
async function generateSummaryText({ clinicalHistory, documents, language = 'en', documentAlerts = [] }) {
  const fallbackSummary = require('./mockProvider').generateSummaryText({ clinicalHistory, documents, documentAlerts });

  if (!ai) {
    const fallbackResult = await fallbackSummary;
    return fallbackResult;
  }

  try {
    let langName = 'English';
    if (language === 'hi') langName = 'Hindi (हिंदी)';
    if (language === 'ta') langName = 'Tamil (தமிழ்)';

    const prompt = `You are an expert clinical documentation AI assistant at a hospital General Medicine OPD.
Synthesize a concise, professional EMR record summary based ONLY on the provided intake history and extracted medical documents.

Clinical Intake History:
${JSON.stringify(clinicalHistory, null, 2)}

Extracted Documents:
${JSON.stringify(documents, null, 2)}

Document Safety Alerts:
${JSON.stringify(documentAlerts, null, 2)}

Target Language: ${langName}

CRITICAL CLINICAL SAFETY RULES:
1. Include ONLY facts explicitly present in the clinical intake history or matched extracted documents.
2. DO NOT invent diagnoses, symptoms, medications, or lab values.
3. IF A DOCUMENT IS FLAGGED AS A MISMATCH (e.g. prescription belongs to another patient name like Ramesh Kumar while patient is ${clinicalHistory?.patient?.name || 'Navaneethan R S'}), DO NOT incorporate its diagnoses or medications into the patient's Past Medical History or Medications list.
4. Format the output cleanly under standard GENERAL MEDICINE OPD headers:

GENERAL MEDICINE OPD

Patient: <Name>
Age: <Age>
Gender: <Gender>

Chief Complaint:
<Chief Complaint>

HPI:
• Severity: <Severity>
• Associated symptoms: <Symptoms>
• Location: <Location or "Not specified">
• Character: <Character or "Not specified">
• Radiation: <Radiation or "Not specified">
• Aggravating factors: <Factors or "Not specified">
• Relieving factors: <Factors or "Not specified">

Past Medical History:
• <History or "No history reported">

Allergies:
• <Allergies or "No known allergies reported">

Medications:
• <Medications or "None reported">

Red Flags:
• <Red Flags or "None detected">

DOCUMENT ALERT:
<If any mismatched document exists, state: "⚠️ Uploaded [type] belongs to another patient ([Name], [Age]). Not incorporated into the patient's history.">

Return ONLY the plain text clinical summary in this exact format.`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text && response.text.trim()) {
      return { summaryText: response.text.trim() };
    }
  } catch (err) {
    console.warn('[document-engine geminiProvider] generateSummaryText fallback:', err.message);
  }

  return fallbackSummary;
}

/**
 * Translate a clinical summary text to target language (English / Hindi / Tamil).
 * Preserves clinical facts precisely.
 */
async function translateSummaryText({ summaryText, targetLanguage }) {
  if (!ai || !summaryText) {
    return { summaryText };
  }

  let langName = 'English';
  if (targetLanguage === 'hi') langName = 'Hindi (हिंदी)';
  if (targetLanguage === 'ta') langName = 'Tamil (தமிழ்)';

  try {
    const prompt = `Translate the following medical clinical summary into ${langName}.
Original Summary:
"${summaryText}"

CRITICAL INSTRUCTIONS:
- Preserve all medical terms, drug dosages, numbers, lab values, and red flags accurately.
- Do NOT add or remove clinical information.
- Return ONLY the translated text.`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text && response.text.trim()) {
      return { summaryText: response.text.trim() };
    }
  } catch (err) {
    console.warn('[document-engine geminiProvider] translateSummaryText fallback:', err.message);
  }

  return { summaryText };
}

module.exports = { generateSummaryText, translateSummaryText };
