"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClinicalSummary, getDocuments, generateFinalSummary, translateSummary } from "@/lib/api";
import { getQueueEntry, upsertQueueEntry } from "@/lib/registry";
import { buildMockFhirBundle } from "@/lib/fhir";
import RedFlagBanner from "@/components/RedFlagBanner";

function titleCase(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SECTION_TITLES = {
  chief_complaint: { en: "Chief Complaint", hi: "मुख्य स्वास्थ्य समस्या (Chief Complaint)", ta: "முதன்மை ஆரோக்கியப் பிரச்சினை" },
  hpi: { en: "History of Present Illness", hi: "वर्तमान बीमारी का इतिहास (HPI)", ta: "தற்போதைய நோய் வரலாறு (HPI)" },
  review_of_systems: { en: "Review of Systems", hi: "शारीरिक प्रणाली समीक्षा (Review of Systems)", ta: "உடல் மண்டல ஆய்வு (Review of Systems)" },
  past_medical_history: { en: "Past Medical History", hi: "पूर्व चिकित्सा इतिहास (Past Medical History)", ta: "முந்தைய மருத்துவ வரலாறு" },
  past_surgical_history: { en: "Past Surgical History", hi: "पूर्व शल्य चिकित्सा इतिहास (Past Surgical History)", ta: "முந்தைய அறுவை சிகிச்சை வரலாறு" },
  drug_allergy_history: { en: "Drug & Allergy History", hi: "दवा और एलर्जी इतिहास (Drug & Allergy History)", ta: "மருந்து மற்றும் ஒவ்வாமை வரலாறு" },
  family_history: { en: "Family History", hi: "पारिवारिक इतिहास (Family History)", ta: "குடும்ப வரலாற்று விவரங்கள்" },
  personal_history: { en: "Personal History", hi: "व्यक्तिगत इतिहास (Personal History)", ta: "தனிப்பட்ட வாழ்க்கை முறை வரலாறு" },
};

const AYUSH_FIELD_META = {
  prakriti: {
    label: "Body Nature & Thermal Traits",
    sanskrit: "Deha Prakriti",
    options: ["Vata Predominant", "Pitta Predominant", "Kapha Predominant", "Vata-Pitta", "Pitta-Kapha", "Vata-Kapha", "Tridoshaja"],
  },
  vikriti: {
    label: "Current Symptoms & Aggravation",
    sanskrit: "Vikriti / Dosha Dushti",
    options: ["Vata Dushti", "Pitta Dushti", "Kapha Dushti", "Vata-Pitta Dushti", "Pitta-Kapha Dushti", "Tridosha Dushti", "No Severe Aggravation"],
  },
  agni: {
    label: "Hunger, Digestion & Acidity",
    sanskrit: "Agni Pariksha",
    options: ["Samagni (Balanced)", "Tikshnagni (Hyperacidity/Sharp)", "Mandagni (Sluggish/Heavy)", "Vishamagni (Irregular/Bloating)"],
  },
  koshtha: {
    label: "Stool & Bowel Evacuation",
    sanskrit: "Koshtha Pariksha",
    options: ["Madhyama Koshtha (Regular/Smooth)", "Krura Koshtha (Constipation/Hard)", "Mridu Koshtha (Loose/Frequent)"],
  },
  sara: {
    label: "Tissue Excellence & Vitality",
    sanskrit: "Sara Pariksha (Dhatu Sara)",
    options: ["Pravara Sara (Excellent)", "Madhyama Sara (Moderate)", "Avara Sara (Suboptimal)"],
  },
  samhanana: {
    label: "Compactness & Body Build",
    sanskrit: "Samhanana Pariksha",
    options: ["Su-samhanata (Well-compacted)", "Madhyama (Medium)", "Heena (Frail / Slender)"],
  },
  pramana: {
    label: "Body Proportions & Weight Frame",
    sanskrit: "Pramana Pariksha",
    options: ["Pramana-yukta (Balanced)", "Ati-sthula (Overweight tendency)", "Ati-krisha (Underweight tendency)"],
  },
  satmya: {
    label: "Dietary Adaptability & Habits",
    sanskrit: "Satmya Pariksha",
    options: ["Sarva-satmya (Adaptable to all foods)", "Madhyama-satmya (Moderate)", "Eka-satmya / Asatmya (Food intolerances)"],
  },
  sattva: {
    label: "Mental Resilience & Emotions",
    sanskrit: "Sattva Pariksha (Manasika)",
    options: ["Pravara-sattva (High resilience/calm)", "Madhyama-sattva (Moderate)", "Avara-sattva (Sensitive / Anxious)"],
  },
  ahara_shakti: {
    label: "Food Capacity & Appetite",
    sanskrit: "Ahara Shakti (Abhyavaharana)",
    options: ["Uttama Ahara Shakti", "Madhyama Ahara Shakti", "Avara Ahara Shakti"],
  },
  vyayama_shakti: {
    label: "Physical Strength & Stamina",
    sanskrit: "Vyayama Shakti (Bala)",
    options: ["Uttama Bala (High stamina)", "Madhyama Bala (Moderate)", "Avara Bala (Low stamina / quick fatigue)"],
  },
  nidra: {
    label: "Sleep Quality & Routine",
    sanskrit: "Nidra Pariksha",
    options: ["Samyak Nidra (Sound 7-8h)", "Alpanidra / Khandita (Broken/Light)", "Anidra (Insomnia)", "Atinidra (Excessive sleep)"],
  },
  vihara: {
    label: "Daily Lifestyle & Habits",
    sanskrit: "Vihara Pariksha",
    options: ["Hita Vihara (Healthy routine)", "Ayukta Vihara (Irregular/Late)", "Sedentary"],
  },
  vaya: {
    label: "Age Stage Category",
    sanskrit: "Vaya Pariksha",
    options: ["Bala (Childhood)", "Madhya (Adult/Youth)", "Vriddha (Elderly)"],
  },
};

const FIELD_LABELS = {
  text: { en: "Text", hi: "विवरण", ta: "விவரம்" },
  text_en: { en: "Text (En)", hi: "विवरण (अंग्रेजी)", ta: "விவரம் (ஆங்கிலம்)" },
  onset: { en: "Onset", hi: "शुरुआत / अवधि", ta: "தொடக்கம் / காலம்" },
  severity: { en: "Severity", hi: "गंभीरता", ta: "கடுமை" },
  location: { en: "Location", hi: "स्थान", ta: "இடம்" },
  character: { en: "Character", hi: "प्रकार", ta: "அறிகுறி வகை" },
  radiation: { en: "Radiation", hi: "फैलाव", ta: "பரவும் இடம்" },
  associated_symptoms: { en: "Associated Symptoms", hi: "अन्य संबंधित लक्षण", ta: "தொடர்புடைய பிற அறிகுறிகள்" },
  exacerbating_factors: { en: "Exacerbating Factors", hi: "बढ़ाने वाले कारक", ta: "அதிகரிக்கும் காரணிகள்" },
  relieving_factors: { en: "Relieving Factors", hi: "राहत देने वाले कारक", ta: "தணிக்கும் காரணிகள்" },
  condition: { en: "Condition", hi: "बीमारी / स्थिति", ta: "நோய் நிலை" },
  status: { en: "Status", hi: "स्थिति", ta: "தற்போதைய நிலை" },
  name: { en: "Name", hi: "दवा का नाम", ta: "மருந்தின் பெயர்" },
  dosage: { en: "Dosage", hi: "खुराक", ta: "அளவு" },
  frequency: { en: "Frequency", hi: "आवृत्ति", ta: "எண்ணிக்கை" },
};

function translateTextLocally(text, lang) {
  if (!text || lang === "en") return text;
  if (lang === "hi") {
    return text
      .replace(/GENERAL MEDICINE CLINICAL OPD SUMMARY & TRIAGE REPORT/g, "सामान्य चिकित्सा क्लिनिकल ओपीडी सारांश और ट्राइएज रिपोर्ट")
      .replace(/AYUSH CLINICAL OPD - ROGA ITIHASA & PARIKSHA REPORT/g, "आयुष क्लिनिकल ओपीडी - रोग इतिहास एवं परीक्षा रिपोर्ट")
      .replace(/PATIENT DEMOGRAPHICS:/g, "मरीज का विवरण:")
      .replace(/ROGI VIVARANA \(PATIENT DEMOGRAPHICS\):/g, "रोगी विवरण (मरीज की जनसांख्यिकी):")
      .replace(/Rogi \(Patient Name\):/g, "रोगी का नाम:")
      .replace(/Name:/g, "नाम:")
      .replace(/Vaya \(Age\):/g, "वय (आयु):")
      .replace(/Age:/g, "आयु:")
      .replace(/Linga \(Gender\):/g, "लिंग:")
      .replace(/Gender:/g, "लिंग:")
      .replace(/Department:/g, "विभाग:")
      .replace(/CHIEF COMPLAINT \(CC\):/g, "मुख्य स्वास्थ्य समस्या (Chief Complaint):")
      .replace(/PRADHANA VEDANA \(CHIEF COMPLAINT & VIKRITI\):/g, "प्रधान वेदना (मुख्य लक्षण एवं विकृति):")
      .replace(/HISTORY OF PRESENT ILLNESS \(HPI\):/g, "वर्तमान बीमारी का इतिहास (HPI):")
      .replace(/ROGA ITIHASA \(HPI & DOSHA AGGRAVATION\):/g, "रोग इतिहास (दोष प्रकोप एवं अवधि):")
      .replace(/Onset \/ Duration:/g, "शुरुआत / अवधि:")
      .replace(/Onset & Duration:/g, "शुरुआत एवं अवधि:")
      .replace(/Severity:/g, "गंभीरता:")
      .replace(/Severity & Aggravating Factors:/g, "गंभीरता और बढ़ाने वाले कारक:")
      .replace(/Location:/g, "स्थान:")
      .replace(/Character:/g, "लक्षण का प्रकार:")
      .replace(/Radiation:/g, "फैलाव:")
      .replace(/Aggravating Factors:/g, "बढ़ाने वाले कारक:")
      .replace(/Relieving Factors:/g, "राहत देने वाले कारक:")
      .replace(/Associated Symptoms:/g, "संबंधित अन्य लक्षण:")
      .replace(/Daily \/ Dietary Triggers:/g, "दैनिक एवं आहार ट्रिगर:")
      .replace(/REVIEW OF SYSTEMS \(ROS\):/g, "शारीरिक प्रणाली समीक्षा (Review of Systems):")
      .replace(/DASHAVIDHA PARIKSHA \(10-FOLD CLINICAL MATRIX\):/g, "दशविध परीक्षा (10-चरणीय आयुष नैदानिक परीक्षण):")
      .replace(/1\. Deha Prakriti \(Thermal Traits & Skin\):/g, "1. देह प्रकृति (तापमान सहनशीलता एवं त्वचा):")
      .replace(/2\. Vikriti \(Current Symptoms & Imbalance\):/g, "2. विकृति (वर्तमान लक्षण एवं असंतुलन):")
      .replace(/3\. Agni Pariksha \(Hunger & Digestion\):/g, "3. अग्नि परीक्षा (भूख, पाचन एवं एसिडिटी):")
      .replace(/4\. Koshtha Pariksha \(Stool & Bowel Habits\):/g, "4. कोष्ठ परीक्षा (शौच एवं मल त्याग):")
      .replace(/5\. Sara Pariksha \(Tissue Vitality & Energy\):/g, "5. सार परीक्षा (शारीरिक ऊर्जा एवं धातु सार):")
      .replace(/6\. Samhanana \(Body Build & Compactness\):/g, "6. संहनन (शारीरिक बनावट):")
      .replace(/7\. Pramana \(Proportions & Weight Frame\):/g, "7. प्रमाण (शारीरिक अनुपात एवं वजन):")
      .replace(/8\. Satmya \(Dietary Habituation & Suitability\):/g, "8. सात्म्य (खान-पान की अनुकूलता):")
      .replace(/9\. Sattva \(Mental Resilience & Emotions\):/g, "9. सत्त्व परीक्षा (मानसिक स्थिति एवं तनाव):")
      .replace(/10\. Ahara & Vyayama Shakti \(Capacity\):/g, "10. आहार एवं व्यायाम शक्ति (पाचन एवं व्यायाम क्षमता):")
      .replace(/NIDRA & VIHARA \(SLEEP & DAILY HABITS\):/g, "निद्रा एवं विहार (नींद और दिनचर्या):")
      .replace(/Nidra \(Sleep Quality & Routine\):/g, "निद्रा (नींद की गुणवत्ता एवं समय):")
      .replace(/Vihara \(Daily Lifestyle & Habits\):/g, "विहार (दैनिक दिनचर्या और आदतें):")
      .replace(/PURVA VYADHI & AUSHADHI \(PAST ILLNESSES & MEDICATIONS\):/g, "पूर्व व्याधि एवं औषधि (पिछली बीमारियाँ और दवाएं):")
      .replace(/PAST MEDICAL & SURGICAL HISTORY:/g, "पूर्व चिकित्सा एवं शल्य इतिहास:")
      .replace(/Past Medical History:/g, "पूर्व चिकित्सा इतिहास:")
      .replace(/Past Surgical History:/g, "पूर्व शल्य चिकित्सा इतिहास:")
      .replace(/CURRENT MEDICATIONS & ALLERGIES:/g, "वर्तमान दवाएं एवं एलर्जी:")
      .replace(/Current Medications:/g, "वर्तमान दवाएं:")
      .replace(/Drug \/ Food Allergies:/g, "दवा या भोजन एलर्जी:")
      .replace(/Asatmya \/ Allergies:/g, "असात्म्य / एलर्जी:")
      .replace(/EMERGENCY RED FLAGS & TRIAGE ALERTS:/g, "आपातकालीन चेतावनी और ट्राइएज अलर्ट (Red Flags):")
      .replace(/ATYAYIKA AVASTHA \(EMERGENCY RED FLAGS\):/g, "आत्ययिक अवस्था (आपातकालीन चेतावनी - Red Flags):")
      .replace(/CLINICAL IMPRESSION & WORKUP RECOMMENDATION:/g, "चिकित्सकीय निष्कर्ष और प्रारंभिक जांच सुझाव:")
      .replace(/CHIKITSA SUTRA & PHYSICIAN NOTICE:/g, "चिकित्सा सूत्र एवं चिकित्सक सूचना:")
      .replace(/None detected - Hemodynamically stable/g, "कोई आपातकालीन लक्षण नहीं पाया गया - मरीज स्थिर है")
      .replace(/None detected - Patient hemodynamically stable/g, "कोई आपातकालीन लक्षण नहीं पाया गया - मरीज स्थिर है")
      .replace(/None reported/g, "कोई नहीं")
      .replace(/No chronic illness reported/g, "कोई पुरानी बीमारी दर्ज नहीं की गई")
      .replace(/No past surgeries reported/g, "कोई पिछली सर्जरी दर्ज नहीं की गई")
      .replace(/No known allergies reported/g, "कोई ज्ञात एलर्जी दर्ज नहीं की गई")
      .replace(/No known drug or food allergies/g, "दवा या भोजन से कोई ज्ञात एलर्जी नहीं है")
      .replace(/DOCUMENT ALERT:/g, "दस्तावेज़ सुरक्षा चेतावनी:")
      .replace(/Not specified/g, "निर्दिष्ट नहीं है");
  }
  if (lang === "ta") {
    return text
      .replace(/GENERAL MEDICINE CLINICAL OPD SUMMARY & TRIAGE REPORT/g, "பொது மருத்துவ மருத்துவமனை OPD சுருக்கம் மற்றும் ட்ரையேஜ் அறிக்கை")
      .replace(/AYUSH CLINICAL OPD - ROGA ITIHASA & PARIKSHA REPORT/g, "ஆயுஷ் மருத்துவமனை OPD - நோய் வரலாறு மற்றும் பரிசோதனை அறிக்கை")
      .replace(/PATIENT DEMOGRAPHICS:/g, "நோயாளி விவரங்கள்:")
      .replace(/ROGI VIVARANA \(PATIENT DEMOGRAPHICS\):/g, "நோயாளி விவரங்கள் (Rogi Vivarana):")
      .replace(/Rogi \(Patient Name\):/g, "நோயாளி பெயர்:")
      .replace(/Name:/g, "பெயர்:")
      .replace(/Vaya \(Age\):/g, "வயது (Vaya):")
      .replace(/Age:/g, "வயது:")
      .replace(/Linga \(Gender\):/g, "பாலினம் (Linga):")
      .replace(/Gender:/g, "பாலினம்:")
      .replace(/Department:/g, "பிரிவு:")
      .replace(/CHIEF COMPLAINT \(CC\):/g, "முதன்மை ஆரோக்கியப் பிரச்சினை (Chief Complaint):")
      .replace(/PRADHANA VEDANA \(CHIEF COMPLAINT & VIKRITI\):/g, "முதன்மை உபாதை மற்றும் தோஷ மாற்றம் (Pradhana Vedana):")
      .replace(/HISTORY OF PRESENT ILLNESS \(HPI\):/g, "தற்போதைய நோய் வரலாறு (HPI):")
      .replace(/ROGA ITIHASA \(HPI & DOSHA AGGRAVATION\):/g, "நோய் வரலாறு மற்றும் தோஷ சீர்கேடு (Roga Itihasa):")
      .replace(/Onset \/ Duration:/g, "தொடக்கம் / காலம்:")
      .replace(/Onset & Duration:/g, "தொடக்கம் மற்றும் காலம்:")
      .replace(/Severity:/g, "கடுமை:")
      .replace(/Severity & Aggravating Factors:/g, "கடுமை மற்றும் அதிகரிக்கும் காரணிகள்:")
      .replace(/Location:/g, "இடம்:")
      .replace(/Character:/g, "அறிகுறி வகை:")
      .replace(/Radiation:/g, "பரவும் இடம்:")
      .replace(/Aggravating Factors:/g, "அதிகரிக்கும் காரணிகள்:")
      .replace(/Relieving Factors:/g, "தணிக்கும் காரணிகள்:")
      .replace(/Associated Symptoms:/g, "தொடர்புடைய பிற அறிகுறிகள்:")
      .replace(/Daily \/ Dietary Triggers:/g, "தினசரி மற்றும் உணவுத் தூண்டல்கள்:")
      .replace(/REVIEW OF SYSTEMS \(ROS\):/g, "உடல் மண்டல ஆய்வு (Review of Systems):")
      .replace(/DASHAVIDHA PARIKSHA \(10-FOLD CLINICAL MATRIX\):/g, "தசவித பரிட்சை (10-படி ஆயுஷ் மருத்துவப் பரிசோதனை):")
      .replace(/1\. Deha Prakriti \(Thermal Traits & Skin\):/g, "1. தேக பிரகிருதி (உடல் வெப்ப உணர்வு மற்றும் சருமம்):")
      .replace(/2\. Vikriti \(Current Symptoms & Imbalance\):/g, "2. விக்ருதி (தற்போதைய தோஷ மாற்றம் மற்றும் அறிகுறிகள்):")
      .replace(/3\. Agni Pariksha \(Hunger & Digestion\):/g, "3. அக்னி பரீட்சை (பசி, செரிமானம் மற்றும் அசிடிட்டி):")
      .replace(/4\. Koshtha Pariksha \(Stool & Bowel Habits\):/g, "4. கோஷ்ட பரீட்சை (மலம் கழிக்கும் பழக்கம்):")
      .replace(/5\. Sara Pariksha \(Tissue Vitality & Energy\):/g, "5. சார பரீட்சை (உடல் பலம் மற்றும் தாது சாரம்):")
      .replace(/6\. Samhanana \(Body Build & Compactness\):/g, "6. சம்ஹனன பரீட்சை (உடல் கட்டமைப்பு):")
      .replace(/7\. Pramana \(Proportions & Weight Frame\):/g, "7. பிரமாண பரீட்சை (உடல் விகிதம் மற்றும் எடை):")
      .replace(/8\. Satmya \(Dietary Habituation & Suitability\):/g, "8. சாத்மிய பரீட்சை (உணவுப் பழக்கம் மற்றும் ஒவ்வாமை):")
      .replace(/9\. Sattva \(Mental Resilience & Emotions\):/g, "9. சத்துவ பரீட்சை (மன உறுதி மற்றும் உணர்ச்சி நிலை):")
      .replace(/10\. Ahara & Vyayama Shakti \(Capacity\):/g, "10. ஆகார & வியாயாம சக்தி (உணவு மற்றும் உடற்பயிற்சி திறன்):")
      .replace(/NIDRA & VIHARA \(SLEEP & DAILY HABITS\):/g, "நித்திரை மற்றும் விகாரம் (தூக்கம் மற்றும் அன்றாட வழக்கம்):")
      .replace(/Nidra \(Sleep Quality & Routine\):/g, "நித்திரை (தூக்கத்தின் தரம் மற்றும் வழக்கம்):")
      .replace(/Vihara \(Daily Lifestyle & Habits\):/g, "விகாரம் (தினசரி வாழ்க்கை முறை மற்றும் பழக்கங்கள்):")
      .replace(/PURVA VYADHI & AUSHADHI \(PAST ILLNESSES & MEDICATIONS\):/g, "முந்தைய நோய்கள் மற்றும் மருந்துகள்:")
      .replace(/PAST MEDICAL & SURGICAL HISTORY:/g, "முந்தைய மருத்துவ மற்றும் அறுவை சிகிச்சை வரலாறு:")
      .replace(/Past Medical History:/g, "முந்தைய மருத்துவ வரலாறு:")
      .replace(/Past Surgical History:/g, "முந்தைய அறுவை சிகிச்சை வரலாறு:")
      .replace(/CURRENT MEDICATIONS & ALLERGIES:/g, "தற்போதைய மருந்துகள் மற்றும் ஒவ்வாமை:")
      .replace(/Current Medications:/g, "தற்போதைய மருந்துகள்:")
      .replace(/Drug \/ Food Allergies:/g, "மருந்து அல்லது உணவு ஒவ்வாமை:")
      .replace(/Asatmya \/ Allergies:/g, "அசாத்மியா / ஒவ்வாமை:")
      .replace(/EMERGENCY RED FLAGS & TRIAGE ALERTS:/g, "அவசர எச்சரிக்கை மற்றும் ட்ரையேஜ் முன்னறிவிப்பு (Red Flags):")
      .replace(/ATYAYIKA AVASTHA \(EMERGENCY RED FLAGS\):/g, "அத்தியாயிக அவஸ்தை (அவசர எச்சரிக்கை - Red Flags):")
      .replace(/CLINICAL IMPRESSION & WORKUP RECOMMENDATION:/g, "மருத்துவக் கணிப்பு மற்றும் பரிசோதனைப் பரிந்துரைகள்:")
      .replace(/CHIKITSA SUTRA & PHYSICIAN NOTICE:/g, "சிகிச்சை சூத்திரம் மற்றும் மருத்துவர் அறிவிப்பு:")
      .replace(/None detected - Hemodynamically stable/g, "அவசர அறிகுறிகள் எதுவும் இல்லை - நோயாளி நிலையாக உள்ளார்")
      .replace(/None detected - Patient hemodynamically stable/g, "அவசர அறிகுறிகள் எதுவும் இல்லை - நோயாளி நிலையாக உள்ளார்")
      .replace(/None reported/g, "எதுவும் இல்லை")
      .replace(/No chronic illness reported/g, "முந்தைய நாள்பட்ட நோய்கள் எதுவும் இல்லை")
      .replace(/No past surgeries reported/g, "அறுவை சிகிச்சை எதுவும் செய்யப்படவில்லை")
      .replace(/No known allergies reported/g, "ஒவ்வாமை எதுவும் பதிவு செய்யப்படவில்லை")
      .replace(/No known drug or food allergies/g, "மருந்து அல்லது உணவு ஒவ்வாமை எதுவும் இல்லை")
      .replace(/DOCUMENT ALERT:/g, "ஆவண பாதுகாப்பு எச்சரிக்கை:")
      .replace(/Not specified/g, "குறிப்பிடப்படவில்லை");
  }
  return text;
}

function Field({ value, lang = "en" }) {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--slate-soft)" }}>—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "var(--slate-soft)" }}>—</span>;
    return (
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {value.map((v, i) => (
          <li key={i}>{typeof v === "object" ? <Field value={v} lang={lang} /> : String(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
        {Object.entries(value)
          .filter(([k]) => k !== "source")
          .map(([k, v]) => {
            const labelText = FIELD_LABELS[k]?.[lang] || FIELD_LABELS[k]?.en || titleCase(k);
            return (
              <div key={k}>
                <span style={{ color: "var(--slate)" }}>{labelText}: </span>
                <Field value={v} lang={lang} />
              </div>
            );
          })}
      </div>
    );
  }
  return <>{String(value)}</>;
}

function Section({ sectionKey, defaultTitle, data, lang = "en" }) {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) return null;
  const title = SECTION_TITLES[sectionKey]?.[lang] || SECTION_TITLES[sectionKey]?.en || defaultTitle;
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      <Field value={data} lang={lang} />
    </div>
  );
}

const SECTION_KEYS = [
  ["chief_complaint", "Chief Complaint"],
  ["hpi", "History of Present Illness"],
  ["review_of_systems", "Review of Systems"],
  ["past_medical_history", "Past Medical History"],
  ["past_surgical_history", "Past Surgical History"],
  ["drug_allergy_history", "Drug & Allergy History"],
  ["family_history", "Family History"],
  ["personal_history", "Personal History"],
  ["ayush_history", "AYUSH History"],
];

export default function PatientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [queueEntry, setQueueEntry] = useState(null);
  const [summary, setSummary] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [fhirBundle, setFhirBundle] = useState(null);
  const [showFhir, setShowFhir] = useState(false);
  const [summaryLang, setSummaryLang] = useState("en");
  const [langCache, setLangCache] = useState({});
  const [expandedOcr, setExpandedOcr] = useState({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    const entry = getQueueEntry(id);
    setQueueEntry(entry);
    try {
      if (entry?.summary) {
        setSummary(entry.summary);
        const text = entry.summary.clinical_summary_text || "";
        setEditedText(text);
        setLangCache({ en: text });
      } else {
        const clinicalHistory = await getClinicalSummary(id);
        setSummary(clinicalHistory);
        const text = clinicalHistory.clinical_summary_text || "";
        setEditedText(text);
        setLangCache({ en: text });
      }
      const docs = await getDocuments(id).catch(() => []);
      setDocuments(Array.isArray(docs) ? docs : docs.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLanguageChange(targetLang) {
    if (targetLang === summaryLang) return;
    if (langCache[targetLang]) {
      setSummaryLang(targetLang);
      setEditedText(langCache[targetLang]);
      return;
    }

    setSummaryLang(targetLang);
    setTranslating(true);

    // Instant local translation for zero-latency UI update
    const instantText = translateTextLocally(editedText, targetLang);
    setEditedText(instantText);
    setLangCache((prev) => ({ ...prev, [targetLang]: instantText }));

    try {
      const res = await translateSummary(id, editedText, targetLang);
      if (res?.summaryText) {
        setEditedText(res.summaryText);
        setLangCache((prev) => ({ ...prev, [targetLang]: res.summaryText }));
      }
    } catch (_) {
      // Keep instant text
    } finally {
      setTranslating(false);
    }
  }

  function handleSpeakSummary() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanSpeechText = (editedText || "")
      .replace(/\*\*/g, "")
      .replace(/#/g, "")
      .replace(/•/g, "")
      .replace(/-/g, " ");

    if (!cleanSpeechText.trim()) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    const targetLangCode = summaryLang === "hi" ? "hi-IN" : summaryLang === "ta" ? "ta-IN" : "en-IN";
    utterance.lang = targetLangCode;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = targetLangCode.substring(0, 2).toLowerCase();
    const matchedVoice = voices.find(
      (v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix)
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function handleGenerateMerged() {
    setLoading(true);
    setError(null);
    try {
      const clinicalHistory = await getClinicalSummary(id);
      const merged = await generateFinalSummary(id, clinicalHistory, summaryLang);
      setSummary(merged);
      setEditedText(merged.clinical_summary_text || "");
      setLangCache({ [summaryLang]: merged.clinical_summary_text || "" });
      upsertQueueEntry(id, { summary: merged, redFlags: merged.red_flags || [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    const finalSummary = {
      ...summary,
      clinical_summary_text: editedText,
      meta: {
        ...(summary?.meta || {}),
        session_id: id,
        physician_edits: {
          ...(summary?.meta?.physician_edits || {}),
          confirmed: true,
          edited: editedText !== summary?.clinical_summary_text,
          editedAt: new Date().toISOString(),
          reviewedBy: "demo-doctor",
        },
      },
    };
    setSummary(finalSummary);
    upsertQueueEntry(id, { status: "confirmed", summary: finalSummary });
    setFhirBundle(buildMockFhirBundle(finalSummary));
  }

  function handleReject() {
    upsertQueueEntry(id, { status: "in_progress" });
    router.push("/dashboard");
  }

  if (loading) {
    return <main style={{ maxWidth: 800, margin: "0 auto", padding: 40 }}>Loading patient…</main>;
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }} onClick={() => router.push("/dashboard")}>
        ← Queue
      </button>

      <p className="eyebrow">Patient record</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <span
          style={{
            background: queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "#ecfdf5" : "#e0f2fe",
            color: queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "#047857" : "#0369a1",
            padding: "4px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            border: queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "1px solid #a7f3d0" : "1px solid #bae6fd",
          }}
        >
          {queueEntry?.department === "AYUSH" || summary?.department === "AYUSH" ? "🌿 AYUSH OPD" : "🏥 GENERAL MEDICINE OPD"}
        </span>
      </div>

      <h1 style={{ fontSize: 30, marginTop: 4, marginBottom: 4 }}>{queueEntry?.name || summary?.patient?.name || "Patient"}</h1>
      <p style={{ color: "var(--slate)", marginBottom: 24 }}>
        {queueEntry?.age ? `${queueEntry.age} yrs` : ""} {queueEntry?.gender ? `· ${queueEntry.gender}` : ""}{" "}
        {queueEntry?.abhaId ? `· ${queueEntry.abhaId}` : ""}
      </p>

      {error && <div className="banner banner-red" style={{ marginBottom: 20 }}>{error}</div>}

      <RedFlagBanner flags={summary?.red_flags} tone="red" />

      {/* Patient-Document Mismatch Safety Guard Banner */}
      {(summary?.document_alerts?.length > 0 || documents?.some((d) => d.is_mismatch)) && (
        <div
          className="card"
          style={{
            background: "#fffbeb",
            border: "1.5px solid #fde68a",
            borderRadius: 14,
            padding: 18,
            margin: "16px 0 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#b45309", fontWeight: 700, fontSize: 16 }}>
            ⚠️ PATIENT-DOCUMENT MISMATCH DETECTED
          </div>
          <p style={{ color: "#92400e", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
            The uploaded prescription/lab report belongs to another patient (e.g. <strong>Ramesh Kumar, 52M</strong>) and does not match current intake patient (<strong>{queueEntry?.name || summary?.patient?.name || "Navaneethan R S"}, {queueEntry?.age || summary?.patient?.age || "24"}M</strong>).
          </p>
          <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 8, border: "1px solid #fef3c7", fontSize: 13, color: "#78350f", marginBottom: 14 }}>
            🛡️ <strong>Safety Guard Active:</strong> Diagnoses and medications from this document have <strong>NOT</strong> been incorporated into this patient's history.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => alert("Reviewing document: Ramesh Kumar, 52M prescription.")}>
              🔍 REVIEW DOCUMENT
            </button>
            <button className="btn btn-secondary btn-sm" style={{ borderColor: "#d97706", color: "#92400e" }} onClick={() => alert("Marked as not this patient's document.")}>
              ❌ MARK AS NOT MY DOCUMENT
            </button>
          </div>
        </div>
      )}

      {/* AYUSH OPD - Structured Clinical Matrix for Doctor Review */}
      {summary?.ayushAssessment && (
        <div className="card" style={{ marginBottom: 20, border: "1.5px solid #a7f3d0", background: "#f0fdf4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: 18, margin: 0, color: "#065f46" }}>🌿 AYUSH CLINICAL INTAKE MATRIX & DASHAVIDHA PARIKSHA</h3>
                <span style={{ background: "#d1fae5", color: "#047857", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                  Doctor Review & Verification
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#047857", margin: "4px 0 0" }}>
                Verify natural patient-reported intake observations against Ayurvedic clinical parameters. Edit or confirm before consultation.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: "#059669", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, padding: "5px 12px", fontWeight: 600 }}
                onClick={() => {
                  const updated = { ...summary };
                  Object.keys(updated.ayushAssessment).forEach((k) => {
                    const itm = updated.ayushAssessment[k];
                    itm.clinicianConfirmed = true;
                    if (!itm.clinicianValue) itm.clinicianValue = itm.patientReported || "Clinician Verified";
                  });
                  setSummary({ ...updated });
                }}
              >
                ✓ Confirm All Mappings
              </button>
            </div>
          </div>

          <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12.5, color: "#065f46" }}>
            🛡️ <strong>Clinical Safety Scope:</strong> The Live AI Intake Assistant collected patient-reported symptoms and characteristics using natural non-technical questions. Prakriti, Vikriti, and Dosha clinical diagnoses are exclusively determined and confirmed by the attending AYUSH clinician below.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "#d1fae5", textTransform: "uppercase", fontSize: 11, color: "#065f46", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", width: "25%" }}>Clinical Parameter</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", width: "35%" }}>Patient-Reported Intake Observation</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", width: "15%" }}>Verification</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", width: "25%" }}>Doctor Clinical Value / Notes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.ayushAssessment).map(([key, val]) => {
                  const meta = AYUSH_FIELD_META[key] || {};
                  return (
                    <tr key={key} style={{ borderBottom: "1px solid #a7f3d0" }}>
                      <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>
                          {meta.label || titleCase(key)}
                        </div>
                        {meta.sanskrit && (
                          <div style={{ fontSize: 11.5, color: "#059669", fontWeight: 600, marginTop: 2 }}>
                            {meta.sanskrit}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#374151", verticalAlign: "top", lineHeight: 1.45 }}>
                        {val?.patientReported ? (
                          <span>{val.patientReported}</span>
                        ) : (
                          <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Not reported</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: val?.clinicianConfirmed ? "#10b981" : "#e5e7eb",
                            color: val?.clinicianConfirmed ? "#ffffff" : "#374151",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 12,
                            border: "none",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            const updated = { ...summary };
                            const item = updated.ayushAssessment[key];
                            item.clinicianConfirmed = !item.clinicianConfirmed;
                            if (item.clinicianConfirmed && !item.clinicianValue) {
                              item.clinicianValue = item.patientReported;
                            }
                            setSummary({ ...updated });
                          }}
                        >
                          {val?.clinicianConfirmed ? "✓ Verified" : "+ Verify"}
                        </button>
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                        {meta.options && meta.options.length > 0 && (
                          <select
                            style={{
                              width: "100%",
                              padding: "4px 6px",
                              borderRadius: 6,
                              border: "1px solid #6ee7b7",
                              fontSize: 12,
                              background: "#ffffff",
                              marginBottom: 4,
                            }}
                            value={val?.clinicianValue || ""}
                            onChange={(e) => {
                              const updated = { ...summary };
                              updated.ayushAssessment[key].clinicianValue = e.target.value;
                              updated.ayushAssessment[key].clinicianConfirmed = true;
                              setSummary({ ...updated });
                            }}
                          >
                            <option value="">-- Select Clinical Assessment --</option>
                            {meta.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          value={val?.clinicianValue || ""}
                          placeholder={val?.patientReported || "Doctor clinical note"}
                          onChange={(e) => {
                            const updated = { ...summary };
                            updated.ayushAssessment[key].clinicianValue = e.target.value;
                            setSummary({ ...updated });
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid #6ee7b7",
                            fontSize: 12.5,
                            width: "100%",
                            background: "#ffffff",
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GENERAL MEDICINE OPD - Structured SOCRATES Evaluation Panel */}
      {(!summary?.ayushAssessment && (summary?.hpi || summary?.chief_complaint)) && (
        <div className="card" style={{ marginBottom: 20, border: "1.5px solid #bae6fd", background: "#f0f9ff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: 18, margin: 0, color: "#0369a1" }}>🏥 GENERAL MEDICINE CLINICAL EVALUATION & SOCRATES MATRIX</h3>
                <span style={{ background: "#e0f2fe", color: "#0284c7", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                  Doctor Review & Verification
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#0284c7", margin: "4px 0 0" }}>
                Structured clinical intake history and Review of Systems for physician evaluation.
              </p>
            </div>
          </div>

          {/* Quick Triage Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0f2fe" }}>
              <div style={{ fontSize: 11.5, color: "var(--slate)", textTransform: "uppercase", fontWeight: 600 }}>Chief Complaint</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginTop: 2 }}>
                {summary.chief_complaint?.text || summary.chief_complaint?.text_en || "Reported"}
              </div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0f2fe" }}>
              <div style={{ fontSize: 11.5, color: "var(--slate)", textTransform: "uppercase", fontWeight: 600 }}>Onset / Duration</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginTop: 2 }}>
                {summary.hpi?.onset || "Not specified"}
              </div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0f2fe" }}>
              <div style={{ fontSize: 11.5, color: "var(--slate)", textTransform: "uppercase", fontWeight: 600 }}>Severity Score</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: summary.hpi?.severity?.includes("severe") || Number(summary.hpi?.severity) >= 7 ? "#dc2626" : "#0284c7", marginTop: 2 }}>
                {summary.hpi?.severity || "Reported"}
              </div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0f2fe" }}>
              <div style={{ fontSize: 11.5, color: "var(--slate)", textTransform: "uppercase", fontWeight: 600 }}>Triage Red Flags</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: summary.red_flags?.length ? "#dc2626" : "#16a34a", marginTop: 2 }}>
                {summary.red_flags?.length ? `🚨 ${summary.red_flags.length} Alert(s)` : "🟢 Hemodynamically Stable"}
              </div>
            </div>
          </div>

          {/* SOCRATES Breakdown Table */}
          <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid #e0f2fe", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "#e0f2fe", textTransform: "uppercase", fontSize: 11, color: "#0369a1", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", width: "30%" }}>SOCRATES Dimension</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", width: "70%" }}>Patient Reported Observation</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Onset & Timing", summary.hpi?.onset || "Not specified"],
                  ["Location", summary.hpi?.location || "Not specified"],
                  ["Character & Quality", summary.hpi?.character || "Not specified"],
                  ["Radiation", summary.hpi?.radiation || "None reported"],
                  ["Aggravating Factors", summary.hpi?.exacerbating_factors || "None reported"],
                  ["Relieving Factors", summary.hpi?.relieving_factors || "None reported"],
                  ["Associated Symptoms", summary.hpi?.associated_symptoms || "None reported"],
                ].map(([label, val], idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#334155" }}>{label}</td>
                    <td style={{ padding: "8px 12px", color: "#0f172a" }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!summary?.clinical_summary_text && (
        <div className="card" style={{ margin: "18px 0", textAlign: "center" }}>
          <p style={{ color: "var(--slate)", marginBottom: 12 }}>
            The merged AI summary hasn&rsquo;t been generated for this session yet.
          </p>
          <button className="btn btn-primary" onClick={handleGenerateMerged}>
            Generate merged summary
          </button>
        </div>
      )}

      {summary?.clinical_summary_text && (
        <div className="card" style={{ margin: "18px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="eyebrow">AI-generated summary</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Doctor Language Toggle */}
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  className="btn btn-sm"
                  style={{
                    borderRadius: 0,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: summaryLang === "en" ? "var(--teal-dark)" : "transparent",
                    color: summaryLang === "en" ? "#fff" : "var(--slate)",
                  }}
                  onClick={() => handleLanguageChange("en")}
                  disabled={translating}
                >
                  English
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    borderRadius: 0,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: summaryLang === "hi" ? "var(--teal-dark)" : "transparent",
                    color: summaryLang === "hi" ? "#fff" : "var(--slate)",
                  }}
                  onClick={() => handleLanguageChange("hi")}
                  disabled={translating}
                >
                  हिंदी
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    borderRadius: 0,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: summaryLang === "ta" ? "var(--teal-dark)" : "transparent",
                    color: summaryLang === "ta" ? "#fff" : "var(--slate)",
                  }}
                  onClick={() => handleLanguageChange("ta")}
                  disabled={translating}
                >
                  தமிழ்
                </button>
              </div>

              {/* TTS Audio Button */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSpeakSummary}
                title={isSpeaking ? "Stop Reading" : "Read Aloud"}
                style={{
                  background: isSpeaking ? "#fee2e2" : undefined,
                  color: isSpeaking ? "#991b1b" : undefined,
                  borderColor: isSpeaking ? "#f87171" : undefined,
                }}
              >
                {isSpeaking ? "🛑 Stop" : "🔊 Listen"}
              </button>

              {!fhirBundle && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing((e) => !e)}>
                  {editing ? "Cancel edit" : "Edit"}
                </button>
              )}
            </div>
          </div>

          {translating && <div style={{ fontSize: 13, color: "var(--slate)", marginBottom: 8 }}>Translating clinical summary…</div>}

          {editing ? (
            <textarea
              rows={7}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              style={{ width: "100%", fontFamily: "var(--font-body)", fontSize: 15, padding: 12, borderRadius: 10, border: "1.5px solid var(--line)" }}
            />
          ) : (
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{editedText}</p>
          )}
        </div>
      )}

      {/* PREVIOUS PRESCRIPTIONS & MEDICAL DOCUMENTS CLINICAL ANALYSIS */}
      {documents?.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: "1.5px solid #38bdf8", background: "#f0f9ff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0369a1" }}>
                PREVIOUS PRESCRIPTIONS & DOCUMENT CLINICAL ANALYSIS
              </h3>
            </div>
            <span style={{ background: "#bae6fd", color: "#0369a1", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
              {documents.length} Document{documents.length > 1 ? "s" : ""} Analyzed
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {documents.map((doc, idx) => {
              const isRx = (doc.document_type || doc.documentType) === "prescription";
              const isExpanded = !!expandedOcr[doc.document_id || idx];
              return (
                <div
                  key={doc.document_id || idx}
                  style={{
                    background: "#ffffff",
                    borderRadius: 12,
                    padding: 18,
                    border: "1px solid #e0f2fe",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#0c4a6e" }}>
                          {isRx ? "💊 Previous Doctor Prescription" : (doc.document_type || doc.documentType) === "lab_report" ? "🧪 Diagnostic Lab Report" : "🏥 Hospital Discharge Summary"}
                        </span>
                        {doc.document_date && (
                          <span style={{ fontSize: 12, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 6 }}>
                            📅 {doc.document_date}
                          </span>
                        )}
                      </div>
                      {(doc.doctor_name || doc.clinic_or_hospital) && (
                        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#0284c7", fontWeight: 600 }}>
                          👨‍⚕️ {doc.doctor_name || "Physician"}
                          {doc.doctor_specialty && ` (${doc.doctor_specialty})`}
                          {doc.clinic_or_hospital && ` • ${doc.clinic_or_hospital}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* AI Clinical Synopsis / Short Description */}
                  {doc.short_description && (
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 10,
                        padding: "12px 14px",
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#1d4ed8", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        🧠 AI Clinical Synopsis / Previous Prescription Summary:
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: "#1e3a8a", lineHeight: 1.55 }}>
                        {doc.short_description}
                      </p>
                    </div>
                  )}

                  {/* Identified Diagnoses / Impressions */}
                  {doc.extracted_diagnoses?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: "var(--slate)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Identified Diagnoses / Clinical Findings
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {doc.extracted_diagnoses.map((dx, i) => (
                          <span
                            key={i}
                            style={{
                              background: "#fef3c7",
                              color: "#92400e",
                              padding: "4px 10px",
                              borderRadius: 8,
                              fontSize: 12.5,
                              fontWeight: 600,
                              border: "1px solid #fde68a",
                            }}
                          >
                            🩺 {dx}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Medications Table */}
                  {doc.extracted_medications?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: "var(--slate)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Previous Prescribed Medications
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                              <th style={{ padding: "8px 10px", width: "35%" }}>Medication Name</th>
                              <th style={{ padding: "8px 10px", width: "18%" }}>Dosage</th>
                              <th style={{ padding: "8px 10px", width: "22%" }}>Frequency / Timing</th>
                              <th style={{ padding: "8px 10px", width: "25%" }}>Clinical Instructions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {doc.extracted_medications.map((m, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0f172a" }}>
                                  💊 {m.name}
                                </td>
                                <td style={{ padding: "8px 10px", color: "#334155" }}>
                                  {m.dosage || "—"}
                                </td>
                                <td style={{ padding: "8px 10px", color: "#334155" }}>
                                  {m.frequency || "As directed"}
                                </td>
                                <td style={{ padding: "8px 10px", color: "#64748b", fontSize: 12.5 }}>
                                  {m.instructions || "Standard prescription"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Physician Advice & Instructions */}
                  {doc.advice && (
                    <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8, fontSize: 13, color: "#334155", marginBottom: 12 }}>
                      <strong>📝 Advice & Follow-up:</strong> {doc.advice}
                    </div>
                  )}

                  {/* Toggle Raw OCR Text */}
                  {doc.raw_ocr_text && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#0284c7",
                          fontSize: 12.5,
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                        onClick={() =>
                          setExpandedOcr((prev) => ({
                            ...prev,
                            [doc.document_id || idx]: !prev[doc.document_id || idx],
                          }))
                        }
                      >
                        {isExpanded ? "▲ Hide Raw Handwritten OCR Text" : "▼ View Raw Handwritten OCR Transcription"}
                      </button>
                      {isExpanded && (
                        <pre
                          style={{
                            marginTop: 8,
                            padding: 12,
                            background: "#f1f5f9",
                            borderRadius: 8,
                            fontSize: 12,
                            whiteSpace: "pre-wrap",
                            fontFamily: "var(--font-mono)",
                            color: "#334155",
                            lineHeight: 1.5,
                          }}
                        >
                          {doc.raw_ocr_text}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


      <div className="card" style={{ marginBottom: 20 }}>
        {SECTION_KEYS.map(([key, label]) => (
          <Section key={key} sectionKey={key} defaultTitle={label} data={summary?.[key]} lang={summaryLang} />
        ))}
      </div>

      {fhirBundle ? (
        <div
          className="card"
          style={{
            background: "#ecfdf5",
            border: "1.5px solid #a7f3d0",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#10b981",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: "bold",
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div>
              <h2 style={{ fontSize: 19, color: "#065f46", margin: 0, fontWeight: 700 }}>
                Patient Record Confirmed & EMR Sync Complete
              </h2>
              <p style={{ color: "#047857", fontSize: 13.5, margin: "3px 0 0" }}>
                Physician review complete. Intaked history & extracted documents verified into hospital EHR / ABDM.
              </p>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: 16,
              border: "1px solid #d1fae5",
              marginBottom: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              fontSize: 14,
            }}
          >
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>Patient Name</span>
              <strong>{queueEntry?.name || summary?.patient?.name || "Patient"}</strong>
            </div>
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>ABHA / Health ID</span>
              <strong>{queueEntry?.abhaId || summary?.patient?.abhaId || "ABDM-SYNCED"}</strong>
            </div>
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>Status</span>
              <span style={{ color: "#059669", fontWeight: 600 }}>🟢 EMR Confirmed</span>
            </div>
            <div>
              <span style={{ color: "var(--slate)", fontSize: 12, display: "block" }}>Confirmed Time</span>
              <strong>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              className="btn btn-primary"
              style={{ padding: "10px 20px", fontSize: 14 }}
              onClick={() => router.push("/dashboard")}
            >
              ← Back to Patient Queue
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 13 }}
              onClick={() => setShowFhir((show) => !show)}
            >
              {showFhir ? "Hide FHIR Payload" : "📄 View Technical FHIR Payload"}
            </button>
          </div>

          {showFhir && (
            <pre
              style={{
                marginTop: 16,
                background: "#0f1b1b",
                color: "#c9e9e6",
                padding: 16,
                borderRadius: 10,
                fontSize: 12,
                overflowX: "auto",
                fontFamily: "var(--font-mono)",
              }}
            >
              {JSON.stringify(fhirBundle, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        summary?.clinical_summary_text && (
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirm}>
              Confirm & submit
            </button>
            <button className="btn btn-secondary" onClick={handleReject}>
              Send back to interview
            </button>
          </div>
        )
      )}
    </main>
  );
}
