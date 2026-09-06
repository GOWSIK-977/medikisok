/**
 * Robust medical entity extractor for document-engine.
 * Combines clinical regex patterns, known pharmacological agents, and
 * fallback synthesis to ensure prescriptions, lab reports, and discharge
 * summaries produce structured clinical records and doctor report descriptions.
 */

const KNOWN_DIAGNOSES = [
  'rheumatoid arthritis', 'atypical rf +ve', 'rf positive', 'osteoarthritis', 'knee osteoarthritis',
  'arthritis', 'gout', 'ankylosing spondylitis', 'joint pain', 'synovitis',
  'type 2 diabetes mellitus', 'diabetes mellitus', 'diabetes',
  'essential hypertension', 'hypertension', 'hypertensive urgency',
  'coronary artery disease', 'hyperlipidemia', 'dyslipidemia', 'asthma', 'hypothyroidism',
  'gerd', 'gastritis', 'peptic ulcer disease', 'chronic kidney disease'
];

function extractDiagnoses(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const dx of KNOWN_DIAGNOSES) {
    if (lower.includes(dx)) {
      found.push(dx.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }

  // Also look for explicit "Diagnosis:" or "? RA" patterns
  const diagMatch = text.match(/(?:Diagnosis|Impression|Clinical Impression):\s*([^\n\r]+)/i);
  if (diagMatch && diagMatch[1]) {
    const rawItems = diagMatch[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    for (const item of rawItems) {
      if (!found.some((f) => f.toLowerCase() === item.toLowerCase())) {
        found.push(item);
      }
    }
  }

  if (lower.includes('? ra') && !found.some((f) => f.toLowerCase().includes('rheumatoid'))) {
    found.unshift('Suspected Rheumatoid Arthritis (? RA RF+ve)');
  }

  const deduped = found.filter((dx, i) =>
    !found.some((other, j) => i !== j && other.length > dx.length && other.toLowerCase().includes(dx.toLowerCase()))
  );
  return Array.from(new Set(deduped));
}

// Matches lines like:
// "Tab. Metformin 500mg BD"
// "1) Tab Meditrex 15 once/week"
// "3) Tab Predsolan (8) twice daily"
// "4) Tab Etoric (90) OD x 5 days"
// "5) Tab Driper-DSR OD (BBF)"
const MED_LINE_REGEX = /(?:^\d+[\).]\s*)?(?:Tab\.?|Cap\.?|Inj\.?|Syp\.?)\s+([A-Za-z0-9\s\/\-+]+?)\s+(?:(?:\((\d+)\)|\b(\d+\s*(?:mg|gm|ml)?))\b)?\s*([A-Za-z0-9\s\(\)\/\-]+)?$/im;

function extractMedications(text) {
  const meds = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(?:Tab\.?|Cap\.?|Inj\.?|Syp\.?|\d+[\).]\s*(?:Tab|Cap|Inj|Syp))/i.test(line)) {
      const match = line.match(MED_LINE_REGEX);
      if (match) {
        const drugName = match[1]?.trim() || line;
        const dose = match[2] || match[3] || '';
        const freq = match[4]?.trim() || '';
        meds.push({
          name: drugName,
          dosage: dose ? `${dose}${dose.endsWith('mg') || dose.endsWith('gm') ? '' : 'mg'}` : '',
          frequency: freq || 'As directed',
        });
        continue;
      }
      // Fallback clean extraction of medication line
      meds.push({
        name: line.replace(/^\d+[\).]\s*/, ''),
        dosage: '',
        frequency: 'As directed',
      });
    }
  }
  return meds;
}

// Matches lab report lines like: "HbA1c   8.2   4.0 - 6.0"
const INVESTIGATION_LINE_REGEX = /^([A-Za-z][A-Za-z0-9\s]*?)\s{2,}([\d.]+)\s+(?:<\s*([\d.]+)|([\d.]+)\s*-\s*([\d.]+)|>\s*([\d.]+))/;

function extractInvestigations(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const match = line.match(INVESTIGATION_LINE_REGEX);
    if (!match) continue;

    const testName = match[1].trim();
    const value = parseFloat(match[2]);
    let referenceRange = '';
    let flag = 'normal';

    if (match[3]) {
      const upper = parseFloat(match[3]);
      referenceRange = `< ${upper}`;
      flag = value > upper ? 'high' : 'normal';
    } else if (match[4] && match[5]) {
      const lower = parseFloat(match[4]);
      const upper = parseFloat(match[5]);
      referenceRange = `${lower} - ${upper}`;
      flag = value < lower ? 'low' : value > upper ? 'high' : 'normal';
    } else if (match[6]) {
      const lower = parseFloat(match[6]);
      referenceRange = `> ${lower}`;
      flag = value < lower ? 'low' : 'normal';
    }

    results.push({ test_name: testName, value: String(value), reference_range: referenceRange, flag });
  }
  return results;
}

// Matches DD/MM/YYYY or DD-MM-YYYY
const DATE_REGEX = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;

function extractDocumentDate(text) {
  const match = text.match(DATE_REGEX);
  if (!match) return null;
  let [, day, month, year] = match;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Matches patient lines like: "Patient: Ramesh Kumar, 52M" or "Patient Name: Urmila Devi", "Age: 48 / F"
function extractDocumentPatient(text) {
  let name = null;
  let age = null;
  let gender = null;

  const nameMatch = text.match(/(?:Patient(?:\s+Name)?|Name):\s*([A-Za-z\s.]+?)(?:,\s*(\d{1,3})\s*([MFmf])|\s*[\r\n]|$)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
    if (nameMatch[2]) age = parseInt(nameMatch[2], 10);
    if (nameMatch[3]) gender = nameMatch[3].toUpperCase() === 'M' ? 'Male' : 'Female';
  }

  const ageMatch = text.match(/Age:\s*(\d{1,3})\s*(?:\/|\s*,\s*)?\s*([MFmf])/i);
  if (ageMatch) {
    if (!age) age = parseInt(ageMatch[1], 10);
    if (!gender) gender = ageMatch[2].toUpperCase() === 'M' ? 'Male' : 'Female';
  }

  if (name && name.length > 2) {
    return { name, age, gender };
  }
  return null;
}

function extractDoctorInfo(text) {
  let doctorName = null;
  let specialty = null;
  let clinic = null;

  const docMatch = text.match(/(?:Dr\.\s+[A-Za-z\s.]+)/i);
  if (docMatch) {
    doctorName = docMatch[0].trim();
  }

  const specMatch = text.match(/(?:Consultant\s+[A-Za-z\s]+|MBBS[^\n\r]+)/i);
  if (specMatch) {
    specialty = specMatch[0].trim();
  }

  const clinicMatch = text.match(/(?:[A-Za-z\s&]+(?:Hospital|Clinic|Center|Dispensary|Medical Center)[^\n\r]*)/i);
  if (clinicMatch) {
    clinic = clinicMatch[0].trim();
  }

  return { doctorName, specialty, clinic };
}

function generateShortDescription({ documentType, doctor, clinic, date, diagnoses = [], medications = [], advice, rawText }) {
  const docTypeLabel = documentType === 'prescription' ? 'Previous prescription' : documentType === 'lab_report' ? 'Previous lab report' : 'Discharge summary';
  const docStr = doctor ? ` by ${doctor}` : '';
  const clinicStr = clinic ? ` (${clinic})` : '';
  const dateStr = date ? ` dated ${date}` : '';
  const dxStr = diagnoses.length > 0 ? ` for ${diagnoses.join(', ')}` : '';

  let medStr = '';
  if (medications.length > 0) {
    const medNames = medications.map((m) => `${m.name}${m.dosage ? ' ' + m.dosage : ''}${m.frequency ? ' (' + m.frequency + ')' : ''}`);
    medStr = ` Previous prescribed regimen includes: ${medNames.join('; ')}.`;
  }

  let adviceStr = '';
  if (advice) {
    adviceStr = ` Advice noted: ${advice}.`;
  }

  return `${docTypeLabel}${dateStr}${docStr}${clinicStr}${dxStr}.${medStr}${adviceStr}`.trim();
}

function extractAll(rawText) {
  const docInfo = extractDoctorInfo(rawText);
  const diagnoses = extractDiagnoses(rawText);
  const medications = extractMedications(rawText);
  const investigations = extractInvestigations(rawText);
  const patient = extractDocumentPatient(rawText);
  const date = extractDocumentDate(rawText);

  let advice = null;
  const adviceMatch = rawText.match(/Advice:\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
  if (adviceMatch) advice = adviceMatch[1].trim();

  const shortDescription = generateShortDescription({
    documentType: 'prescription',
    doctor: docInfo.doctorName,
    clinic: docInfo.clinic,
    date,
    diagnoses,
    medications,
    advice,
    rawText,
  });

  return {
    doctor_name: docInfo.doctorName,
    doctor_specialty: docInfo.specialty,
    clinic_or_hospital: docInfo.clinic,
    extracted_patient: patient,
    extracted_diagnoses: diagnoses,
    extracted_medications: medications,
    extracted_investigations: investigations,
    document_date: date,
    advice,
    short_description: shortDescription,
  };
}

module.exports = {
  extractAll,
  extractDiagnoses,
  extractMedications,
  extractInvestigations,
  extractDocumentDate,
  extractDocumentPatient,
  extractDoctorInfo,
  generateShortDescription,
};

