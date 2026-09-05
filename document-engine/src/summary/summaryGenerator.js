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

  const patientName = (clinicalHistory.patient?.name || '').trim().toLowerCase();
  const documentAlerts = [];

  for (const doc of documents) {
    const docPatientName = (doc.extracted_patient?.name || '').trim().toLowerCase();
    let isMismatch = false;
    let mismatchReason = '';

    if (docPatientName && patientName) {
      const patientWords = patientName.split(/\s+/).filter((w) => w.length > 2);
      const docWords = docPatientName.split(/\s+/).filter((w) => w.length > 2);
      const nameOverlap = patientWords.some((pw) => docWords.some((dw) => dw.includes(pw) || pw.includes(dw)));

      if (!nameOverlap) {
        isMismatch = true;
        mismatchReason = `Document patient (${doc.extracted_patient?.name}${doc.extracted_patient?.age ? ', ' + doc.extracted_patient?.age + 'M' : ''}) does not match current intake patient (${clinicalHistory.patient?.name}${clinicalHistory.patient?.age ? ', ' + clinicalHistory.patient?.age + 'M' : ''})`;
      }
    }

    doc.is_mismatch = isMismatch;
    doc.mismatch_reason = mismatchReason;

    if (isMismatch) {
      documentAlerts.push({
        document_id: doc.document_id || doc.id,
        type: doc.document_type || doc.documentType,
        doc_patient: doc.extracted_patient,
        reason: mismatchReason,
      });
      // CRITICAL SAFETY RULE: Mismatched documents are NOT merged into patient history automatically!
      continue;
    }

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

  const { summaryText } = await llm.generateSummaryText({ clinicalHistory, documents, language, documentAlerts });

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
    document_alerts: documentAlerts,
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
