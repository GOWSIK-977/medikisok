/**
 * Mock OCR provider. Returns realistic canned text instead of actually
 * reading imageBase64 - this is what makes the demo reliable regardless of
 * scan quality, lighting, or handwriting. Swap for tesseractProvider.js once
 * real OCR is tested and trusted for stage conditions.
 *
 * The two canned documents below match the team's agreed demo scenario:
 * 52M, chest pain 3 days, known diabetes + hypertension.
 */

const CANNED_TEXT = {
  prescription: `AIIA OUTPATIENT DEPARTMENT
Dr. S. Rao, MD (Medicine)
Date: 15/06/2026
Patient: Ramesh Kumar, 52M

Diagnosis: Type 2 Diabetes Mellitus, Essential Hypertension

Rx:
Tab. Metformin 500mg BD
Tab. Telmisartan 40mg OD
Tab. Atorvastatin 10mg OD (night)

Advice: Low salt, low sugar diet. Follow up in 4 weeks.`,

  lab_report: `AIIA CENTRAL DIAGNOSTIC LAB
Patient: Ramesh Kumar, 52M
Date: 10/06/2026

TEST                  RESULT      REFERENCE RANGE
HbA1c                 8.2         4.0 - 6.0
Fasting Blood Sugar    148         70 - 100
Total Cholesterol      210         < 200
LDL Cholesterol        140         < 100
HDL Cholesterol        38          > 40
Serum Creatinine       1.1         0.6 - 1.2`,

  discharge_summary: `AIIA HOSPITAL - DISCHARGE SUMMARY
Patient: Ramesh Kumar, 52M
Admission Date: 02/01/2025  Discharge Date: 05/01/2025

Diagnosis: Hypertensive urgency, managed conservatively.
Discharged on Tab. Telmisartan 40mg OD.
Advised regular BP monitoring and cardiology follow-up.`,
};

async function recognize({ documentType }) {
  const rawText = CANNED_TEXT[documentType] || CANNED_TEXT.prescription;
  return { rawText };
}

module.exports = { recognize };
