const { v4: uuidv4 } = require('uuid');

// sessionId -> array of document objects
const documentsBySession = new Map();

function addDocument(sessionId, documentType, extracted, rawText) {
  const doc = {
    document_id: uuidv4(),
    document_type: documentType,
    document_date: extracted.document_date,
    raw_ocr_text: rawText,
    extracted_diagnoses: extracted.extracted_diagnoses,
    extracted_medications: extracted.extracted_medications,
    extracted_investigations: extracted.extracted_investigations,
  };
  const existing = documentsBySession.get(sessionId) || [];
  existing.push(doc);
  documentsBySession.set(sessionId, existing);
  return doc;
}

function getDocuments(sessionId) {
  return documentsBySession.get(sessionId) || [];
}

module.exports = { addDocument, getDocuments };
