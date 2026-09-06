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

function firstQuestion(session) {
  const lang = session?.schema?.patient?.preferred_language || session?.language || 'en';
  if (session && session.department === 'AYUSH') {
    session.currentSection = 'ayush_intake';
    session.ayushIndex = 0;
    return nextAyushQuestion(session);
  }
  return {
    section: 'chief_complaint',
    field: 'text',
    prompt: qb.getGeneralMedicineInitialQuestion(lang),
  };
}

/**
 * Given the current session state, decide the next question to ask.
 * Returns null when the interview is complete.
 */
function computeNextQuestion(session) {
  if (session.currentSection === 'ayush_intake' || session.currentSection === 'ayush_dashavidha_pariksha') {
    const q = nextAyushQuestion(session);
    if (q) return q;
    session.currentSection = 'done';
    return null;
  }

  const sectionIdx = SECTION_ORDER.indexOf(session.currentSection);

  if (session.currentSection === 'chief_complaint') {
    // Chief complaint just answered -> move into HPI, using the detected
    // complaint category to pick the SOCRATES field order.
    session.complaintCategory = qb.detectComplaintCategory(session.schema.chief_complaint.text_en || session.schema.chief_complaint.text);
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

  // Generic single-question sections (past medical, surgical, drug/allergy, family, personal)
  if (['past_medical_history', 'past_surgical_history', 'drug_allergy_history', 'family_history', 'personal_history'].includes(session.currentSection)) {
    return advanceToNextGenericSection(session, sectionIdx);
  }

  return null; // interview complete
}

function nextAyushQuestion(session) {
  const questions = qb.AYUSH_INTAKE_QUESTIONS;
  if (!questions || session.ayushIndex >= questions.length) return null;
  const q = questions[session.ayushIndex];
  const lang = session.schema?.patient?.preferred_language || session.language || 'en';
  return {
    section: 'ayush_intake',
    field: q.field,
    ayushField: q.ayushField,
    domainLabel: q.domainLabel,
    prompt: qb.getAyushQuestionPrompt(q, lang),
    options: q.options,
    category: q.category,
    step: session.ayushIndex + 1,
    totalSteps: questions.length,
  };
}

function nextHpiQuestion(session) {
  const fields = session.hpiFieldOrder;
  if (!fields || session.hpiFieldIndex >= fields.length) return null;
  const field = fields[session.hpiFieldIndex];
  const lang = session.schema?.patient?.preferred_language || session.language || 'en';
  return {
    section: 'hpi',
    field,
    prompt: qb.getHpiQuestionPrompt(field, lang),
  };
}

function nextRosQuestion(session) {
  const questions = qb.ROS_QUESTIONS;
  if (!questions || session.rosIndex >= questions.length) return null;
  const rosItem = questions[session.rosIndex];
  const lang = session.schema?.patient?.preferred_language || session.language || 'en';
  return {
    section: 'review_of_systems',
    field: rosItem.system,
    prompt: qb.getRosQuestionPrompt(rosItem, lang),
  };
}

function advanceToNextGenericSection(session, currentIdx) {
  const nextIdx = currentIdx + 1;
  if (nextIdx >= SECTION_ORDER.length) {
    if (session.department === 'AYUSH') {
      session.currentSection = 'ayush_intake';
      session.ayushIndex = 0;
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

  const lang = session.schema?.patient?.preferred_language || session.language || 'en';
  const prompt = qb.getHistorySectionPrompt(nextSection, lang);
  return { section: nextSection, field: 'text', prompt };
}

/**
 * Record a patient's answer to the current question into session.schema,
 * run red-flag detection, and compute the next question.
 */
async function submitAnswer(session, currentQuestion, rawAnswerText) {
  session.transcript.push(`Patient: ${rawAnswerText}`);

  // If in AYUSH Intake section, map patient natural answer into structured AYUSH fields
  if (session.currentSection === 'ayush_intake' || session.currentSection === 'ayush_dashavidha_pariksha') {
    const field = currentQuestion.field;
    const ayushField = currentQuestion.ayushField || field;

    if (session.schema.ayushAssessment) {
      if (session.schema.ayushAssessment[ayushField]) {
        session.schema.ayushAssessment[ayushField].patientReported = rawAnswerText;
      }
      // Cross-mappings to complete the 10-fold Dashavidha and digestive/bowel profiles
      if (field === 'hunger_digestion') {
        if (session.schema.ayushAssessment.agni) session.schema.ayushAssessment.agni.patientReported = rawAnswerText;
        if (session.schema.ayushAssessment.ahara_shakti) session.schema.ayushAssessment.ahara_shakti.patientReported = rawAnswerText;
      }
      if (field === 'bowel_habits') {
        if (session.schema.ayushAssessment.koshtha) session.schema.ayushAssessment.koshtha.patientReported = rawAnswerText;
      }
      if (field === 'exercise_strength') {
        if (session.schema.ayushAssessment.vyayama_shakti) session.schema.ayushAssessment.vyayama_shakti.patientReported = rawAnswerText;
        if (session.schema.ayushAssessment.sara) session.schema.ayushAssessment.sara.patientReported = rawAnswerText;
      }
      if (field === 'body_build') {
        if (session.schema.ayushAssessment.samhanana) session.schema.ayushAssessment.samhanana.patientReported = rawAnswerText;
        if (session.schema.ayushAssessment.pramana) session.schema.ayushAssessment.pramana.patientReported = rawAnswerText;
      }
    }

    // General medical mappings
    if (field === 'current_symptoms' || ayushField === 'vikriti') {
      session.schema.chief_complaint.text = rawAnswerText;
      session.schema.chief_complaint.text_en = rawAnswerText;
    }
    if (field === 'general_medical_history') {
      session.schema.past_medical_history_raw = rawAnswerText;
    }
    if (field === 'food_habits') {
      session.schema.personal_history_raw = (session.schema.personal_history_raw ? session.schema.personal_history_raw + '; ' : '') + 'Diet: ' + rawAnswerText;
    }
    if (field === 'lifestyle_habits') {
      session.schema.personal_history_raw = (session.schema.personal_history_raw ? session.schema.personal_history_raw + '; ' : '') + 'Habits: ' + rawAnswerText;
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
