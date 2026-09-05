const { v4: uuidv4 } = require('uuid');

const sessions = new Map();

function createSession({ name, age, gender, language, department = 'GENERAL_MEDICINE' }) {
  const id = uuidv4();
  const isAyush = department === 'AYUSH';

  const ayushAssessment = isAyush
    ? {
        prakriti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        vikriti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        sara: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        samhanana: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        pramana: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        satmya: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        sattva: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        ahara_shakti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        vyayama_shakti: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
        vaya: { patientReported: '', clinicianConfirmed: false, clinicianValue: '' },
      }
    : null;

  const session = {
    id,
    department,
    createdAt: new Date().toISOString(),
    currentSection: 'chief_complaint',
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
