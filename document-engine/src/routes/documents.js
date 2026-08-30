const express = require('express');
const ocr = require('../ocr');
const entityExtractor = require('../extraction/entityExtractor');
const documentStore = require('../documents/documentStore');

const router = express.Router();

// POST /api/documents/:sessionId/upload
// body: { documentType: "prescription"|"lab_report"|"discharge_summary", imageBase64?: "..." }
// With OCR_PROVIDER=mock (default), imageBase64 is ignored and canned demo
// text is used instead - so this works without any real scanned image.
router.post('/:sessionId/upload', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { documentType, imageBase64 } = req.body || {};
    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required' });
    }

    const { rawText } = await ocr.recognize({ documentType, imageBase64 });
    const extracted = entityExtractor.extractAll(rawText);
    const doc = documentStore.addDocument(sessionId, documentType, extracted, rawText);

    return res.json({ document: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:sessionId
router.get('/:sessionId', (req, res) => {
  return res.json({ documents: documentStore.getDocuments(req.params.sessionId) });
});

module.exports = router;
