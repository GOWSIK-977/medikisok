// Builds a MOCK FHIR-shaped bundle for the "pushed to ABDM/HIS" screen.
// This is not a validated FHIR resource and no network call is made —
// per the agreed scope cuts, real ABDM/FHIR integration is out of
// scope for the hackathon. This exists purely to make the doctor
// confirm → submit step feel real and to give the pitch deck a
// concrete artifact to show.

export function buildMockFhirBundle(mergedSummary) {
  const patient = mergedSummary?.patient || {};
  const now = new Date().toISOString();

  return {
    resourceType: "Bundle",
    type: "collection",
    meta: {
      note: "MOCK bundle — not submitted to any real ABDM/HIS endpoint.",
    },
    timestamp: now,
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: mergedSummary?.meta?.session_id || "unknown-session",
          name: [{ text: patient.name || "Unknown" }],
          gender: patient.gender,
          extension: [{ url: "abha-id-mock", valueString: "MOCK-ABHA-0000-0000" }],
        },
      },
      {
        resource: {
          resourceType: "Condition",
          code: { text: mergedSummary?.chief_complaint?.description || "Unspecified" },
          subject: { reference: "Patient/" + (mergedSummary?.meta?.session_id || "unknown") },
        },
      },
      {
        resource: {
          resourceType: "Composition",
          title: "AI-assisted clinical intake summary (physician-confirmed)",
          section: [
            {
              title: "Clinical Summary",
              text: mergedSummary?.clinical_summary_text || "",
            },
          ],
          extension: [
            {
              url: "physician-confirmation",
              valueBoolean: !!mergedSummary?.meta?.physician_edits?.confirmed,
            },
          ],
        },
      },
    ],
  };
}
