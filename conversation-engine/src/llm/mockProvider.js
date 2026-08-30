/**
 * Mock LLM provider.
 *
 * Deterministic, zero-dependency stand-in for a real model call. Good enough
 * to build and test the whole conversation flow end-to-end. Swap for
 * anthropicProvider.js later without touching anything else.
 */

/**
 * Turn a patient's raw free-text answer into a structured value for a given
 * HPI/history field. The mock does light heuristic cleanup; a real LLM call
 * would do proper NLU here (e.g. extracting "3 days" from "since Monday-ish,
 * so about three days now").
 */
async function extractStructuredAnswer({ field, question, rawText }) {
  const cleaned = (rawText || '').trim();

  // A couple of very simple heuristics just so the mock feels alive in demo.
  if (field === 'severity') {
    const numMatch = cleaned.match(/\d+/);
    if (numMatch) return { value: `${numMatch[0]}/10`, confidence: 0.6 };
  }

  return { value: cleaned, confidence: 0.5 };
}

/**
 * Rephrase a canned question template naturally for the patient, optionally
 * personalizing using context (e.g. their chief complaint, language).
 * The mock just returns the template unchanged - a real LLM call would
 * make this sound more like a clinician talking, and would translate it.
 */
async function rephraseQuestion({ templateQuestion /*, context */ }) {
  return templateQuestion;
}

/**
 * Scan accumulated conversation text for emergency-pattern symptom
 * combinations. The mock uses simple keyword co-occurrence; a real LLM
 * call would reason over the full transcript instead of just matching words.
 */
const RED_FLAG_RULES = require('../dialogue/redFlags').RULES;

async function detectRedFlag({ transcript }) {
  const fullText = transcript.join(' ').toLowerCase();
  const triggered = [];

  for (const rule of RED_FLAG_RULES) {
    const hitCount = rule.keywords.filter((kw) => fullText.includes(kw)).length;
    if (hitCount >= rule.minMatches) {
      triggered.push({
        flag: rule.id,
        severity: rule.severity,
        triggered_by: rule.keywords.filter((kw) => fullText.includes(kw)).join(', '),
      });
    }
  }

  return triggered;
}

module.exports = { extractStructuredAnswer, rephraseQuestion, detectRedFlag };
