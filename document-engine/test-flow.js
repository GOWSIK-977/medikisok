// Tests OCR->extraction->merge logic directly, no express/uuid needed.
process.env.OCR_PROVIDER = 'mock';
process.env.LLM_PROVIDER = 'mock';

const ocr = require('./src/ocr');
const entityExtractor = require('./src/extraction/entityExtractor');
const summaryGenerator = require('./src/summary/summaryGenerator');

// This is exactly what Person 1's GET /api/session/:id/summary returns for
// the agreed demo scenario (52M, chest pain 3 days, breathless + sweating).
const person1Output = {
  patient: { name: 'Ramesh Kumar', age: 52, gender: 'male', preferred_language: 'hi' },
  chief_complaint: { text: 'I have chest pain', text_en: 'I have chest pain', duration: '' },
  hpi: {
    onset: 'It started 3 days ago',
    location: 'In the center of my chest',
    character: 'A heavy, pressing feeling',
    radiation: 'Yes, it goes to my left arm',
    associated_symptoms: 'I feel breathless and I am sweating a lot',
    exacerbating_factors: 'It gets worse when I walk',
    relieving_factors: 'Resting helps a little',
    severity: '7/10',
  },
  review_of_systems: { general: ['No, just tired'] },
  red_flags: [{ flag: 'chest_pain_with_dyspnea', severity: 'critical', triggered_by: 'chest pain, breathless', timestamp: new Date().toISOString() }],
  past_medical_history: [],
  drug_allergy_history: { current_medications: [], allergies: [] },
  meta: { generated_at: null, status: 'draft' },
};

async function run() {
  console.log('=== Processing documents ===\n');

  const documents = [];
  for (const documentType of ['prescription', 'lab_report']) {
    const { rawText } = await ocr.recognize({ documentType });
    const extracted = entityExtractor.extractAll(rawText);
    console.log(`--- ${documentType} ---`);
    console.log('Extracted:', JSON.stringify(extracted, null, 2), '\n');
    documents.push({ document_id: `test-${documentType}`, document_type: documentType, raw_ocr_text: rawText, ...extracted });
  }

  console.log('=== Generating final merged summary ===\n');
  const finalSummary = await summaryGenerator.generateFinalSummary({ clinicalHistory: person1Output, documents });
  console.log(JSON.stringify(finalSummary, null, 2));
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
