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
 * Generate a cohesive clinical summary paragraph using Gemini.
 * Formats separately for General Medicine OPD vs AYUSH OPD for instant physician clarity.
 */
async function generateSummaryText({ clinicalHistory, documents, language = 'en', documentAlerts = [] }) {
  const fallbackSummary = require('./mockProvider').generateSummaryText({ clinicalHistory, documents, documentAlerts, language });

  if (!ai) {
    const fallbackResult = await fallbackSummary;
    return fallbackResult;
  }

  try {
    let langName = 'English';
    if (language === 'hi') langName = 'Hindi (हिंदी)';
    if (language === 'ta') langName = 'Tamil (தமிழ்)';

    const isAyush = clinicalHistory?.department === 'AYUSH';
    const opdTitle = isAyush ? 'AYUSH CLINICAL OPD' : 'GENERAL MEDICINE OPD';

    const formatInstructions = isAyush
      ? `Generate a clear, specialized AYUSH CLINICAL OPD report with the following exact sections:

🌿 AYUSH CLINICAL OPD - ROGA ITIHASA & PARIKSHA REPORT

ROGI VIVARANA (PATIENT DEMOGRAPHICS):
• Rogi (Patient Name): <Name>
• Vaya (Age): <Age> yrs (<Bala / Madhya / Vriddha>)
• Linga (Gender): <Gender>
• Department: AYUSH Clinical OPD

PRADHANA VEDANA (CHIEF COMPLAINT & VIKRITI):
• <Chief complaint and patient reported symptoms>

ROGA ITIHASA (HPI & DOSHA AGGRAVATION):
• Onset / Duration: <Duration>
• Severity: <Severity>
• Daily / Dietary Triggers: <Triggers>
• Associated Symptoms: <Symptoms>

DASHAVIDHA PARIKSHA (10-FOLD CLINICAL MATRIX):
1. Deha Prakriti (Thermal Traits & Skin): <Reported cold/heat sensitivity & skin nature>
2. Vikriti (Current Symptoms & Imbalance): <Reported symptoms and aggravations>
3. Agni Pariksha (Hunger & Digestion): <Reported hunger, gas, acidity, bloating>
4. Koshtha Pariksha (Stool & Bowel Habits): <Reported stool nature & constipation/regular>
5. Sara Pariksha (Tissue Vitality & Energy): <Reported stamina and fatigue rate>
6. Samhanana (Body Build & Compactness): <Reported slender/medium/broad frame>
7. Pramana (Proportions & Weight Frame): <Reported body build and weight stability>
8. Satmya (Dietary Habituation & Suitability): <Diet preferences, cravings & intolerances>
9. Sattva (Mental Resilience & Emotions): <Stress coping, calm vs anxious/irritable>
10. Ahara & Vyayama Shakti (Capacity): <Appetite capacity & daily physical activity>

NIDRA & VIHARA (SLEEP & DAILY HABITS):
• Nidra (Sleep Quality & Routine): <Sleep quality & waking freshness>
• Vihara (Daily Lifestyle & Habits): <Hydration, tea/coffee, routine timings>

PURVA VYADHI & AUSHADHI (PAST ILLNESSES & MEDICATIONS):
• Past Medical History: <History or "No chronic illness reported">
• Current Medications: <Medications or "None reported">
• Asatmya / Allergies: <Allergies or "No known allergies">

PREVIOUS PRESCRIPTIONS & MEDICAL DOCUMENTS (ANALYSIS):
<If documents or prescriptions were uploaded, provide:
• Document: <Type> (<Date>)
• Prescribing Doctor / Facility: <Doctor Name, Qualifications, Clinic/Hospital>
• AI Clinical Synopsis: <Concise 2-3 sentence short description of what was prescribed, for what conditions, and key instructions>
• Previous Prescribed Regimen: <List of previous medications with dosage & frequency>
• Clinical Findings / Diagnoses: <Previous diagnoses>
• Physician Advice: <Advice if any>
If no documents uploaded, state "• No previous medical documents uploaded">

ATYAYIKA AVASTHA (EMERGENCY RED FLAGS):
• <Red flags with 🚨 or "None detected - Patient stable">

DOCUMENT ALERT:
<If any mismatched document exists, state: "⚠️ Uploaded [type] belongs to another patient ([Name], [Age]). Not incorporated into the patient's history.">

CHIKITSA SUTRA & PHYSICIAN NOTICE:
• AI Intake records patient-reported observations and indicators. Definitive Prakriti, Vikriti, Nadi Pariksha, and prescription are exclusively determined by the attending AYUSH physician.`
      : `Generate a clear, standard GENERAL MEDICINE OPD report with the following exact sections:

🏥 GENERAL MEDICINE CLINICAL OPD SUMMARY & TRIAGE REPORT

PATIENT DEMOGRAPHICS:
• Name: <Name>
• Age: <Age> yrs  |  Gender: <Gender>
• Department: General Medicine OPD

CHIEF COMPLAINT (CC):
• <Chief Complaint with onset/duration>

HISTORY OF PRESENT ILLNESS (HPI):
• Onset / Duration: <Duration>
• Severity: <Severity score e.g. 7/10>
• Location: <Location>
• Character: <Character e.g. sharp, throbbing, dull>
• Radiation: <Radiation e.g. left arm, back, or None>
• Aggravating Factors: <Factors>
• Relieving Factors: <Factors>
• Associated Symptoms: <Symptoms>

REVIEW OF SYSTEMS (ROS):
• Cardiovascular: <Findings or "No chest pain/palpitations">
• Respiratory: <Findings or "No cough/dyspnea">
• Gastrointestinal: <Findings or "No nausea/vomiting">
• Neurological: <Findings or "No weakness/numbness">
• Musculoskeletal: <Findings or "No joint complaints">
• Genitourinary: <Findings or "No dysuria">
• General: <Findings or "No recent weight loss/fever">

PAST MEDICAL & SURGICAL HISTORY:
• Past Medical History: <History or "No chronic illness reported">
• Past Surgical History: <Surgeries or "No past surgeries reported">

CURRENT MEDICATIONS & ALLERGIES:
• Current Medications: <Medications or "None reported">
• Drug / Food Allergies: <Allergies or "No known allergies reported">

PREVIOUS PRESCRIPTIONS & MEDICAL DOCUMENTS (ANALYSIS):
<If documents or prescriptions were uploaded, provide:
• Document: <Type> (<Date>)
• Prescribing Doctor / Facility: <Doctor Name, Qualifications, Clinic/Hospital>
• AI Clinical Synopsis: <Concise 2-3 sentence short description of what was prescribed, for what conditions, and key instructions>
• Previous Prescribed Regimen: <List of previous medications with dosage & frequency>
• Clinical Findings / Diagnoses: <Previous diagnoses>
• Physician Advice: <Advice if any>
If no documents uploaded, state "• No previous medical documents uploaded">

EMERGENCY RED FLAGS & TRIAGE ALERTS:
• <Red flags with 🚨 or "None detected - Hemodynamically stable">

DOCUMENT ALERT:
<If any mismatched document exists, state: "⚠️ Uploaded [type] belongs to another patient ([Name], [Age]). Not incorporated into the patient's history.">

CLINICAL IMPRESSION & WORKUP RECOMMENDATION:
• <Concise provisional clinical summary for the physician and suggested initial investigations>`;

    const prompt = `You are an expert clinical documentation AI specialist at a hospital ${opdTitle}.
Synthesize a concise, professional EMR clinical handover report based ONLY on the provided intake history and extracted medical documents.

Clinical Intake History:
${JSON.stringify(clinicalHistory, null, 2)}

Extracted Documents:
${JSON.stringify(documents, null, 2)}

Document Safety Alerts:
${JSON.stringify(documentAlerts, null, 2)}

Target Language: ${langName}

CRITICAL CLINICAL RULES:
1. Include ONLY facts explicitly present in the clinical intake history or matched extracted documents.
2. DO NOT invent diagnoses, symptoms, medications, or lab values.
3. DO NOT diagnose Prakriti, Vikriti or Dosha in AYUSH - record patient observations.
4. IF A DOCUMENT IS FLAGGED AS A MISMATCH, DO NOT incorporate its diagnoses or medications into the patient's Past Medical History or Medications list.
5. ${formatInstructions}

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
 * Preserves clinical facts and section headers precisely.
 */
async function translateSummaryText({ summaryText, targetLanguage }) {
  if (!ai || !summaryText) {
    return require('./mockProvider').translateSummaryText({ summaryText, targetLanguage });
  }

  let langName = 'English';
  if (targetLanguage === 'hi') langName = 'Hindi (हिंदी)';
  if (targetLanguage === 'ta') langName = 'Tamil (தமிழ்)';

  try {
    const prompt = `Translate the following hospital clinical summary into ${langName}.
Original Summary:
"${summaryText}"

CRITICAL INSTRUCTIONS:
- Translate all headers, observations, and descriptions into ${langName}.
- Preserve medical dosages, numbers, lab values, and red flags accurately.
- Do NOT add or remove clinical information.
- Return ONLY the translated text.`;

    const response = await generateContentWithRetry(prompt);
    if (response?.text && response.text.trim()) {
      return { summaryText: response.text.trim() };
    }
  } catch (err) {
    console.warn('[document-engine geminiProvider] translateSummaryText fallback:', err.message);
  }

  return require('./mockProvider').translateSummaryText({ summaryText, targetLanguage });
}

module.exports = { generateSummaryText, translateSummaryText };
