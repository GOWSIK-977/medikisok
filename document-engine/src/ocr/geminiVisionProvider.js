/**
 * Gemini 3.6 Flash Multimodal Vision OCR & Clinical Analysis Provider for document-engine
 * Reads actual prescription, lab report, or discharge summary images via Gemini Vision.
 * Produces structured clinical entities (doctor, patient, diagnoses, medications, advice)
 * and generates a concise AI clinical synopsis / short description for the doctor's report.
 * Falls back to realistic mock provider when placeholder images or API limits are reached.
 */

const { GoogleGenAI } = require('@google/genai');
const mockOcrProvider = require('./mockOcrProvider');

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let ai = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
  console.log('[geminiVisionProvider] Google GenAI Vision OCR initialized.');
}

const MODEL_NAME = 'gemini-3.6-flash';
const PLACEHOLDER_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORUS5CYII=';

async function recognize({ documentType = 'prescription', imageBase64, patientName }) {
  // If no image or demo placeholder provided, use deterministic mock provider
  if (!ai || !imageBase64 || imageBase64 === PLACEHOLDER_BASE64) {
    return mockOcrProvider.recognize({ documentType, imageBase64, patientName });
  }

  try {
    const prompt = `You are an expert clinical medical OCR & document analysis AI specialist at a hospital OPD kiosk.
Analyze this uploaded medical document image (${documentType}). Doctor handwriting can be cursive or shorthand.

Carefully examine all handwritten and printed details on the document.
Return a STRICT JSON object (NO MARKDOWN WRAPPING, NO EXTRANEOUS TEXT) with the following structure:
{
  "rawText": "Complete transcription of all visible text on the document, preserving line breaks",
  "doctor_name": "Full name of the prescribing doctor with qualifications if present (e.g. Dr. Himanshu Aggarwal)",
  "doctor_specialty": "Specialty if mentioned (e.g. Consultant Rheumatology)",
  "clinic_or_hospital": "Clinic, hospital name, and city (e.g. Krishna Hospital & Trauma Center, Ghaziabad)",
  "document_date": "YYYY-MM-DD or DD/MM/YYYY as written on document",
  "extracted_patient": {
    "name": "Patient full name if written",
    "age": 48,
    "gender": "Female"
  },
  "extracted_diagnoses": [
    "List of all clinical diagnoses, suspected conditions, or findings mentioned (e.g. '? RA Atypical RF +ve (Left)', 'Lt Knee Osteoarthritis')"
  ],
  "extracted_medications": [
    {
      "name": "Drug trade / generic name (e.g. Tab Meditrex 15 / Methotrexate)",
      "dosage": "Dosage (e.g. 15mg)",
      "frequency": "Frequency and timing (e.g. Once weekly / OD BBF / Twice daily)",
      "instructions": "Specific instructions or duration (e.g. Twice daily x 7 days then once daily / SOS / with food)"
    }
  ],
  "extracted_investigations": [
    {
      "test_name": "Lab or imaging test name",
      "value": "Result value",
      "reference_range": "Normal range if stated",
      "flag": "normal | high | low"
    }
  ],
  "advice": "Non-pharmacological advice, physical therapy, precautions, or follow-up schedule (e.g. Ice pack application, follow up in 2 weeks)",
  "short_description": "A concise 2-3 sentence clinical synopsis of this previous prescription for the attending OPD physician's report. Summarize: who prescribed it, on what date, the suspected/confirmed diagnosis, key medications and regimen (e.g. DMARD, steroid taper, NSAID, gastroprotection), and clinical advice."
}`;

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: cleanBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [prompt, imagePart],
    });

    if (response?.text && response.text.trim()) {
      let cleaned = response.text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      try {
        const parsed = JSON.parse(cleaned);
        return {
          rawText: parsed.rawText || response.text.trim(),
          structuredData: parsed,
        };
      } catch (parseErr) {
        return {
          rawText: response.text.trim(),
          structuredData: null,
        };
      }
    }
  } catch (err) {
    console.warn('[geminiVisionProvider] Vision OCR fallback to mock text:', err.message);
  }

  return mockOcrProvider.recognize({ documentType, imageBase64, patientName });
}

module.exports = { recognize };

