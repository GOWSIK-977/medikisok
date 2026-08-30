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
async function generateSummaryText({ clinicalHistory, documents, language = 'en' }) {
  const fallbackSummary = require('./mockProvider').generateSummaryText({ clinicalHistory, documents });

  if (!ai) {
    const fallbackResult = await fallbackSummary;
    return fallbackResult;
  }

  try {
    let langName = 'English';
    if (language === 'hi') langName = 'Hindi (हिंदी)';
    if (language === 'ta') langName = 'Tamil (தமிழ்)';

    const prompt = `You are an expert clinical documentation AI assistant.
Synthesize a concise, professional clinical history summary for a physician's EMR record based ONLY on the provided structured intake and extracted medical documents.

Clinical Intake History:
${JSON.stringify(clinicalHistory, null, 2)}

Extracted Documents:
${JSON.stringify(documents, null, 2)}

Target Language: ${langName}

CRITICAL RULES:
1. Include ONLY facts explicitly present in the clinical intake history or extracted documents.
2. DO NOT invent diagnoses, symptoms, medications, or lab values.
3. Highlight any emergency RED FLAGS clearly at the end.
4. DO NOT diagnose the patient. Write in factual clinical tone ("Patient reports...", "Prior prescription indicates...").

Return ONLY the plain text clinical summary.`;

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
