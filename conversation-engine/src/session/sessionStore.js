const { v4: uuidv4 } = require('uuid');

const sessions = new Map();

function createSession({ name, age, gender, language, department = 'GENERAL_MEDICINE' }) {
  const id = uuidv4();
  const isAyush = department === 'AYUSH';

  const ayushAssessment = isAyush
    ? {
        // Core AYUSH clinical parameters mapped from patient natural responses
        prakriti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Thermal & skin traits' },
        vikriti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Present symptoms & triggers' },
        agni: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Hunger, digestion, acidity & bloating' },
        koshtha: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Stool & bowel evacuation nature' },
        sara: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Tissue vitality & endurance' },
        samhanana: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Body compactness & build' },
        pramana: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Height, weight & proportions' },
        satmya: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Food adaptability & taste preference' },
        sattva: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Mental resilience & stress coping' },
        ahara_shakti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Food intake capacity & appetite' },
        vyayama_shakti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Physical strength & exercise tolerance' },
        nidra: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Sleep quality & waking freshness' },
        vihara: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Daily lifestyle, hydration & habits' },
        vaya: { patientReported: '', clinicianConfirmed: false, clinicianValue: '', clinicalIndicator: 'Age stage classification' },
      }
    : null;

  const session = {
    id,
    department,
    createdAt: new Date().toISOString(),
    currentSection: isAyush ? 'ayush_intake' : 'chief_complaint',
    complaintCategory: null,
    hpiFieldOrder: [],
    hpiFieldIndex: 0,
    rosIndex: 0,
    ayushIndex: 0,
    transcript: [],
    schema: {
      department,
      patient: { name, age, gender, preferred_language: language },
      chief_complaint: { text: '', text_en: '', duration: '' },
      hpi: {},
      review_of_systems: {},
      red_flags: [],
      ayushAssessment,
      meta: { generated_at: null, status: 'draft' },
    },
  };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error(`Session ${id} not found`);
  return session;
}

function toSummary(session) {
  return {
    ...session.schema,
    meta: {
      ...session.schema.meta,
      generated_at: new Date().toISOString(),
      status: session.currentSection === 'done' ? 'draft' : 'in_progress',
    },
  };
}

module.exports = { createSession, getSession, toSummary };
