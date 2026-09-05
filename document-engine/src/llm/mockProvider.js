/**
 * Mock LLM provider. Templated but genuinely reads the merged data, so the
 * output text changes correctly if the underlying data changes - this is
 * what makes it a believable stand-in for a real model call in the demo.
 */

async function generateSummaryText({ clinicalHistory, documents, documentAlerts = [] }) {
  const patient = clinicalHistory?.patient || {};
  const cc = clinicalHistory?.chief_complaint?.text || clinicalHistory?.chief_complaint?.text_en || 'Not specified';
  const hpi = clinicalHistory?.hpi || {};
  const redFlags = clinicalHistory?.red_flags || [];

  const pmh = clinicalHistory?.past_medical_history || [];
  const meds = clinicalHistory?.drug_allergy_history?.current_medications || [];
  const allergies = clinicalHistory?.drug_allergy_history?.allergies || [];

  const isAyush = clinicalHistory?.department === 'AYUSH';
  const opdHeader = isAyush ? 'AYUSH CLINICAL OPD' : 'GENERAL MEDICINE OPD';

  let ayushSection = '';
  if (isAyush && clinicalHistory?.ayushAssessment) {
    const ayush = clinicalHistory.ayushAssessment;
    ayushSection = `\n\nDASHAVIDHA PARIKSHA (10-FOLD AYUSH CLINICAL EXAMINATION):
• Prakriti (Natural Constitution): ${ayush.prakriti?.patientReported || 'Not reported'} ${ayush.prakriti?.clinicianConfirmed ? `[Confirmed: ${ayush.prakriti?.clinicianValue || ayush.prakriti?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Vikriti (Dosha Imbalance): ${ayush.vikriti?.patientReported || 'Not reported'} ${ayush.vikriti?.clinicianConfirmed ? `[Confirmed: ${ayush.vikriti?.clinicianValue || ayush.vikriti?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Sara (Tissue Excellence): ${ayush.sara?.patientReported || 'Not reported'} ${ayush.sara?.clinicianConfirmed ? `[Confirmed: ${ayush.sara?.clinicianValue || ayush.sara?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Samhanana (Compactness/Build): ${ayush.samhanana?.patientReported || 'Not reported'} ${ayush.samhanana?.clinicianConfirmed ? `[Confirmed: ${ayush.samhanana?.clinicianValue || ayush.samhanana?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Pramana (Proportions/BMI): ${ayush.pramana?.patientReported || 'Not reported'} ${ayush.pramana?.clinicianConfirmed ? `[Confirmed: ${ayush.pramana?.clinicianValue || ayush.pramana?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Satmya (Adaptability): ${ayush.satmya?.patientReported || 'Not reported'} ${ayush.satmya?.clinicianConfirmed ? `[Confirmed: ${ayush.satmya?.clinicianValue || ayush.satmya?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Sattva (Mental Resilience): ${ayush.sattva?.patientReported || 'Not reported'} ${ayush.sattva?.clinicianConfirmed ? `[Confirmed: ${ayush.sattva?.clinicianValue || ayush.sattva?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Ahara Shakti (Digestive Agni): ${ayush.ahara_shakti?.patientReported || 'Not reported'} ${ayush.ahara_shakti?.clinicianConfirmed ? `[Confirmed: ${ayush.ahara_shakti?.clinicianValue || ayush.ahara_shakti?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Vyayama Shakti (Stamina/Fitness): ${ayush.vyayama_shakti?.patientReported || 'Not reported'} ${ayush.vyayama_shakti?.clinicianConfirmed ? `[Confirmed: ${ayush.vyayama_shakti?.clinicianValue || ayush.vyayama_shakti?.patientReported}]` : '[Pending Doctor Confirmation]'}
• Vaya (Age Stage): ${ayush.vaya?.patientReported || 'Not reported'} ${ayush.vaya?.clinicianConfirmed ? `[Confirmed: ${ayush.vaya?.clinicianValue || ayush.vaya?.patientReported}]` : '[Pending Doctor Confirmation]'}`;
  }

  let summary = `${opdHeader}

Patient: ${patient.name || 'Patient'}
Age: ${patient.age || 'Unspecified'}
Gender: ${patient.gender || 'Unspecified'}

Chief Complaint:
${cc}

HPI:
• Onset / Duration: ${hpi.onset || 'Not specified'}
• Severity: ${hpi.severity || 'Not specified'}
• Associated symptoms: ${hpi.associated_symptoms || 'None reported'}
• Location: ${hpi.location || 'Not specified'}
• Character: ${hpi.character || 'Not specified'}
• Radiation: ${hpi.radiation || 'Not specified'}
• Aggravating factors: ${hpi.exacerbating_factors || 'Not specified'}
• Relieving factors: ${hpi.relieving_factors || 'Not specified'}

Past Medical History:
${pmh.length > 0 ? pmh.map((m) => `• ${m.condition || m}`).join('\n') : '• No history reported'}

Allergies:
${allergies.length > 0 ? allergies.map((a) => `• ${a}`).join('\n') : '• No known allergies reported'}

Medications:
${meds.length > 0 ? meds.map((m) => `• ${m.name} ${m.dosage}`).join('\n') : '• None reported'}

Red Flags:
${redFlags.length > 0 ? redFlags.map((f) => `• 🚨 ${f.flag} (${f.severity || 'critical'})`).join('\n') : '• None detected'}${ayushSection}`;

  if (documentAlerts && documentAlerts.length > 0) {
    summary += `\n\nDOCUMENT ALERT:\n`;
    for (const alert of documentAlerts) {
      summary += `⚠️ Uploaded ${alert.type || 'document'} belongs to another patient (${alert.doc_patient?.name || 'Ramesh Kumar'}${alert.doc_patient?.age ? ', ' + alert.doc_patient?.age + 'M' : ''}). Not incorporated into the patient's history.`;
    }
  }

  return { summaryText: summary.trim() };
}

async function translateSummaryText({ summaryText, targetLanguage }) {
  if (!summaryText) return { summaryText: '' };

  if (targetLanguage === 'hi') {
    const translated = summaryText
      .replace(/GENERAL MEDICINE OPD/g, 'सामान्य चिकित्सा ओपीडी')
      .replace(/AYUSH CLINICAL OPD/g, 'आयुष चिकित्सा ओपीडी')
      .replace(/DASHAVIDHA PARIKSHA \(10-FOLD AYUSH CLINICAL EXAMINATION\):/g, 'दशविध परीक्षा (10-चरणीय आयुष नैदानिक परीक्षण):')
      .replace(/\[Pending Doctor Confirmation\]/g, '[चिकित्सक द्वारा पुष्टि लंबित]')
      .replace(/\[Confirmed: (.+?)\]/g, '[पुष्ट: $1]')
      .replace(/Patient:/g, 'मरीज का नाम:')
      .replace(/Age:/g, 'आयु:')
      .replace(/Gender:/g, 'लिंग:')
      .replace(/Chief Complaint:/g, 'मुख्य स्वास्थ्य समस्या (Chief Complaint):')
      .replace(/HPI:/g, 'वर्तमान बीमारी का इतिहास (HPI):')
      .replace(/Onset \/ Duration:/g, 'शुरुआत / अवधि:')
      .replace(/Severity:/g, 'गंभीरता:')
      .replace(/Associated symptoms:/g, 'अन्य संबंधित लक्षण:')
      .replace(/Location:/g, 'स्थान:')
      .replace(/Character:/g, 'लक्षण का प्रकार:')
      .replace(/Radiation:/g, 'फैलाव:')
      .replace(/Aggravating factors:/g, 'बढ़ाने वाले कारक:')
      .replace(/Relieving factors:/g, 'राहत देने वाले कारक:')
      .replace(/Past Medical History:/g, 'पूर्व चिकित्सा इतिहास (Past Medical History):')
      .replace(/Allergies:/g, 'एलर्जी (Allergies):')
      .replace(/Medications:/g, 'वर्तमान दवाएं (Medications):')
      .replace(/Red Flags:/g, 'आपातकालीन चेतावनी (Red Flags):')
      .replace(/DOCUMENT ALERT:/g, 'दस्तावेज़ सुरक्षा चेतावनी:')
      .replace(/Headache/gi, 'सिरदर्द')
      .replace(/chest pain/gi, 'छाती में दर्द')
      .replace(/No history reported/g, 'कोई पूर्व बीमारी दर्ज नहीं की गई')
      .replace(/No known allergies reported/g, 'कोई ज्ञात एलर्जी दर्ज नहीं की गई')
      .replace(/None reported/g, 'कोई नहीं')
      .replace(/None detected/g, 'कोई आपातकालीन लक्षण नहीं पाया गया')
      .replace(/Not specified/g, 'निर्दिष्ट नहीं है')
      .replace(/Not reported/g, 'दर्ज नहीं है')
      .replace(/Uploaded (.+?) belongs to another patient \((.+?)\)\. Not incorporated into the patient's history\./gi, 'अपलोड किया गया दस्तावेज दूसरे मरीज ($2) का है। इसे वर्तमान मरीज के इतिहास में शामिल नहीं किया गया है।');
    return { summaryText: translated };
  }

  if (targetLanguage === 'ta') {
    const translated = summaryText
      .replace(/GENERAL MEDICINE OPD/g, 'பொது மருத்துவ வெளிப்புறப் பிரிவு (OPD)')
      .replace(/AYUSH CLINICAL OPD/g, 'ஆயுஷ் மருத்துவ வெளிப்புறப் பிரிவு (AYUSH OPD)')
      .replace(/DASHAVIDHA PARIKSHA \(10-FOLD AYUSH CLINICAL EXAMINATION\):/g, 'தசவித பரிட்சை (10-படி ஆயுஷ் மருத்துவப் பரிசோதனை):')
      .replace(/\[Pending Doctor Confirmation\]/g, '[மருத்துவர் உறுதிப்படுத்தலுக்காக காத்திருக்கிறது]')
      .replace(/\[Confirmed: (.+?)\]/g, '[உறுதி செய்யப்பட்டது: $1]')
      .replace(/Patient:/g, 'நோயாளி பெயர்:')
      .replace(/Age:/g, 'வயது:')
      .replace(/Gender:/g, 'பாலினம்:')
      .replace(/Chief Complaint:/g, 'முதன்மை ஆரோக்கியப் பிரச்சினை:')
      .replace(/HPI:/g, 'தற்போதைய நோய் வரலாறு (HPI):')
      .replace(/Onset \/ Duration:/g, 'தொடக்கம் / காலம்:')
      .replace(/Severity:/g, 'கடுமை:')
      .replace(/Associated symptoms:/g, 'தொடர்புடைய பிற அறிகுறிகள்:')
      .replace(/Location:/g, 'இடம்:')
      .replace(/Character:/g, 'அறிகுறி வகை:')
      .replace(/Radiation:/g, 'பரவும் இடம்:')
      .replace(/Aggravating factors:/g, 'அதிகரிக்கும் காரணிகள்:')
      .replace(/Relieving factors:/g, 'தணிக்கும் காரணிகள்:')
      .replace(/Past Medical History:/g, 'முந்தைய மருத்துவ வரலாறு:')
      .replace(/Allergies:/g, 'ஒவ்வாமை (Allergies):')
      .replace(/Medications:/g, 'தற்போதைய மருந்துகள்:')
      .replace(/Red Flags:/g, 'அவசர எச்சரிக்கை (Red Flags):')
      .replace(/DOCUMENT ALERT:/g, 'ஆவண பாதுகாப்பு எச்சரிக்கை:')
      .replace(/Headache/gi, 'தலைவலி')
      .replace(/chest pain/gi, 'நெஞ்சு வலி')
      .replace(/No history reported/g, 'முந்தைய நோய் வரலாறு எதுவும் இல்லை')
      .replace(/No known allergies reported/g, 'ஒவ்வாமை எதுவும் பதிவு செய்யப்படவில்லை')
      .replace(/None reported/g, 'எதுவும் இல்லை')
      .replace(/None detected/g, 'அவசர அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை')
      .replace(/Not specified/g, 'குறிப்பிடப்படவில்லை')
      .replace(/Not reported/g, 'பதிவு செய்யப்படவில்லை')
      .replace(/Uploaded (.+?) belongs to another patient \((.+?)\)\. Not incorporated into the patient's history\./gi, 'பதிவேற்றப்பட்ட ஆவணம் வேறு நோயாளிக்கு ($2) உரியது. இது இந்த நோயாளியின் வரலாற்றில் சேர்க்கப்படவில்லை.');
    return { summaryText: translated };
  }

  return { summaryText };
}

module.exports = { generateSummaryText, translateSummaryText };
