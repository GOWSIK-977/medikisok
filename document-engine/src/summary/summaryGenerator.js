const llm = require('../llm');

/**
 * clinicalHistory: the exact JSON returned by Person 1's
 *   GET /api/session/:id/summary endpoint.
 * documents: array from documentStore.getDocuments(sessionId).
 *
 * Returns the final object in the shared schema shape, with document-derived
 * facts merged into past_medical_history / drug_allergy_history using the
 * same { source: "document" } tagging convention the schema defines - so
 * nothing from Person 1's conversation-derived facts gets silently overwritten.
 */
async function generateFinalSummary({ clinicalHistory, documents, language = 'en' }) {
  const mergedPastMedicalHistory = [...(clinicalHistory.past_medical_history || [])];
  const mergedMedications = [...(clinicalHistory.drug_allergy_history?.current_medications || [])];

  for (const doc of documents) {
    for (const dx of doc.extracted_diagnoses || []) {
      const alreadyPresent = mergedPastMedicalHistory.some(
        (existing) => existing.condition?.toLowerCase() === dx.toLowerCase()
      );
      if (!alreadyPresent) {
        mergedPastMedicalHistory.push({ condition: dx, diagnosed_year: '', status: 'active', source: 'document' });
      }
    }
    for (const med of doc.extracted_medications || []) {
      const alreadyPresent = mergedMedications.some(
        (existing) => existing.name?.toLowerCase() === med.name.toLowerCase()
      );
      if (!alreadyPresent) {
        mergedMedications.push({ name: med.name, dosage: med.dosage, frequency: '', source: 'document' });
      }
    }
  }

  const { summaryText } = await llm.generateSummaryText({ clinicalHistory, documents, language });

  const allInvestigations = documents.flatMap((d) => d.extracted_investigations || []);
  const abnormalInvestigationCount = allInvestigations.filter((i) => i.flag !== 'normal').length;

  return {
    ...clinicalHistory,
    past_medical_history: mergedPastMedicalHistory,
    drug_allergy_history: {
      ...(clinicalHistory.drug_allergy_history || {}),
      current_medications: mergedMedications,
    },
    documents,
    clinical_summary_text: summaryText,
    meta: {
      ...(clinicalHistory.meta || {}),
      generated_at: new Date().toISOString(),
      status: 'draft',
      abnormal_investigation_count: abnormalInvestigationCount,
    },
  };
}

async function translateSummary({ summaryText, targetLanguage }) {
  if (typeof llm.translateSummaryText === 'function') {
    return llm.translateSummaryText({ summaryText, targetLanguage });
  }
  return { summaryText };
}

module.exports = { generateFinalSummary, translateSummary };
