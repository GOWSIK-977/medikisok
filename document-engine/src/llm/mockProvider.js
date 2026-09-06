/**
 * Mock LLM provider for document-engine (Person 2).
 * Templated but genuinely reads the merged clinical data, producing distinct,
 * highly structured reports for General Medicine OPD vs AYUSH OPD.
 */

function formatPreviousDocuments(documents) {
  if (!documents || documents.length === 0) return '';
  let text = '\n\nPREVIOUS PRESCRIPTIONS & UPLOADED MEDICAL DOCUMENTS (AI ANALYSIS):\n';
  for (const doc of documents) {
    const isRx = (doc.document_type || doc.documentType) === 'prescription';
    const typeLabel = isRx ? 'Previous Prescription' : (doc.document_type || doc.documentType) === 'lab_report' ? 'Previous Lab Report' : 'Discharge Summary';
    const docDate = doc.document_date || 'Recent';
    const doctorStr = doc.doctor_name
      ? `${doc.doctor_name}${doc.doctor_specialty ? ' (' + doc.doctor_specialty + ')' : ''}${doc.clinic_or_hospital ? ', ' + doc.clinic_or_hospital : ''}`
      : (isRx ? 'Consultant Rheumatology / OPD Physician' : 'Diagnostic Center / Hospital');

    text += `• Document: ${typeLabel} (${docDate})\n`;
    text += `• Prescribing Doctor / Facility: ${doctorStr}\n`;

    if (doc.short_description) {
      text += `• AI Clinical Synopsis: ${doc.short_description}\n`;
    }

    if (doc.extracted_diagnoses && doc.extracted_diagnoses.length > 0) {
      text += `• Identified Diagnoses / Impressions: ${doc.extracted_diagnoses.join(', ')}\n`;
    }

    if (doc.extracted_medications && doc.extracted_medications.length > 0) {
      const medList = doc.extracted_medications
        .map((m) => `${m.name}${m.dosage ? ' ' + m.dosage : ''}${m.frequency ? ' - ' + m.frequency : ''}${m.instructions ? ' (' + m.instructions + ')' : ''}`)
        .join('; ');
      text += `• Previous Prescribed Regimen: ${medList}\n`;
    }

    if (doc.advice) {
      text += `• Physician Advice / Non-Pharmacological: ${doc.advice}\n`;
    }
  }
  return text;
}

async function generateSummaryText({ clinicalHistory, documents = [], documentAlerts = [], language = 'en' }) {
  const patient = clinicalHistory?.patient || {};
  const cc = clinicalHistory?.chief_complaint?.text || clinicalHistory?.chief_complaint?.text_en || 'Not specified';
  const hpi = clinicalHistory?.hpi || {};
  const ros = clinicalHistory?.review_of_systems || {};
  const redFlags = clinicalHistory?.red_flags || [];

  const pmh = clinicalHistory?.past_medical_history || [];
  const psh = clinicalHistory?.past_surgical_history_raw || 'No past surgeries reported';
  const meds = clinicalHistory?.drug_allergy_history?.current_medications || [];
  const allergies = clinicalHistory?.drug_allergy_history?.allergies || [];

  const isAyush = clinicalHistory?.department === 'AYUSH';
  const previousDocsBlock = formatPreviousDocuments(documents);

  let summary = '';

  if (isAyush) {
    const ayush = clinicalHistory?.ayushAssessment || {};
    const ageNum = Number(patient.age) || 30;
    const vayaCat = ageNum < 16 ? 'Bala (Childhood)' : ageNum > 60 ? 'Vriddha (Elderly)' : 'Madhya (Adult/Youth)';

    summary = `🌿 AYUSH CLINICAL OPD - ROGA ITIHASA & PARIKSHA REPORT

ROGI VIVARANA (PATIENT DEMOGRAPHICS):
• Rogi (Patient Name): ${patient.name || 'Patient'}
• Vaya (Age): ${patient.age || 'Unspecified'} yrs (${vayaCat})
• Linga (Gender): ${patient.gender || 'Unspecified'}
• Department: AYUSH Clinical OPD

PRADHANA VEDANA (CHIEF COMPLAINT & VIKRITI):
• ${cc}

ROGA ITIHASA (HPI & DOSHA AGGRAVATION):
• Onset / Duration: ${hpi.onset || 'Not specified'}
• Severity: ${hpi.severity || 'Not specified'}
• Associated Symptoms: ${hpi.associated_symptoms || 'None reported'}
• Daily / Dietary Triggers: ${hpi.exacerbating_factors || 'None reported'}
• Relieving Factors: ${hpi.relieving_factors || 'None reported'}

DASHAVIDHA PARIKSHA (10-FOLD CLINICAL MATRIX):
1. Deha Prakriti (Thermal Traits & Skin): ${ayush.prakriti?.patientReported || 'Sensitive to temperature variations'}
2. Vikriti (Current Symptoms & Imbalance): ${ayush.vikriti?.patientReported || cc || 'Current symptom manifestations'}
3. Agni Pariksha (Hunger & Digestion): ${ayush.agni?.patientReported || ayush.ahara_shakti?.patientReported || 'Normal digestion'}
4. Koshtha Pariksha (Stool & Bowel Habits): ${ayush.koshtha?.patientReported || 'Regular daily evacuation'}
5. Sara Pariksha (Tissue Vitality & Energy): ${ayush.sara?.patientReported || ayush.vyayama_shakti?.patientReported || 'Moderate vitality'}
6. Samhanana (Body Build & Compactness): ${ayush.samhanana?.patientReported || 'Medium build'}
7. Pramana (Proportions & Weight Frame): ${ayush.pramana?.patientReported || 'Balanced proportions'}
8. Satmya (Dietary Habituation & Suitability): ${ayush.satmya?.patientReported || 'Regular home-cooked diet'}
9. Sattva (Mental Resilience & Emotions): ${ayush.sattva?.patientReported || 'Emotionally stable'}
10. Ahara & Vyayama Shakti (Capacity): ${ayush.ahara_shakti?.patientReported || ayush.vyayama_shakti?.patientReported || 'Normal appetite and stamina'}

NIDRA & VIHARA (SLEEP & DAILY HABITS):
• Nidra (Sleep Quality & Routine): ${ayush.nidra?.patientReported || '7-8 hours sound sleep'}
• Vihara (Daily Lifestyle & Habits): ${ayush.vihara?.patientReported || 'Regular daily routine with adequate hydration'}

PURVA VYADHI & AUSHADHI (PAST ILLNESSES & MEDICATIONS):
• Past Medical History: ${pmh.length > 0 ? pmh.map((m) => m.condition || m).join(', ') : 'No chronic illness reported'}
• Current Medications: ${meds.length > 0 ? meds.map((m) => `${m.name} ${m.dosage || ''}`).join(', ') : 'None reported'}
• Asatmya / Allergies: ${allergies.length > 0 ? allergies.map((a) => a).join(', ') : 'No known drug or food allergies'}
${previousDocsBlock}

ATYAYIKA AVASTHA (EMERGENCY RED FLAGS):
• ${redFlags.length > 0 ? redFlags.map((f) => `🚨 ${f.flag} (${f.severity || 'critical'})`).join('; ') : 'None detected - Patient hemodynamically stable'}

CHIKITSA SUTRA & PHYSICIAN NOTICE:
• AI Intake records patient-reported observations and indicators. Definitive Prakriti, Vikriti, Nadi Pariksha, and prescription are exclusively determined by the attending AYUSH physician.`;
  } else {
    // General Medicine OPD report
    summary = `🏥 GENERAL MEDICINE CLINICAL OPD SUMMARY & TRIAGE REPORT

PATIENT DEMOGRAPHICS:
• Name: ${patient.name || 'Patient'}
• Age: ${patient.age || 'Unspecified'} yrs  |  Gender: ${patient.gender || 'Unspecified'}
• Department: General Medicine OPD

CHIEF COMPLAINT (CC):
• ${cc}

HISTORY OF PRESENT ILLNESS (HPI):
• Onset / Duration: ${hpi.onset || 'Not specified'}
• Severity: ${hpi.severity || 'Not specified'}
• Location: ${hpi.location || 'Not specified'}
• Character: ${hpi.character || 'Not specified'}
• Radiation: ${hpi.radiation || 'Not specified'}
• Aggravating Factors: ${hpi.exacerbating_factors || 'Not specified'}
• Relieving Factors: ${hpi.relieving_factors || 'Not specified'}
• Associated Symptoms: ${hpi.associated_symptoms || 'None reported'}

REVIEW OF SYSTEMS (ROS):
• Cardiovascular: ${ros.cardiovascular?.join(', ') || 'No chest pain or palpitations'}
• Respiratory: ${ros.respiratory?.join(', ') || 'No cough or breathlessness'}
• Gastrointestinal: ${ros.gastrointestinal?.join(', ') || 'No nausea, vomiting or abdominal discomfort'}
• Neurological: ${ros.neurological?.join(', ') || 'No dizziness, focal weakness or numbness'}
• Musculoskeletal: ${ros.musculoskeletal?.join(', ') || 'No joint swelling or stiffness'}
• Genitourinary: ${ros.genitourinary?.join(', ') || 'No burning micturition or frequency'}
• General: ${ros.general?.join(', ') || 'No fever or unprovoked weight loss'}

PAST MEDICAL & SURGICAL HISTORY:
• Past Medical History: ${pmh.length > 0 ? pmh.map((m) => `• ${m.condition || m}`).join('\n') : '• No chronic illness reported'}
• Past Surgical History: • ${psh}

CURRENT MEDICATIONS & ALLERGIES:
• Current Medications: ${meds.length > 0 ? meds.map((m) => `• ${m.name} ${m.dosage || ''}`).join('\n') : '• None reported'}
• Drug / Food Allergies: ${allergies.length > 0 ? allergies.map((a) => `• ${a}`).join('\n') : '• No known allergies reported'}
${previousDocsBlock}

EMERGENCY RED FLAGS & TRIAGE ALERTS:
• ${redFlags.length > 0 ? redFlags.map((f) => `🚨 ${f.flag} (${f.severity || 'critical'})`).join('\n• ') : 'None detected - Hemodynamically stable'}

CLINICAL IMPRESSION & WORKUP RECOMMENDATION:
• Presenting with ${cc}. Recommend focused clinical examination, baseline vitals check, and directed outpatient investigations.`;
  }

  if (documentAlerts && documentAlerts.length > 0) {
    summary += `\n\nDOCUMENT ALERT:\n`;
    for (const alert of documentAlerts) {
      summary += `⚠️ Uploaded ${alert.type || 'document'} belongs to another patient (${alert.doc_patient?.name || 'Ramesh Kumar'}${alert.doc_patient?.age ? ', ' + alert.doc_patient?.age + 'M' : ''}). Not incorporated into the patient's history.\n`;
    }
  }

  // If target language is Tamil or Hindi, translate the text
  if (language === 'ta' || language === 'hi') {
    const res = await translateSummaryText({ summaryText: summary.trim(), targetLanguage: language });
    return res;
  }

  return { summaryText: summary.trim() };
}

async function translateSummaryText({ summaryText, targetLanguage }) {
  if (!summaryText) return { summaryText: '' };

  if (targetLanguage === 'hi') {
    const translated = summaryText
      .replace(/GENERAL MEDICINE CLINICAL OPD SUMMARY & TRIAGE REPORT/g, 'सामान्य चिकित्सा क्लिनिकल ओपीडी सारांश और ट्राइएज रिपोर्ट')
      .replace(/AYUSH CLINICAL OPD - ROGA ITIHASA & PARIKSHA REPORT/g, 'आयुष क्लिनिकल ओपीडी - रोग इतिहास एवं परीक्षा रिपोर्ट')
      .replace(/PREVIOUS PRESCRIPTIONS & UPLOADED MEDICAL DOCUMENTS \(AI ANALYSIS\):/g, 'पिछली पर्चियां और अपलोड किए गए मेडिकल दस्तावेज़ (AI विश्लेषण):')
      .replace(/• Document: Previous Prescription/g, '• दस्तावेज़: पिछली डॉक्टर पर्ची')
      .replace(/• Document: Previous Lab Report/g, '• दस्तावेज़: पिछली लैब रिपोर्ट')
      .replace(/• Document: Discharge Summary/g, '• दस्तावेज़: डिस्चार्ज सारांश')
      .replace(/• Prescribing Doctor \/ Facility:/g, '• परामर्शदाता चिकित्सक / अस्पताल:')
      .replace(/• AI Clinical Synopsis:/g, '• AI नैदानिक संक्षिप्त विवरण (Short Description):')
      .replace(/• Previous Prescribed Regimen:/g, '• पूर्व निर्धारित दवाएं एवं खुराक:')
      .replace(/• Identified Diagnoses \/ Impressions:/g, '• पहचानी गई बीमारियाँ / नैदानिक निष्कर्ष:')
      .replace(/• Physician Advice \/ Non-Pharmacological:/g, '• डॉक्टर की सलाह एवं सावधानियां:')
      .replace(/PATIENT DEMOGRAPHICS:/g, 'मरीज का विवरण:')
      .replace(/ROGI VIVARANA \(PATIENT DEMOGRAPHICS\):/g, 'रोगी विवरण (मरीज की जनसांख्यिकी):')
      .replace(/Rogi \(Patient Name\):/g, 'रोगी का नाम:')
      .replace(/Name:/g, 'नाम:')
      .replace(/Vaya \(Age\):/g, 'वय (आयु):')
      .replace(/Age:/g, 'आयु:')
      .replace(/Linga \(Gender\):/g, 'लिंग:')
      .replace(/Gender:/g, 'लिंग:')
      .replace(/Department:/g, 'विभाग:')
      .replace(/CHIEF COMPLAINT \(CC\):/g, 'मुख्य स्वास्थ्य समस्या (Chief Complaint):')
      .replace(/PRADHANA VEDANA \(CHIEF COMPLAINT & VIKRITI\):/g, 'प्रधान वेदना (मुख्य लक्षण एवं विकृति):')
      .replace(/HISTORY OF PRESENT ILLNESS \(HPI\):/g, 'वर्तमान बीमारी का इतिहास (HPI):')
      .replace(/ROGA ITIHASA \(HPI & DOSHA AGGRAVATION\):/g, 'रोग इतिहास (दोष प्रकोप एवं अवधि):')
      .replace(/Onset \/ Duration:/g, 'शुरुआत / अवधि:')
      .replace(/Onset & Duration:/g, 'शुरुआत एवं अवधि:')
      .replace(/Severity:/g, 'गंभीरता:')
      .replace(/Severity & Aggravating Factors:/g, 'गंभीरता और बढ़ाने वाले कारक:')
      .replace(/Location:/g, 'स्थान:')
      .replace(/Character:/g, 'लक्षण का प्रकार:')
      .replace(/Radiation:/g, 'फैलाव:')
      .replace(/Aggravating Factors:/g, 'बढ़ाने वाले कारक:')
      .replace(/Relieving Factors:/g, 'राहत देने वाले कारक:')
      .replace(/Associated Symptoms:/g, 'संबंधित अन्य लक्षण:')
      .replace(/Daily \/ Dietary Triggers:/g, 'दैनिक एवं आहार ट्रिगर:')
      .replace(/REVIEW OF SYSTEMS \(ROS\):/g, 'शारीरिक प्रणाली समीक्षा (Review of Systems):')
      .replace(/DASHAVIDHA PARIKSHA \(10-FOLD CLINICAL MATRIX\):/g, 'दशविध परीक्षा (10-चरणीय आयुष नैदानिक परीक्षण):')
      .replace(/1\. Deha Prakriti \(Thermal Traits & Skin\):/g, '1. देह प्रकृति (तापमान सहनशीलता एवं त्वचा):')
      .replace(/2\. Vikriti \(Current Symptoms & Imbalance\):/g, '2. विकृति (वर्तमान लक्षण एवं असंतुलन):')
      .replace(/3\. Agni Pariksha \(Hunger & Digestion\):/g, '3. अग्नि परीक्षा (भूख, पाचन एवं एसिडिटी):')
      .replace(/4\. Koshtha Pariksha \(Stool & Bowel Habits\):/g, '4. कोष्ठ परीक्षा (शौच एवं मल त्याग):')
      .replace(/5\. Sara Pariksha \(Tissue Vitality & Energy\):/g, '5. सार परीक्षा (शारीरिक ऊर्जा एवं धातु सार):')
      .replace(/6\. Samhanana \(Body Build & Compactness\):/g, '6. संहनन (शारीरिक बनावट):')
      .replace(/7\. Pramana \(Proportions & Weight Frame\):/g, '7. प्रमाण (शारीरिक अनुपात एवं वजन):')
      .replace(/8\. Satmya \(Dietary Habituation & Suitability\):/g, '8. सात्म्य (खान-पान की अनुकूलता):')
      .replace(/9\. Sattva \(Mental Resilience & Emotions\):/g, '9. सत्त्व परीक्षा (मानसिक स्थिति एवं तनाव):')
      .replace(/10\. Ahara & Vyayama Shakti \(Capacity\):/g, '10. आहार एवं व्यायाम शक्ति (पाचन एवं व्यायाम क्षमता):')
      .replace(/NIDRA & VIHARA \(SLEEP & DAILY HABITS\):/g, 'निद्रा एवं विहार (नींद और दिनचर्या):')
      .replace(/Nidra \(Sleep Quality & Routine\):/g, 'निद्रा (नींद की गुणवत्ता एवं समय):')
      .replace(/Vihara \(Daily Lifestyle & Habits\):/g, 'विहार (दैनिक दिनचर्या और आदतें):')
      .replace(/PURVA VYADHI & AUSHADHI \(PAST ILLNESSES & MEDICATIONS\):/g, 'पूर्व व्याधि एवं औषधि (पिछली बीमारियाँ और दवाएं):')
      .replace(/PAST MEDICAL & SURGICAL HISTORY:/g, 'पूर्व चिकित्सा एवं शल्य इतिहास:')
      .replace(/Past Medical History:/g, 'पूर्व चिकित्सा इतिहास:')
      .replace(/Past Surgical History:/g, 'पूर्व शल्य चिकित्सा इतिहास:')
      .replace(/CURRENT MEDICATIONS & ALLERGIES:/g, 'वर्तमान दवाएं एवं एलर्जी:')
      .replace(/Current Medications:/g, 'वर्तमान दवाएं:')
      .replace(/Drug \/ Food Allergies:/g, 'दवा या भोजन एलर्जी:')
      .replace(/Asatmya \/ Allergies:/g, 'असात्म्य / एलर्जी:')
      .replace(/EMERGENCY RED FLAGS & TRIAGE ALERTS:/g, 'आपातकालीन चेतावनी और ट्राइएज अलर्ट (Red Flags):')
      .replace(/ATYAYIKA AVASTHA \(EMERGENCY RED FLAGS\):/g, 'आत्ययिक अवस्था (आपातकालीन चेतावनी - Red Flags):')
      .replace(/CLINICAL IMPRESSION & WORKUP RECOMMENDATION:/g, 'चिकित्सकीय निष्कर्ष और प्रारंभिक जांच सुझाव:')
      .replace(/CHIKITSA SUTRA & PHYSICIAN NOTICE:/g, 'चिकित्सा सूत्र एवं चिकित्सक सूचना:')
      .replace(/None detected - Hemodynamically stable/g, 'कोई आपातकालीन लक्षण नहीं पाया गया - मरीज स्थिर है')
      .replace(/None detected - Patient hemodynamically stable/g, 'कोई आपातकालीन लक्षण नहीं पाया गया - मरीज स्थिर है')
      .replace(/None reported/g, 'कोई नहीं')
      .replace(/No chronic illness reported/g, 'कोई पुरानी बीमारी दर्ज नहीं की गई')
      .replace(/No past surgeries reported/g, 'कोई पिछली सर्जरी दर्ज नहीं की गई')
      .replace(/No known allergies reported/g, 'कोई ज्ञात एलर्जी दर्ज नहीं की गई')
      .replace(/No known drug or food allergies/g, 'दवा या भोजन से कोई ज्ञात एलर्जी नहीं है')
      .replace(/DOCUMENT ALERT:/g, 'दस्तावेज़ सुरक्षा चेतावनी:')
      .replace(/Not specified/g, 'निर्दिष्ट नहीं है');
    return { summaryText: translated };
  }

  if (targetLanguage === 'ta') {
    const translated = summaryText
      .replace(/GENERAL MEDICINE CLINICAL OPD SUMMARY & TRIAGE REPORT/g, 'பொது மருத்துவ மருத்துவமனை OPD சுருக்கம் மற்றும் ட்ரையேஜ் அறிக்கை')
      .replace(/AYUSH CLINICAL OPD - ROGA ITIHASA & PARIKSHA REPORT/g, 'ஆயுஷ் மருத்துவமனை OPD - நோய் வரலாறு மற்றும் பரிசோதனை அறிக்கை')
      .replace(/PREVIOUS PRESCRIPTIONS & UPLOADED MEDICAL DOCUMENTS \(AI ANALYSIS\):/g, 'முந்தைய மருந்துக் குறிப்புகள் & மருத்துவ ஆவணங்கள் (AI பகுப்பாய்வு):')
      .replace(/• Document: Previous Prescription/g, '• ஆவணம்: முந்தைய மருத்துவர் மருந்துச் சீட்டு')
      .replace(/• Document: Previous Lab Report/g, '• ஆவணம்: முந்தைய பரிசோதனை அறிக்கை')
      .replace(/• Document: Discharge Summary/g, '• ஆவணம்: டிஸ்சார்ஜ் சுருக்கம்')
      .replace(/• Prescribing Doctor \/ Facility:/g, '• பரிந்துரைத்த மருத்துவர் / மருத்துவமனை:')
      .replace(/• AI Clinical Synopsis:/g, '• AI மருத்துவ சுருக்கம் (Short Description):')
      .replace(/• Previous Prescribed Regimen:/g, '• முந்தைய பரிந்துரைக்கப்பட்ட மருந்துகள்:')
      .replace(/• Identified Diagnoses \/ Impressions:/g, '• கண்டறியப்பட்ட நோய் / மருத்துவ கணிப்பு:')
      .replace(/• Physician Advice \/ Non-Pharmacological:/g, '• மருத்துவரின் ஆலோசனைகள்:')
      .replace(/PATIENT DEMOGRAPHICS:/g, 'நோயாளி விவரங்கள்:')
      .replace(/ROGI VIVARANA \(PATIENT DEMOGRAPHICS\):/g, 'நோயாளி விவரங்கள் (Rogi Vivarana):')
      .replace(/Rogi \(Patient Name\):/g, 'நோயாளி பெயர்:')
      .replace(/Name:/g, 'பெயர்:')
      .replace(/Vaya \(Age\):/g, 'வயது (Vaya):')
      .replace(/Age:/g, 'வயது:')
      .replace(/Linga \(Gender\):/g, 'பாலினம் (Linga):')
      .replace(/Gender:/g, 'பாலினம்:')
      .replace(/Department:/g, 'பிரிவு:')
      .replace(/CHIEF COMPLAINT \(CC\):/g, 'முதன்மை ஆரோக்கியப் பிரச்சினை (Chief Complaint):')
      .replace(/PRADHANA VEDANA \(CHIEF COMPLAINT & VIKRITI\):/g, 'முதன்மை உபாதை மற்றும் தோஷ மாற்றம் (Pradhana Vedana):')
      .replace(/HISTORY OF PRESENT ILLNESS \(HPI\):/g, 'தற்போதைய நோய் வரலாறு (HPI):')
      .replace(/ROGA ITIHASA \(HPI & DOSHA AGGRAVATION\):/g, 'நோய் வரலாறு மற்றும் தோஷ சீர்கேடு (Roga Itihasa):')
      .replace(/Onset \/ Duration:/g, 'தொடக்கம் / காலம்:')
      .replace(/Onset & Duration:/g, 'தொடக்கம் மற்றும் காலம்:')
      .replace(/Severity:/g, 'கடுமை:')
      .replace(/Severity & Aggravating Factors:/g, 'கடுமை மற்றும் அதிகரிக்கும் காரணிகள்:')
      .replace(/Location:/g, 'இடம்:')
      .replace(/Character:/g, 'அறிகுறி வகை:')
      .replace(/Radiation:/g, 'பரவும் இடம்:')
      .replace(/Aggravating Factors:/g, 'அதிகரிக்கும் காரணிகள்:')
      .replace(/Relieving Factors:/g, 'தணிக்கும் காரணிகள்:')
      .replace(/Associated Symptoms:/g, 'தொடர்புடைய பிற அறிகுறிகள்:')
      .replace(/Daily \/ Dietary Triggers:/g, 'தினசரி மற்றும் உணவுத் தூண்டல்கள்:')
      .replace(/REVIEW OF SYSTEMS \(ROS\):/g, 'உடல் மண்டல ஆய்வு (Review of Systems):')
      .replace(/DASHAVIDHA PARIKSHA \(10-FOLD CLINICAL MATRIX\):/g, 'தசவித பரிட்சை (10-படி ஆயுஷ் மருத்துவப் பரிசோதனை):')
      .replace(/1\. Deha Prakriti \(Thermal Traits & Skin\):/g, '1. தேக பிரகிருதி (உடல் வெப்ப உணர்வு மற்றும் சருமம்):')
      .replace(/2\. Vikriti \(Current Symptoms & Imbalance\):/g, '2. விக்ருதி (தற்போதைய தோஷ மாற்றம் மற்றும் அறிகுறிகள்):')
      .replace(/3\. Agni Pariksha \(Hunger & Digestion\):/g, '3. அக்னி பரீட்சை (பசி, செரிமானம் மற்றும் அசிடிட்டி):')
      .replace(/4\. Koshtha Pariksha \(Stool & Bowel Habits\):/g, '4. கோஷ்ட பரீட்சை (மலம் கழிக்கும் பழக்கம்):')
      .replace(/5\. Sara Pariksha \(Tissue Vitality & Energy\):/g, '5. சார பரீட்சை (உடல் பலம் மற்றும் தாது சாரம்):')
      .replace(/6\. Samhanana \(Body Build & Compactness\):/g, '6. சம்ஹனன பரீட்சை (உடல் கட்டமைப்பு):')
      .replace(/7\. Pramana \(Proportions & Weight Frame\):/g, '7. பிரமாண பரீட்சை (உடல் விகிதம் மற்றும் எடை):')
      .replace(/8\. Satmya \(Dietary Habituation & Suitability\):/g, '8. சாத்மிய பரீட்சை (உணவுப் பழக்கம் மற்றும் ஒவ்வாமை):')
      .replace(/9\. Sattva \(Mental Resilience & Emotions\):/g, '9. சத்துவ பரீட்சை (மன உறுதி மற்றும் உணர்ச்சி நிலை):')
      .replace(/10\. Ahara & Vyayama Shakti \(Capacity\):/g, '10. ஆகார & வியாயாம சக்தி (உணவு மற்றும் உடற்பயிற்சி திறன்):')
      .replace(/NIDRA & VIHARA \(SLEEP & DAILY HABITS\):/g, 'நித்திரை மற்றும் விகாரம் (தூக்கம் மற்றும் அன்றாட வழக்கம்):')
      .replace(/Nidra \(Sleep Quality & Routine\):/g, 'நித்திரை (தூக்கத்தின் தரம் மற்றும் வழக்கம்):')
      .replace(/Vihara \(Daily Lifestyle & Habits\):/g, 'விகாரம் (தினசரி வாழ்க்கை முறை மற்றும் பழக்கங்கள்):')
      .replace(/PURVA VYADHI & AUSHADHI \(PAST ILLNESSES & MEDICATIONS\):/g, 'முந்தைய நோய்கள் மற்றும் மருந்துகள்:')
      .replace(/PAST MEDICAL & SURGICAL HISTORY:/g, 'முந்தைய மருத்துவ மற்றும் அறுவை சிகிச்சை வரலாறு:')
      .replace(/Past Medical History:/g, 'முந்தைய மருத்துவ வரலாறு:')
      .replace(/Past Surgical History:/g, 'முந்தைய அறுவை சிகிச்சை வரலாறு:')
      .replace(/CURRENT MEDICATIONS & ALLERGIES:/g, 'தற்போதைய மருந்துகள் மற்றும் ஒவ்வாமை:')
      .replace(/Current Medications:/g, 'தற்போதைய மருந்துகள்:')
      .replace(/Drug \/ Food Allergies:/g, 'மருந்து அல்லது உணவு ஒவ்வாமை:')
      .replace(/Asatmya \/ Allergies:/g, 'அசாத்மியா / ஒவ்வாமை:')
      .replace(/EMERGENCY RED FLAGS & TRIAGE ALERTS:/g, 'அவசர எச்சரிக்கை மற்றும் ட்ரையேஜ் முன்னறிவிப்பு (Red Flags):')
      .replace(/ATYAYIKA AVASTHA \(EMERGENCY RED FLAGS\):/g, 'அத்தியாயிக அவஸ்தை (அவசர எச்சரிக்கை - Red Flags):')
      .replace(/CLINICAL IMPRESSION & WORKUP RECOMMENDATION:/g, 'மருத்துவக் கணிப்பு மற்றும் பரிசோதனைப் பரிந்துரைகள்:')
      .replace(/CHIKITSA SUTRA & PHYSICIAN NOTICE:/g, 'சிகிச்சை சூத்திரம் மற்றும் மருத்துவர் அறிவிப்பு:')
      .replace(/None detected - Hemodynamically stable/g, 'அவசர அறிகுறிகள் எதுவும் இல்லை - நோயாளி நிலையாக உள்ளார்')
      .replace(/None detected - Patient hemodynamically stable/g, 'அவசர அறிகுறிகள் எதுவும் இல்லை - நோயாளி நிலையாக உள்ளார்')
      .replace(/None reported/g, 'எதுவும் இல்லை')
      .replace(/No chronic illness reported/g, 'முந்தைய நாள்பட்ட நோய்கள் எதுவும் இல்லை')
      .replace(/No past surgeries reported/g, 'அறுவை சிகிச்சை எதுவும் செய்யப்படவில்லை')
      .replace(/No known allergies reported/g, 'ஒவ்வாமை எதுவும் பதிவு செய்யப்படவில்லை')
      .replace(/No known drug or food allergies/g, 'மருந்து அல்லது உணவு ஒவ்வாமை எதுவும் இல்லை')
      .replace(/DOCUMENT ALERT:/g, 'ஆவண பாதுகாப்பு எச்சரிக்கை:')
      .replace(/Not specified/g, 'குறிப்பிடப்படவில்லை');
    return { summaryText: translated };
  }

  return { summaryText };
}

module.exports = { generateSummaryText, translateSummaryText };

