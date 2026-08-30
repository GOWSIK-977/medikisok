/**
 * The adaptive branching logic is deterministic on purpose (per the design
 * discussion: flow control is rule-based, the LLM only handles phrasing and
 * free-text parsing). This keeps live demos predictable.
 */

// SOCRATES field templates, shared across complaint types
const SOCRATES_TEMPLATES = {
  onset: 'When did this start?',
  location: 'Where exactly do you feel it?',
  character: 'How would you describe it - sharp, dull, burning, cramping?',
  radiation: 'Does it spread anywhere else, like your arm, back, or jaw?',
  associated_symptoms: 'Is there anything else you\'ve noticed along with it, like nausea, sweating, or breathlessness?',
  timing: 'Is it constant, or does it come and go?',
  exacerbating_factors: 'Does anything make it worse - movement, eating, breathing in deeply?',
  relieving_factors: 'Does anything make it better - rest, medicine, a certain position?',
  severity: 'On a scale of 1 to 10, how bad is it right now?',
};

// Which SOCRATES fields to ask, and in what order, per chief-complaint category.
// "default" is the fallback for anything that doesn't match a known keyword set.
const COMPLAINT_FLOWS = {
  chest_pain: ['onset', 'location', 'character', 'radiation', 'associated_symptoms', 'exacerbating_factors', 'relieving_factors', 'severity'],
  abdominal_pain: ['onset', 'location', 'character', 'associated_symptoms', 'timing', 'exacerbating_factors', 'relieving_factors', 'severity'],
  headache: ['onset', 'location', 'character', 'associated_symptoms', 'timing', 'exacerbating_factors', 'relieving_factors', 'severity'],
  fever: ['onset', 'timing', 'associated_symptoms', 'severity'],
  cough: ['onset', 'character', 'timing', 'associated_symptoms', 'exacerbating_factors', 'severity'],
  default: ['onset', 'location', 'character', 'associated_symptoms', 'timing', 'exacerbating_factors', 'relieving_factors', 'severity'],
};

// Keyword -> complaint category, used to pick a flow from the free-text chief complaint.
const COMPLAINT_KEYWORDS = {
  chest_pain: ['chest pain', 'chest', 'seene mein dard', 'seene'],
  abdominal_pain: ['stomach', 'abdomen', 'abdominal', 'pet mein', 'belly'],
  headache: ['headache', 'head pain', 'sar mein dard', 'migraine'],
  fever: ['fever', 'bukhar', 'temperature'],
  cough: ['cough', 'khaansi', 'khansi'],
};

function detectComplaintCategory(chiefComplaintText) {
  const text = (chiefComplaintText || '').toLowerCase();
  for (const [category, keywords] of Object.entries(COMPLAINT_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return 'default';
}

function getHpiFieldOrder(complaintCategory) {
  return COMPLAINT_FLOWS[complaintCategory] || COMPLAINT_FLOWS.default;
}

// Quick yes/no-style review of systems, kept short for OPD time constraints.
const ROS_QUESTIONS = [
  { system: 'cardiovascular', question: 'Any chest pain, palpitations, or breathlessness on exertion?' },
  { system: 'respiratory', question: 'Any cough, breathlessness, or wheezing?' },
  { system: 'gastrointestinal', question: 'Any nausea, vomiting, changes in appetite, or bowel habits?' },
  { system: 'genitourinary', question: 'Any burning urination, frequency, or blood in urine?' },
  { system: 'neurological', question: 'Any headaches, dizziness, weakness, or numbness?' },
  { system: 'musculoskeletal', question: 'Any joint pain, stiffness, or swelling?' },
  { system: 'general', question: 'Any recent weight loss, fatigue, or fever?' },
];

// Short generic sections asked once, after HPI + ROS.
const HISTORY_SECTIONS = {
  past_medical_history: ['Do you have any long-term illnesses, like diabetes, high blood pressure, asthma, or thyroid problems?'],
  past_surgical_history: ['Have you had any surgeries in the past? If so, what and when?'],
  drug_allergy_history: ['Are you currently taking any medications? Do you have any known drug allergies?'],
  family_history: ['Does anyone in your immediate family have any major illnesses, like heart disease, diabetes, or cancer?'],
  personal_history: ['Could you tell me about your diet, and whether you smoke or drink alcohol?'],
};

module.exports = {
  SOCRATES_TEMPLATES,
  COMPLAINT_FLOWS,
  detectComplaintCategory,
  getHpiFieldOrder,
  ROS_QUESTIONS,
  HISTORY_SECTIONS,
};
