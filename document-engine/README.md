# MediKiosk — Module B: Document Intelligence + Summary Generator
### (Person 2's component — SIH26047 / MediKiosk)

Takes uploaded prescriptions/lab reports/discharge summaries, OCRs them,
extracts diagnoses/medications/investigations, then merges that with Person
1's conversational history output into the final physician-ready structured
summary.

## Why it's built this way

- **OCR is mocked by default, not because OCR is hard to call, but because
  it's the least reliable thing to depend on live on stage.** `mockOcrProvider.js`
  returns realistic canned text for the three demo document types, keyed to
  your actual demo scenario (prescription + lab report for the 52M diabetic/
  hypertensive chest pain patient). `tesseractProvider.js` is a real,
  functional implementation — swap `OCR_PROVIDER=tesseract` in `.env` once
  you've tested it against real scanned photos and trust it for the stage.
- **Entity extraction is regex/rule-based, not LLM-based**, for the same
  reliability reason Person 1's flow control is deterministic. It's tuned to
  the document formats in the mock OCR text — extend the regexes in
  `entityExtractor.js` if your real scanned documents look different.
- **The LLM (mocked for now) only writes the final prose summary paragraph**,
  the one thing that's genuinely hard to do well with pure rules. Swappable
  the same way as Person 1 — implement `anthropicProvider.js` and flip
  `LLM_PROVIDER=anthropic`.
- **Merging never overwrites Person 1's facts.** Document-derived diagnoses
  and medications are only *added* if not already present, and are tagged
  `source: "document"` — matching the shared schema convention exactly, so a
  physician can see "patient-reported AND document-confirmed."

## Running it

```bash
npm install
cp .env.example .env
npm start
# -> MediKiosk document engine listening on port 4001
```

### Quick logic test (no server needed)

```bash
node test-flow.js
```

Runs OCR → extraction → merge against a hardcoded copy of Person 1's demo
output. Prints extracted entities per document, then the final merged
summary. Re-run this after any change to `entityExtractor.js` to make sure
you haven't broken the parsing.

## API

### `POST /api/documents/:sessionId/upload`
```json
// request
{ "documentType": "prescription" }
// (imageBase64 optional field — ignored while OCR_PROVIDER=mock)

// response
{
  "document": {
    "document_id": "...",
    "document_type": "prescription",
    "document_date": "2026-06-15",
    "raw_ocr_text": "...",
    "extracted_diagnoses": ["Type 2 Diabetes Mellitus", "Essential Hypertension"],
    "extracted_medications": [{ "name": "Metformin", "dosage": "500mg BD" }, ...],
    "extracted_investigations": []
  }
}
```
`documentType` must be one of: `prescription`, `lab_report`, `discharge_summary`
(matches the canned mock text keys — add more in `mockOcrProvider.js` as needed).

### `GET /api/documents/:sessionId`
Returns all documents uploaded so far for that session.

### `POST /api/summary/:sessionId/generate`
```json
// request
{ "clinicalHistory": { /* paste the exact JSON from Person 1's GET /api/session/:id/summary here */ } }

// response: the full merged, schema-shaped summary, ready for Person 3's
// doctor dashboard, including clinical_summary_text and meta.abnormal_investigation_count
```

## Integration with Person 1 and Person 3

1. Person 3's frontend calls Person 1's API to run the conversation, gets the
   session's structured history via `GET /api/session/:id/summary`.
2. Person 3's frontend uploads each scanned document via this module's
   `POST /api/documents/:sessionId/upload` (use the same sessionId as Person 1's
   session, or map between them — your call as a team).
3. Person 3's frontend calls `POST /api/summary/:sessionId/generate`, passing
   in Person 1's summary JSON as `clinicalHistory` — gets back the final
   object to render on the doctor dashboard.

## What's intentionally NOT built here (by design, per team scope)

- Handwritten OCR — printed documents only, per the agreed cut list.
- Real ABDM/FHIR push — that's Person 3's mock layer; this module just
  produces the structured JSON that would feed it.
- Perfect entity extraction on arbitrary document formats — the regexes are
  tuned to the demo document formats; broaden them if your team scans
  differently formatted real documents before the demo.
