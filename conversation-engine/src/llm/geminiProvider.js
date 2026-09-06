/**
 * Real Gemini LLM Provider for conversation-engine (Person 1)
 * Uses official @google/genai SDK with gemini-3.6-flash model and robust retry handling.
 */

const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let ai = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
  console.log('[geminiProvider] Google GenAI initialized successfully.');
} else {
  console.warn('[geminiProvider] Warning: GEMINI_API_KEY is not set. Gemini calls will fall back gracefully.');
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
        console.warn(`[geminiProvider] Gemini transient spike (${err.message.substring(0, 60)}...). Retrying attempt ${attempt + 1}/${retries} in ${delayMs}ms...`);
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
 * Extract structured value from raw answer text for a specific field.
 */
async function extractStructuredAnswer({ field, question, rawText }) {
  if (!ai || !rawText) {
    return { value: (rawText || '').trim(), confidence: 0.5 };
  }

  try {
    const prompt = `You are an expert clinical intake AI assistant.
Target field: "${field}"
Question asked: "${question}"
Patient response: "${rawText}"

Extract the clinical information corresponding to the target field from the patient's response.
Return ONLY a JSON object with this format:
{
  "value": "extracted clinical value as concise string",
  "confidence": 0.95
}
Do NOT invent symptoms or diagnosis. If nothing relevant is provided, return {"value": "${rawText}", "confidence": 0.5}.`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text) {
      const parsed = cleanAndParseJSON(response.text);
      if (parsed && typeof parsed.value === 'string') {
        return { value: parsed.value, confidence: parsed.confidence || 0.85 };
      }
    }
  } catch (err) {
    console.warn('[geminiProvider] extractStructuredAnswer fallback to rawText:', err.message);
  }

  return { value: (rawText || '').trim(), confidence: 0.5 };
}

/**
 * Rephrase a question template naturally for the patient in their language.
 */
async function rephraseQuestion({ templateQuestion, context = {} }) {
  if (!ai || !templateQuestion) return templateQuestion;

  try {
    const language = context.language || 'en';
    let langInstruction = 'Rephrase in clear, empathetic English.';
    if (language.startsWith('hi')) langInstruction = 'Rephrase in natural, gentle Hindi.';
    if (language.startsWith('ta')) langInstruction = 'Rephrase in natural, polite Tamil.';

    const prompt = `You are a polite, empathetic medical kiosk intake assistant.
Original question: "${templateQuestion}"
Patient chief complaint: "${context.chiefComplaint || ''}"
${langInstruction}
Keep the question short, conversational, and direct. Ask ONLY the single question without greetings or filler.
Return ONLY the rephrased question text.`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text && response.text.trim()) {
      return response.text.trim();
    }
  } catch (err) {
    console.warn('[geminiProvider] rephraseQuestion fallback to template:', err.message);
  }

  return templateQuestion;
}

/**
 * Real Gemini Red-Flag Detection with deterministic safety fallback.
 */
async function detectRedFlag({ transcript }) {
  const ruleBasedFlags = await require('./mockProvider').detectRedFlag({ transcript });

  if (!ai || !transcript || transcript.length === 0) {
    return ruleBasedFlags;
  }

  try {
    const fullTranscript = transcript.join('\n');
    const prompt = `You are a clinical safety agent reviewing a patient intake transcript at an OPD kiosk.
Review the following patient transcript for potential critical emergency red flags (e.g. severe chest pain, dyspnea, acute neurological weakness, severe bleeding, anaphylaxis, sudden severe headache).

Transcript:
${fullTranscript}

Return ONLY a JSON object with this shape:
{
  "flags": [
    {
      "flag": "descriptive_flag_name",
      "severity": "critical" | "high" | "moderate",
      "triggered_by": "exact phrase or symptom combination reported by patient"
    }
  ]
}
If no red flags are found, return {"flags": []}.
DO NOT diagnose diseases. Only identify concerning reported red-flag symptoms.`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text) {
      const parsed = cleanAndParseJSON(response.text);
      if (parsed && Array.isArray(parsed.flags)) {
        const merged = [...ruleBasedFlags];
        for (const geminiFlag of parsed.flags) {
          if (geminiFlag.flag && !merged.some((f) => f.flag === geminiFlag.flag)) {
            merged.push(geminiFlag);
          }
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('[geminiProvider] detectRedFlag using rule-based fallback:', err.message);
  }

  return ruleBasedFlags;
}

/**
 * Dynamic Multi-field Extraction & Next Question Generation
 * Evaluates full patient context and dynamically decides the single next best question.
 */
async function extractAllEntitiesAndNextQuestion({ session, rawAnswerText, lastQuestion }) {
  if (!ai) return null;

  try {
    const currentSchema = session.schema || {};
    const patientLang = currentSchema.patient?.preferred_language || 'en';
    const transcriptHistory = session.transcript || [];

    let langInstruction = 'English';
    if (patientLang.startsWith('hi')) langInstruction = 'Hindi (हिंदी)';
    if (patientLang.startsWith('ta')) langInstruction = 'Tamil (தமிழ்)';

    const prompt = `You are an expert, empathetic medical intake AI assistant conducting a patient interview at a hospital OPD kiosk.

=== PATIENT CONTEXT ALREADY COLLECTED ===
- Chief Complaint: "${currentSchema.chief_complaint?.text || ''}"
- Known HPI details: ${JSON.stringify(currentSchema.hpi || {})}
- Known Review of Systems: ${JSON.stringify(currentSchema.review_of_systems || {})}
- Known Medical/Surgical/Drug History: ${JSON.stringify({
      past_medical: session.schema?.past_medical_history_raw || null,
      past_surgical: session.schema?.past_surgical_history_raw || null,
      drug_allergy: session.schema?.drug_allergy_history_raw || null,
      family: session.schema?.family_history_raw || null,
      personal: session.schema?.personal_history_raw || null,
    })}
- Full Conversation Transcript:
${transcriptHistory.map((t, i) => `Turn ${i + 1}: ${t}`).join('\n')}

=== LATEST TURN ===
Last Question Asked: "${lastQuestion?.prompt || 'Initial intake'}"
Patient Latest Response: "${rawAnswerText}"

=== INSTRUCTIONS ===
1. EXTRACT ALL NEW CLINICAL INFORMATION from the patient's latest response (symptoms, duration, location, character, severity, radiation, associated symptoms, exacerbating/relieving factors, medical history, medications, allergies, etc.).
2. DO NOT ASK FOR INFORMATION THAT HAS ALREADY BEEN PROVIDED in the context or transcript above (e.g. if onset/duration, severity, or headache/fever/nausea are already known, NEVER ask for them again!).
3. Identify the single most useful missing piece of clinical information needed for an OPD intake history.
4. Generate ONE short, natural, empathetic question in ${langInstruction}.
   - DO NOT suggest diagnoses or diseases.
   - DO NOT invent symptoms or findings.
   - DO NOT include greetings, intro filler, or multiple questions in one.
5. If enough relevant clinical intake information has been gathered (or if 5-7 turns have occurred with adequate history), set action to "complete".

Return ONLY a JSON object matching this exact schema:
{
  "extracted_fields": {
    "chief_complaint": "string or null",
    "onset": "string or null",
    "location": "string or null",
    "character": "string or null",
    "severity": "string or null",
    "radiation": "string or null",
    "associated_symptoms": "string or null",
    "exacerbating_factors": "string or null",
    "relieving_factors": "string or null",
    "review_of_systems_general": "string or null",
    "past_medical_history": "string or null",
    "past_surgical_history": "string or null",
    "drug_allergy_history": "string or null",
    "family_history": "string or null",
    "personal_history": "string or null"
  },
  "action": "ask_question" | "complete",
  "question": "The exact single question string to ask the patient in ${langInstruction}",
  "target_field": "field_name_being_asked_about",
  "reason": "Brief rationale for asking this question"
}`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text) {
      const parsed = cleanAndParseJSON(response.text);
      if (parsed && (parsed.action === 'ask_question' || parsed.action === 'complete')) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[geminiProvider] extractAllEntitiesAndNextQuestion error:', err.message);
  }

  return null;
}

/**
 * Full Transcript Extraction
 * Takes the entire conversation transcript and generates comprehensive structured schema fields.
 */
async function extractFullTranscript({ transcript, schema = {}, department = 'GENERAL_MEDICINE' }) {
  if (!ai || !transcript || transcript.length === 0) return null;

  const isAyush = (schema?.department === 'AYUSH') || (department === 'AYUSH');

  try {
    const fullTranscript = transcript.join('\n');
    const prompt = isAyush
      ? `You are an expert clinical summarizer at an AYUSH hospital outpatient department (OPD).
Review the full patient intake conversation transcript below:

=== TRANSCRIPT ===
${fullTranscript}

=== CLINICAL SAFETY INSTRUCTIONS ===
1. Extract all clinical information gathered during intake into structured JSON.
2. DO NOT make definitive Dosha diagnoses (do NOT assert "Patient is Pitta Prakriti"). Instead, record the patient's reported physical characteristics, symptoms, digestion, bowels, sleep, build, etc. as observed indicators.
3. Internally map the patient's natural responses to the AYUSH assessment categories.
4. Return ONLY valid JSON matching this schema:
{
  "chief_complaint": "primary symptom or reason for visit (concise string)",
  "hpi": {
    "onset": "when it started or duration",
    "location": "body location or null",
    "character": "quality of symptom or null",
    "severity": "mild / moderate / severe / rating or null",
    "radiation": "radiation area or null",
    "associated_symptoms": "associated symptoms or null",
    "exacerbating_factors": "triggers or worsening factors or null",
    "relieving_factors": "relieving factors or null"
  },
  "ayush_assessment": {
    "prakriti": "reported thermal tolerance (cold/heat sensitivity) and skin type (dry/oily/normal)",
    "vikriti": "current symptoms, recent physical changes and aggravations",
    "agni": "reported hunger and digestion status (acidity, gas, bloating, heaviness)",
    "koshtha": "reported stool and bowel habits (regular, hard/constipated, loose)",
    "sara": "reported vitality, endurance and fatigue level",
    "samhanana": "reported body build and compactness (slender, medium, broad frame)",
    "pramana": "body frame and weight stability observations",
    "satmya": "reported food habits, taste cravings, dietary suitability and intolerances",
    "sattva": "reported stress coping, emotional temperament, and mental focus",
    "ahara_shakti": "reported appetite and food intake capacity",
    "vyayama_shakti": "reported physical exercise level and stamina",
    "nidra": "reported sleep quality, duration, and morning waking freshness",
    "vihara": "reported daily lifestyle, hydration, tea/coffee, smoking or alcohol habits",
    "vaya": "age category"
  },
  "past_medical_history": "known chronic conditions (diabetes, hypertension, thyroid, etc.) or null",
  "past_surgical_history": "past surgeries or null",
  "drug_allergy_history": "known allergies to medicines or food or null",
  "family_history": "family history or null",
  "personal_history": "diet, lifestyle, hydration, and personal habits or null"
}`
      : `You are an expert clinical summarizer at a hospital OPD kiosk.
Review the full patient intake conversation transcript below:

=== TRANSCRIPT ===
${fullTranscript}

=== INSTRUCTIONS ===
Extract all clinical information gathered during the intake into structured JSON.
Do NOT invent symptoms or make medical diagnoses.
Return ONLY valid JSON matching this schema:
{
  "chief_complaint": "primary symptom or reason for visit (concise string)",
  "hpi": {
    "onset": "when it started or duration",
    "location": "body location or null",
    "character": "quality of symptom (e.g. sharp, throbbing, dull) or null",
    "severity": "mild / moderate / severe / rating or null",
    "radiation": "radiation area or null",
    "associated_symptoms": "associated symptoms or null",
    "exacerbating_factors": "triggers or worsening factors or null",
    "relieving_factors": "relieving factors or medications tried or null"
  },
  "past_medical_history": "known chronic conditions or null",
  "past_surgical_history": "past surgeries or null",
  "drug_allergy_history": "known allergies or null",
  "family_history": "family history or null",
  "personal_history": "smoking/diet/lifestyle or null"
}`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text) {
      const parsed = cleanAndParseJSON(response.text);
      if (parsed && (parsed.chief_complaint || parsed.hpi || parsed.ayush_assessment)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[geminiProvider] extractFullTranscript error:', err.message);
  }

  return null;
}

module.exports = {
  extractStructuredAnswer,
  rephraseQuestion,
  detectRedFlag,
  extractAllEntitiesAndNextQuestion,
  extractFullTranscript,
};

