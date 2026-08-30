const express = require('express');
const documentStore = require('../documents/documentStore');
const summaryGenerator = require('../summary/summaryGenerator');

const router = express.Router();

// POST /api/summary/:sessionId/generate
// body: { clinicalHistory, language }
router.post('/:sessionId/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { clinicalHistory, language } = req.body || {};
    if (!clinicalHistory) {
      return res.status(400).json({ error: 'clinicalHistory is required (pass Person 1\'s summary JSON here)' });
    }

    const documents = documentStore.getDocuments(sessionId);
    const finalSummary = await summaryGenerator.generateFinalSummary({ clinicalHistory, documents, language });

    return res.json(finalSummary);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/summary/:sessionId/translate
// body: { summaryText, targetLanguage }
router.post('/:sessionId/translate', async (req, res) => {
  try {
    const { summaryText, targetLanguage } = req.body || {};
    if (!summaryText || !targetLanguage) {
      return res.status(400).json({ error: 'summaryText and targetLanguage are required' });
    }

    const result = await summaryGenerator.translateSummary({ summaryText, targetLanguage });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
