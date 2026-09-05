const llm = require('../llm');
const qb = require('./questionBank');

// Fixed section order for a full history. HPI's internal field order is
// decided dynamically once we know the chief complaint category.
const SECTION_ORDER = [
  'chief_complaint',
  'hpi',
  'review_of_systems',
  'past_medical_history',
  'past_surgical_history',
  'drug_allergy_history',
  'family_history',
  'personal_history',
];

function firstQuestion() {
  return {
    section: 'chief_complaint',
    field: 'text',
    prompt: 'What is the main problem that brought you in today?',
  };
}

/**
 * Given the current session state, decide the next question to ask.
 * Returns null when the interview is complete.
 */
function computeNextQuestion(session) {
  const sectionIdx = SECTION_ORDER.indexOf(session.currentSection);

  if (session.currentSection === 'chief_complaint') {
    // Chief complaint just answered -> move into HPI, using the detected
    // complaint category to pick the SOCRATES field order.
    session.complaintCategory = qb.detectComplaintCategory(session.schema.chief_complaint.text_en);
    session.hpiFieldOrder = qb.getHpiFieldOrder(session.complaintCategory);
    session.hpiFieldIndex = 0;
    session.currentSection = 'hpi';
    return nextHpiQuestion(session);
  }

  if (session.currentSection === 'hpi') {
    const q = nextHpiQuestion(session);
    if (q) return q;
    // HPI done -> move to ROS
    session.currentSection = 'review_of_systems';
    session.rosIndex = 0;
    return nextRosQuestion(session);
  }

  if (session.currentSection === 'review_of_systems') {
    const q = nextRosQuestion(session);
    if (q) return q;
    return advanceToNextGenericSection(session, sectionIdx);
  }

  if (session.currentSection === 'ayush_dashavidha_pariksha') {
    const q = nextAyushQuestion(session);
    if (q) return q;
    session.currentSection = 'done';
    return null;
  }

  // Generic single-question sections (past medical, surgical, drug/allergy, family, personal)
  if (['past_medical_history', 'past_surgical_history', 'drug_allergy_history', 'family_history', 'personal_history'].includes(session.currentSection)) {
    return advanceToNextGenericSection(session, sectionIdx);
  }

  return null; // interview complete
}

function nextAyushQuestion(session) {
  const questions = qb.AYUSH_DASHAVIDHA_QUESTIONS;
  if (!questions || session.ayushIndex >= questions.length) return null;
  const q = questions[session.ayushIndex];
  return {
    section: 'ayush_dashavidha_pariksha',
    field: q.field,
    prompt: q.prompt,
    options: q.options,
  };
}

function nextHpiQuestion(session) {
  const fields = session.hpiFieldOrder;
  if (session.hpiFieldIndex >= fields.length) return null;
  const field = fields[session.hpiFieldIndex];
  return {
    section: 'hpi',
    field,
    prompt: qb.SOCRATES_TEMPLATES[field],
  };
}

function nextRosQuestion(session) {
  const questions = qb.ROS_QUESTIONS;
  if (session.rosIndex >= questions.length) return null;
  const { system, question } = questions[session.rosIndex];
  return { section: 'review_of_systems', field: system, prompt: question };
}

function advanceToNextGenericSection(session, currentIdx) {
  const nextIdx = currentIdx + 1;
  if (nextIdx >= SECTION_ORDER.length) {
    if (session.department === 'AYUSH') {
      session.currentSection = 'ayush_dashavidha_pariksha';
      return nextAyushQuestion(session);
    }
    session.currentSection = 'done';
    return null;
  }
  const nextSection = SECTION_ORDER[nextIdx];
  session.currentSection = nextSection;

  if (nextSection === 'review_of_systems') {
    session.rosIndex = 0;
    return nextRosQuestion(session);
  }

  const prompts = qb.HISTORY_SECTIONS[nextSection];
  if (prompts) {
    return { section: nextSection, field: 'text', prompt: prompts[0] };
  }
  return advanceToNextGenericSection(session, nextIdx);
}

/**
 * Record a patient's answer to the current question into session.schema,
 * run red-flag detection, and compute the next question.
 */
async function submitAnswer(session, currentQuestion, rawAnswerText) {
  session.transcript.push(rawAnswerText);

  // If in AYUSH Dashavidha section, store patientReported answer directly and move to next AYUSH question
  if (session.currentSection === 'ayush_dashavidha_pariksha') {
    const field = currentQuestion.field;
    if (session.schema.ayushAssessment && session.schema.ayushAssessment[field]) {
      session.schema.ayushAssessment[field].patientReported = rawAnswerText;
    }
    session.ayushIndex = (session.ayushIndex || 0) + 1;
    const nextQ = computeNextQuestion(session);

    const detectedFlags = await llm.detectRedFlag({ transcript: session.transcript }).catch((err) => []);
    const newlyTriggered = [];
    for (const rf of (detectedFlags || [])) {
      const alreadyKnown = session.schema.red_flags.some((existing) => existing.flag === rf.flag);
      if (!alreadyKnown) {
        const withTimestamp = { ...rf, timestamp: new Date().toISOString() };
        session.schema.red_flags.push(withTimestamp);
        newlyTriggered.push(withTimestamp);
      }
    }
    return { nextQuestion: nextQ, redFlags: newlyTriggered, sessionComplete: nextQ === null };
  }

  let nextQuestion = null;
  let dynamicProcessed = false;

  // Run dynamic entity extraction and red flag detection in parallel for speed
  const [dynamicResult, detectedFlags] = await Promise.all([
    (typeof llm.extractAllEntitiesAndNextQuestion === 'function')
      ? llm.extractAllEntitiesAndNextQuestion({
          session,
          rawAnswerText,
          lastQuestion: currentQuestion,
        }).catch((err) => {
          console.warn('[stateMachine] Dynamic extraction notice:', err.message);
          return null;
        })
      : Promise.resolve(null),
    llm.detectRedFlag({ transcript: session.transcript }).catch((err) => {
      console.warn('[stateMachine] Red flag detection notice:', err.message);
      return [];
    }),
  ]);

  if (dynamicResult && dynamicResult.extracted_fields) {
    dynamicProcessed = true;
    mergeExtractedFieldsToSchema(session, dynamicResult.extracted_fields);

    if (dynamicResult.action === 'complete' || session.transcript.length >= 8) {
      session.currentSection = 'done';
      nextQuestion = null;
    } else if (dynamicResult.question && dynamicResult.question.trim()) {
      session.currentSection = 'hpi';
      nextQuestion = {
        section: 'hpi',
        field: dynamicResult.target_field || 'followup',
        prompt: dynamicResult.question.trim(),
      };
    }
  }

  // Fallback ONLY if Gemini was not active or dynamic extraction returned nothing
  if (!dynamicProcessed && nextQuestion === null && session.currentSection !== 'done') {
    const { value } = await llm.extractStructuredAnswer({
      field: currentQuestion.field,
      question: currentQuestion.prompt,
      rawText: rawAnswerText,
    });

    writeAnswerToSchema(session, currentQuestion, value);

    if (session.currentSection === 'hpi') session.hpiFieldIndex += 1;
    if (session.currentSection === 'review_of_systems') session.rosIndex += 1;

    nextQuestion = computeNextQuestion(session);
  }

  // Record newly detected red flags
  const newlyTriggered = [];
  for (const rf of (detectedFlags || [])) {
    const alreadyKnown = session.schema.red_flags.some((existing) => existing.flag === rf.flag);
    if (!alreadyKnown) {
      const withTimestamp = { ...rf, timestamp: new Date().toISOString() };
      session.schema.red_flags.push(withTimestamp);
      newlyTriggered.push(withTimestamp);
    }
  }

  return { nextQuestion, redFlags: newlyTriggered, sessionComplete: nextQuestion === null };
}

function mergeExtractedFieldsToSchema(session, extracted) {
  const schema = session.schema;
  if (!schema) return;

  if (extracted.chief_complaint && !schema.chief_complaint.text) {
    schema.chief_complaint.text = extracted.chief_complaint;
    schema.chief_complaint.text_en = extracted.chief_complaint;
  }
  for (const field of ['onset', 'location', 'character', 'severity', 'radiation', 'associated_symptoms', 'exacerbating_factors', 'relieving_factors']) {
    if (extracted[field] && !schema.hpi[field]) {
      schema.hpi[field] = extracted[field];
    }
  }
  if (extracted.review_of_systems_general) {
    schema.review_of_systems.general = [extracted.review_of_systems_general];
  }
  if (extracted.past_medical_history) schema.past_medical_history_raw = extracted.past_medical_history;
  if (extracted.past_surgical_history) schema.past_surgical_history_raw = extracted.past_surgical_history;
  if (extracted.drug_allergy_history) schema.drug_allergy_history_raw = extracted.drug_allergy_history;
  if (extracted.family_history) schema.family_history_raw = extracted.family_history;
  if (extracted.personal_history) schema.personal_history_raw = extracted.personal_history;
}

function writeAnswerToSchema(session, question, value) {
  const { section, field } = question;
  const schema = session.schema;

  if (section === 'chief_complaint') {
    schema.chief_complaint.text = value;
    schema.chief_complaint.text_en = value;
    return;
  }
  if (section === 'hpi') {
    schema.hpi[field] = value;
    return;
  }
  if (section === 'review_of_systems') {
    schema.review_of_systems[field] = value && value.toLowerCase() !== 'no' ? [value] : [];
    return;
  }
  schema[`${section}_raw`] = value;
}

module.exports = { firstQuestion, computeNextQuestion, submitAnswer, SECTION_ORDER };
