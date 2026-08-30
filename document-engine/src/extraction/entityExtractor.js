/**
 * Rule-based extraction, same philosophy as Person 1's state machine: keep
 * the core logic deterministic and demo-reliable, use the LLM only where it
 * genuinely adds value (see llm/mockProvider.js's extractEntitiesLLM stub
 * for where a real model could take over messy/handwritten cases later).
 */

const KNOWN_DIAGNOSES = [
  'type 2 diabetes mellitus', 'diabetes mellitus', 'diabetes',
  'essential hypertension', 'hypertension', 'hypertensive urgency',
  'coronary artery disease', 'hyperlipidemia', 'asthma', 'hypothyroidism',
];

function extractDiagnoses(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const dx of KNOWN_DIAGNOSES) {
    if (lower.includes(dx)) found.push(dx.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  // Drop any match that's a strict substring of a longer match already found
  // (e.g. "Diabetes" is redundant once "Type 2 Diabetes Mellitus" matched).
  const deduped = found.filter((dx, i) =>
    !found.some((other, j) => i !== j && other.length > dx.length && other.toLowerCase().includes(dx.toLowerCase()))
  );
  return Array.from(new Set(deduped));
}

// Matches lines like: "Tab. Metformin 500mg BD" / "Cap Atorvastatin 10mg OD (night)"
const MED_LINE_REGEX = /^(?:Tab\.?|Cap\.?|Inj\.?|Syp\.?)\s+([A-Za-z][A-Za-z\s]*?)\s+(\d+\s?mg)\s*(OD|BD|TDS|QID)?/i;

function extractMedications(text) {
  const meds = [];
  for (const line of text.split('\n')) {
    const match = line.trim().match(MED_LINE_REGEX);
    if (match) {
      meds.push({
        name: match[1].trim(),
        dosage: `${match[2]}${match[3] ? ' ' + match[3] : ''}`,
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
      // "< X" style range
      const upper = parseFloat(match[3]);
      referenceRange = `< ${upper}`;
      flag = value > upper ? 'high' : 'normal';
    } else if (match[4] && match[5]) {
      // "X - Y" style range
      const lower = parseFloat(match[4]);
      const upper = parseFloat(match[5]);
      referenceRange = `${lower} - ${upper}`;
      flag = value < lower ? 'low' : value > upper ? 'high' : 'normal';
    } else if (match[6]) {
      // "> X" style range
      const lower = parseFloat(match[6]);
      referenceRange = `> ${lower}`;
      flag = value < lower ? 'low' : 'normal';
    }

    results.push({ test_name: testName, value: String(value), reference_range: referenceRange, flag });
  }
  return results;
}

// Matches DD/MM/YYYY or DD-MM-YYYY, returns the first one found (used as document_date)
const DATE_REGEX = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;

function extractDocumentDate(text) {
  const match = text.match(DATE_REGEX);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractAll(rawText) {
  return {
    extracted_diagnoses: extractDiagnoses(rawText),
    extracted_medications: extractMedications(rawText),
    extracted_investigations: extractInvestigations(rawText),
    document_date: extractDocumentDate(rawText),
  };
}

module.exports = { extractAll, extractDiagnoses, extractMedications, extractInvestigations, extractDocumentDate };
