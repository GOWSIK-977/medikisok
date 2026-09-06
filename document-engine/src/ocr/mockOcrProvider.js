/**
 * Mock OCR provider. Returns realistic canned text and structured clinical
 * insights instead of actually reading imageBase64 - this makes the demo reliable
 * regardless of scan quality, lighting, or quota limitations.
 */

const CANNED_DATA = {
  prescription: {
    rawText: `Dr. Himanshu Aggarwal
MBBS, MD, DNB-SS (Rheumatology) (Gold Medalist), EULAR Certified (Rheumatology)
Consultant Rheumatology
Rheumatology Clinic, Krishna Hospital & Trauma Center
J-85, Patel Nagar-1st, Near Old Bus Stand, Ghaziabad
E-mail: himanshuucms@gmail.com
Date: 24/08/2021
Patient Name: Urmila Devi
Age: 48 / F

Clinical Impression / Diagnoses:
? RA Atypical RF +ve (Left)
Lt Knee Osteoarthritis
Other Jts OK

Rx:
1) Tab Meditrex 15 once/week
2) Tab Calcimax 1 OD
3) Tab Predsolan (8) twice daily x 7 days, then once daily
4) Tab Etoric (90) OD x 5 days, then SOS
5) Tab Driper-DSR OD (BBF)

Advice:
• Ice pack application to left knee
• Next visit: 2 weeks`,
    structuredData: {
      document_type: 'prescription',
      doctor_name: 'Dr. Himanshu Aggarwal',
      doctor_specialty: 'Consultant Rheumatology',
      clinic_or_hospital: 'Rheumatology Clinic, Krishna Hospital & Trauma Center, Ghaziabad',
      document_date: '2021-08-24',
      extracted_patient: {
        name: 'Urmila Devi',
        age: 48,
        gender: 'Female',
      },
      extracted_diagnoses: [
        'Suspected Rheumatoid Arthritis (? RA Atypical RF +ve)',
        'Left Knee Osteoarthritis',
      ],
      extracted_medications: [
        {
          name: 'Tab Meditrex 15 (Methotrexate)',
          dosage: '15mg',
          frequency: 'Once weekly',
          instructions: 'DMARD therapy for suspected Rheumatoid Arthritis',
        },
        {
          name: 'Tab Calcimax 1',
          dosage: '1 Tab',
          frequency: 'Once daily (OD)',
          instructions: 'Calcium & Vitamin D3 bone health supplement',
        },
        {
          name: 'Tab Predsolan (Prednisolone)',
          dosage: '8mg',
          frequency: 'Twice daily x 7 days, then once daily',
          instructions: 'Tapering oral corticosteroid for acute joint inflammation',
        },
        {
          name: 'Tab Etoric / Etoshine (Etoricoxib)',
          dosage: '90mg',
          frequency: 'Once daily x 5 days, then SOS',
          instructions: 'COX-2 selective NSAID for joint pain relief',
        },
        {
          name: 'Tab Driper-DSR',
          dosage: '1 Cap',
          frequency: 'Once daily before breakfast (OD BBF)',
          instructions: 'Gastroprotective PPI with domperidone',
        },
      ],
      extracted_investigations: [],
      advice: 'Ice pack application to left knee; follow up in 2 weeks',
      short_description: 'Previous prescription dated 24/08/2021 from Rheumatologist Dr. Himanshu Aggarwal (Krishna Hospital) for a 48F presenting with suspected seropositive Rheumatoid Arthritis (? RA RF+ve) and Left Knee Osteoarthritis. Regimen includes weekly Methotrexate (Meditrex 15mg once weekly), short tapering course of Prednisolone (8mg), Etoricoxib (90mg OD) for joint pain/inflammation, PPI gastroprotection (Driper-DSR), and Calcium supplementation, with instructions for ice pack application and 2-week follow-up.',
    },
  },

  lab_report: {
    rawText: `AIIA CENTRAL DIAGNOSTIC LAB
Patient: Ramesh Kumar, 52M
Date: 10/06/2026

TEST                  RESULT      REFERENCE RANGE
HbA1c                 8.2         4.0 - 6.0
Fasting Blood Sugar    148         70 - 100
Total Cholesterol      210         < 200
LDL Cholesterol        140         < 100
HDL Cholesterol        38          > 40
Serum Creatinine       1.1         0.6 - 1.2`,
    structuredData: {
      document_type: 'lab_report',
      doctor_name: 'Dr. Central Pathologist',
      clinic_or_hospital: 'AIIA Central Diagnostic Lab',
      document_date: '2026-06-10',
      extracted_patient: {
        name: 'Ramesh Kumar',
        age: 52,
        gender: 'Male',
      },
      extracted_diagnoses: ['Uncontrolled Hyperglycemia', 'Dyslipidemia'],
      extracted_medications: [],
      extracted_investigations: [
        { test_name: 'HbA1c', value: '8.2', reference_range: '4.0 - 6.0', flag: 'high' },
        { test_name: 'Fasting Blood Sugar', value: '148', reference_range: '70 - 100', flag: 'high' },
        { test_name: 'Total Cholesterol', value: '210', reference_range: '< 200', flag: 'high' },
        { test_name: 'LDL Cholesterol', value: '140', reference_range: '< 100', flag: 'high' },
        { test_name: 'HDL Cholesterol', value: '38', reference_range: '> 40', flag: 'low' },
        { test_name: 'Serum Creatinine', value: '1.1', reference_range: '0.6 - 1.2', flag: 'normal' },
      ],
      advice: 'Diabetic and lipid management consultation advised',
      short_description: 'Lab blood panel dated 10/06/2026 indicating poor glycemic control (HbA1c 8.2%, Fasting Blood Glucose 148 mg/dL) and mixed dyslipidemia (elevated LDL 140 mg/dL, low HDL 38 mg/dL, total cholesterol 210 mg/dL) with preserved renal function (serum creatinine 1.1 mg/dL).',
    },
  },

  discharge_summary: {
    rawText: `AIIA HOSPITAL - DISCHARGE SUMMARY
Patient: Ramesh Kumar, 52M
Admission Date: 02/01/2025  Discharge Date: 05/01/2025

Diagnosis: Hypertensive urgency, managed conservatively.
Discharged on Tab. Telmisartan 40mg OD.
Advised regular BP monitoring and cardiology follow-up.`,
    structuredData: {
      document_type: 'discharge_summary',
      doctor_name: 'Dr. Cardiology Attending',
      clinic_or_hospital: 'AIIA Hospital Inpatient Medicine',
      document_date: '2025-01-05',
      extracted_patient: {
        name: 'Ramesh Kumar',
        age: 52,
        gender: 'Male',
      },
      extracted_diagnoses: ['Hypertensive urgency'],
      extracted_medications: [
        { name: 'Tab. Telmisartan', dosage: '40mg', frequency: 'OD', instructions: 'Daily morning' },
      ],
      extracted_investigations: [],
      advice: 'Regular BP monitoring and outpatient cardiology follow-up in 2 weeks',
      short_description: 'Hospital discharge summary (02/01/2025 - 05/01/2025) for hypertensive urgency, successfully stabilized without end-organ damage. Discharged on oral Telmisartan 40mg once daily with advised home BP monitoring and cardiology follow-up.',
    },
  },
};

async function recognize({ documentType = 'prescription' }) {
  const item = CANNED_DATA[documentType] || CANNED_DATA.prescription;
  return {
    rawText: item.rawText,
    structuredData: item.structuredData,
  };
}

module.exports = { recognize, CANNED_DATA };

