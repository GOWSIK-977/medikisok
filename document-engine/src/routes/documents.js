const express = require('express');
const ocr = require('../ocr');
const entityExtractor = require('../extraction/entityExtractor');
const documentStore = require('../documents/documentStore');

const router = express.Router();

// POST /api/documents/:sessionId/upload
// body: { documentType: "prescription"|"lab_report"|"discharge_summary", imageBase64?: "...", patientName?: "..." }
router.post('/:sessionId/upload', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { documentType, imageBase64, patientName } = req.body || {};
    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required' });
    }

    const { rawText, structuredData } = await ocr.recognize({ documentType, imageBase64, patientName });
    let extracted = entityExtractor.extractAll(rawText || '');

    if (structuredData) {
      extracted = {
        ...extracted,
        doctor_name: structuredData.doctor_name || extracted.doctor_name,
        doctor_specialty: structuredData.doctor_specialty || extracted.doctor_specialty,
        clinic_or_hospital: structuredData.clinic_or_hospital || extracted.clinic_or_hospital,
        document_date: structuredData.document_date || extracted.document_date,
        extracted_patient: structuredData.extracted_patient || extracted.extracted_patient,
        extracted_diagnoses: (structuredData.extracted_diagnoses && structuredData.extracted_diagnoses.length > 0)
          ? structuredData.extracted_diagnoses
          : extracted.extracted_diagnoses,
        extracted_medications: (structuredData.extracted_medications && structuredData.extracted_medications.length > 0)
          ? structuredData.extracted_medications
          : extracted.extracted_medications,
        extracted_investigations: (structuredData.extracted_investigations && structuredData.extracted_investigations.length > 0)
          ? structuredData.extracted_investigations
          : extracted.extracted_investigations,
        advice: structuredData.advice || extracted.advice,
        short_description: structuredData.short_description || extracted.short_description,
      };
    }

    if (!extracted.short_description) {
      extracted.short_description = entityExtractor.generateShortDescription({
        documentType,
        doctor: extracted.doctor_name,
        clinic: extracted.clinic_or_hospital,
        date: extracted.document_date,
        diagnoses: extracted.extracted_diagnoses,
        medications: extracted.extracted_medications,
        advice: extracted.advice,
        rawText,
      });
    }

    const doc = documentStore.addDocument(sessionId, documentType, extracted, rawText);

    return res.json({ document: doc });
  } catch (err) {
    console.error('[documents route] Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:sessionId
router.get('/:sessionId', (req, res) => {
  return res.json({ documents: documentStore.getDocuments(req.params.sessionId) });
});

module.exports = router;

