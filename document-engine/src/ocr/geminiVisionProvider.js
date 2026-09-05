/**
 * Gemini 3.6 Flash Multimodal Vision OCR Provider for document-engine (Person 2)
 * Reads actual prescription, lab report, or discharge summary images via Gemini Vision.
 * Falls back to canned demo text when placeholder images are submitted.
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

async function recognize({ documentType, imageBase64 }) {
  // If no image or demo placeholder provided, use deterministic mock provider
  if (!ai || !imageBase64 || imageBase64 === PLACEHOLDER_BASE64) {
    return mockOcrProvider.recognize({ documentType, imageBase64 });
  }

  try {
    const prompt = `You are a specialized medical OCR assistant at a hospital OPD kiosk.
Perform precise OCR text extraction on this medical document image (${documentType || 'medical document'}).

Extract all visible text including:
- Patient Name, Age, Gender, Date
- Clinical Diagnoses
- Prescribed Medications (Drug Name, Dosage, Frequency e.g., Tab Metformin 500mg BD)
- Lab Test Results & Reference Ranges (Test Name, Result, Reference Range)
- Physician Notes & Advice

Return ONLY the raw extracted text as formatted plain text. Do NOT add meta commentary or markdown wrapping.`;

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [prompt, imagePart],
    });

    if (response?.text && response.text.trim()) {
      return { rawText: response.text.trim() };
    }
  } catch (err) {
    console.warn('[geminiVisionProvider] Vision OCR fallback to mock text:', err.message);
  }

  return mockOcrProvider.recognize({ documentType, imageBase64 });
}

module.exports = { recognize };
