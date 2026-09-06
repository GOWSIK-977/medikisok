const express = require('express');
const store = require('../session/sessionStore');
const stateMachine = require('../dialogue/stateMachine');

const router = express.Router();

// POST /api/session/start
// body: { name, age, gender, language }
router.post('/start', (req, res) => {
  const { name, age, gender, language, department } = req.body || {};
  if (!name || !age || !gender || !language) {
    return res.status(400).json({ error: 'name, age, gender, and language are required' });
  }

  const session = store.createSession({ name, age, gender, language, department: department || 'GENERAL_MEDICINE' });
  const question = stateMachine.firstQuestion(session);
  session.pendingQuestion = question;

  return res.json({ sessionId: session.id, question });
});

// POST /api/session/:id/answer
// body: { answerText }
router.post('/:id/answer', async (req, res) => {
  try {
    const session = store.getSession(req.params.id);
    const { answerText } = req.body || {};
    if (typeof answerText !== 'string' || !answerText.trim()) {
      return res.status(400).json({ error: 'answerText is required' });
    }
    if (!session.pendingQuestion) {
      return res.status(400).json({ error: 'No pending question for this session' });
    }

    const result = await stateMachine.submitAnswer(session, session.pendingQuestion, answerText);
    session.pendingQuestion = result.nextQuestion;

    return res.json({
      nextQuestion: result.nextQuestion,
      redFlags: result.redFlags,
      sessionComplete: result.sessionComplete,
    });
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

// POST /api/session/:id/finalize
// Finalizes the intake session, extracts all structured clinical data from the transcript,
// and marks the session ready for document merge.
router.post('/:id/finalize', (req, res) => {
  try {
    const session = store.getSession(req.params.id);
    session.currentSection = 'done';

    // Trigger structured transcript extraction asynchronously in background
    if (session.transcript && session.transcript.length > 0) {
      const llm = require('../llm');
      if (typeof llm.extractFullTranscript === 'function') {
        llm.extractFullTranscript({
          transcript: session.transcript,
          schema: session.schema,
          department: session.department,
        }).then((extracted) => {
          if (extracted) {
            if (extracted.chief_complaint && !session.schema.chief_complaint.text) {
              session.schema.chief_complaint.text = extracted.chief_complaint;
              session.schema.chief_complaint.text_en = extracted.chief_complaint;
            }
            if (extracted.hpi) {
              session.schema.hpi = { ...session.schema.hpi, ...extracted.hpi };
            }
            if (extracted.past_medical_history) session.schema.past_medical_history_raw = extracted.past_medical_history;
            if (extracted.past_surgical_history) session.schema.past_surgical_history_raw = extracted.past_surgical_history;
            if (extracted.drug_allergy_history) session.schema.drug_allergy_history_raw = extracted.drug_allergy_history;
            if (extracted.family_history) session.schema.family_history_raw = extracted.family_history;
            if (extracted.personal_history) session.schema.personal_history_raw = extracted.personal_history;

            if (session.schema.ayushAssessment && extracted.ayush_assessment) {
              for (const [k, v] of Object.entries(extracted.ayush_assessment)) {
                if (v && session.schema.ayushAssessment[k]) {
                  session.schema.ayushAssessment[k].patientReported = v;
                }
              }
            }
          }
        }).catch((err) => {
          console.warn('[session finalize] Background extraction error:', err.message);
        });
      }
    }

    return res.json(store.toSummary(session));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

// GET /api/session/:id/summary
router.get('/:id/summary', (req, res) => {
  try {
    const session = store.getSession(req.params.id);
    return res.json(store.toSummary(session));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

module.exports = router;

