/**
 * Mock LLM provider. Templated but genuinely reads the merged data, so the
 * output text changes correctly if the underlying data changes - this is
 * what makes it a believable stand-in for a real model call in the demo.
 */

async function generateSummaryText({ clinicalHistory, documents }) {
  const cc = clinicalHistory?.chief_complaint?.text_en || 'unspecified complaint';
  const hpi = clinicalHistory?.hpi || {};
  const redFlags = clinicalHistory?.red_flags || [];

  const hpiLine = [hpi.onset, hpi.character, hpi.radiation, hpi.associated_symptoms]
    .filter(Boolean)
    .join('; ');

  const allDx = new Set();
  const allMeds = [];
  for (const doc of documents || []) {
    (doc.extracted_diagnoses || []).forEach((d) => allDx.add(d));
    (doc.extracted_medications || []).forEach((m) => allMeds.push(`${m.name} ${m.dosage}`));
  }

  const abnormalLabs = (documents || [])
    .flatMap((d) => d.extracted_investigations || [])
    .filter((inv) => inv.flag !== 'normal');

  let summary = `Chief complaint: ${cc}. `;
  if (hpiLine) summary += `HPI: ${hpiLine}. `;
  if (allDx.size) summary += `Known history: ${Array.from(allDx).join(', ')}. `;
  if (allMeds.length) summary += `Current medications (per prior records): ${allMeds.join(', ')}. `;
  if (abnormalLabs.length) {
    const labText = abnormalLabs.map((l) => `${l.test_name} ${l.value} (${l.flag}, ref ${l.reference_range})`).join('; ');
    summary += `Abnormal investigations: ${labText}. `;
  }
  if (redFlags.length) {
    summary += `RED FLAGS: ${redFlags.map((f) => f.flag).join(', ')} - recommend prioritized review. `;
  }

  return { summaryText: summary.trim() };
}

module.exports = { generateSummaryText };
