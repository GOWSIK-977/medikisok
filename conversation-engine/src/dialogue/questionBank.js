/**
 * Multi-lingual question bank supporting English, Hindi (हिन्दी), and Tamil (தமிழ்).
 * Provides deterministic questions for General Medicine (SOCRATES, ROS, History)
 * and AYUSH OPD (10-Domain Dashavidha Pariksha Intake).
 */

// General Medicine OPD - Opening Questions
const GENERAL_MEDICINE_INITIAL = {
  en: 'What is the main health problem that brought you in today?',
  hi: 'आज आपको क्या मुख्य स्वास्थ्य समस्या है जिसके लिए आप अस्पताल आए हैं?',
  ta: 'இன்று உங்களுக்கு ஏற்பட்டுள்ள முதன்மை உடல்நலப் பிரச்சினை என்ன?',
};

// SOCRATES field templates in English, Hindi, and Tamil
const SOCRATES_TEMPLATES_EN = {
  onset: 'When did this start?',
  location: 'Where exactly do you feel it?',
  character: 'How would you describe it - sharp, dull, burning, cramping?',
  radiation: 'Does it spread anywhere else, like your arm, back, or jaw?',
  associated_symptoms: 'Is there anything else you notice along with it, like nausea, sweating, or breathlessness?',
  timing: 'Is it constant, or does it come and go?',
  exacerbating_factors: 'Does anything make it worse - movement, eating, breathing in deeply?',
  relieving_factors: 'Does anything make it better - rest, medicine, a certain position?',
  severity: 'On a scale of 1 to 10, how bad is it right now?',
};

const SOCRATES_TEMPLATES_HI = {
  onset: 'यह समस्या कब शुरू हुई थी?',
  location: 'यह दर्द या परेशानी शरीर में ठीक किस जगह महसूस हो रही है?',
  character: 'यह दर्द कैसा है - तेज़, हल्का, जलन जैसा, या ऐंठन वाला?',
  radiation: 'क्या यह दर्द कहीं और भी फैलता है, जैसे बांह, पीठ या जबड़े में?',
  associated_symptoms: 'क्या इसके साथ कोई और लक्षण भी है, जैसे जी मिचलाना, पसीना आना या सांस फूलना?',
  timing: 'क्या यह लगातार बना रहता है या आता-जाता रहता है?',
  exacerbating_factors: 'क्या किसी चीज़ से यह बढ़ता है - हिलने-डुलने, खाने या गहरी सांस लेने से?',
  relieving_factors: 'क्या किसी चीज़ से आराम मिलता है - आराम करने, दवा लेने या किसी खास मुद्रा से?',
  severity: '1 से 10 के पैमाने पर, अभी यह दर्द कितना गंभीर है?',
};

const SOCRATES_TEMPLATES_TA = {
  onset: 'இது எப்போது தொடங்கியது?',
  location: 'இந்த வலி அல்லது பிரச்சினை உடலில் சரியாக எங்கே உணரப்படுகிறது?',
  character: 'இந்த வலி எந்த வகையைச் சேர்ந்தது - கூர்மையானது, மந்தமானது, எரியும் தன்மை அல்லது பிடிப்பு போன்றதா?',
  radiation: 'இந்த வலி வேறு எங்காவது பரவுகிறதா, உதாரணத்திற்கு கை, முதுகு அல்லது தாடைக்கு?',
  associated_symptoms: 'இதனுடன் குமட்டல், அதிக வியர்வை அல்லது மூச்சுத்திணறல் போன்ற பிற அறிகுறிகள் உள்ளதா?',
  timing: 'இது தொடர்ந்து இருக்கிறதா அல்லது விட்டு விட்டு வருகிறதா?',
  exacerbating_factors: 'அசைவு, உணவு உட்கொள்ளல் அல்லது ஆழ்ந்த மூச்சு போன்றவற்றால் இது அதிகரிக்கிறதா?',
  relieving_factors: 'ஓய்வு, மருந்து அல்லது குறிப்பிட்ட நிலையில் இருக்கும்போது இது குறைகிறதா?',
  severity: '1 முதல் 10 வரையிலான அளவில், தற்போது இந்த வலியின் கடுமை எவ்வளவு?',
};

// Which SOCRATES fields to ask, and in what order, per chief-complaint category.
const COMPLAINT_FLOWS = {
  chest_pain: ['onset', 'location', 'character', 'radiation', 'associated_symptoms', 'exacerbating_factors', 'relieving_factors', 'severity'],
  abdominal_pain: ['onset', 'location', 'character', 'associated_symptoms', 'timing', 'exacerbating_factors', 'relieving_factors', 'severity'],
  headache: ['onset', 'location', 'character', 'associated_symptoms', 'timing', 'exacerbating_factors', 'relieving_factors', 'severity'],
  fever: ['onset', 'timing', 'associated_symptoms', 'severity'],
  cough: ['onset', 'character', 'timing', 'associated_symptoms', 'exacerbating_factors', 'severity'],
  default: ['onset', 'location', 'character', 'associated_symptoms', 'timing', 'exacerbating_factors', 'relieving_factors', 'severity'],
};

// Keyword -> complaint category
const COMPLAINT_KEYWORDS = {
  chest_pain: ['chest pain', 'chest', 'seene mein dard', 'seene', 'நெஞ்சு வலி', 'மார்பு வலி', 'நெஞ்சு'],
  abdominal_pain: ['stomach', 'abdomen', 'abdominal', 'pet mein', 'belly', 'வயிற்று வலி', 'வயிறு'],
  headache: ['headache', 'head pain', 'sar mein dard', 'migraine', 'தலைவலி', 'தலை வலி'],
  fever: ['fever', 'bukhar', 'temperature', 'காய்ச்சல்', 'சுரம்'],
  cough: ['cough', 'khaansi', 'khansi', 'இருமல்', 'சளி'],
};

function detectComplaintCategory(chiefComplaintText) {
  const text = (chiefComplaintText || '').toLowerCase();
  for (const [category, keywords] of Object.entries(COMPLAINT_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) return category;
  }
  return 'default';
}

function getHpiFieldOrder(complaintCategory) {
  return COMPLAINT_FLOWS[complaintCategory] || COMPLAINT_FLOWS.default;
}

function getHpiQuestionPrompt(field, language = 'en') {
  if (language.startsWith('hi')) return SOCRATES_TEMPLATES_HI[field] || SOCRATES_TEMPLATES_EN[field];
  if (language.startsWith('ta')) return SOCRATES_TEMPLATES_TA[field] || SOCRATES_TEMPLATES_EN[field];
  return SOCRATES_TEMPLATES_EN[field] || 'Could you tell me more about this symptom?';
}

// Review of systems (ROS)
const ROS_QUESTIONS = [
  {
    system: 'cardiovascular',
    question: 'Any chest pain, palpitations, or breathlessness on exertion?',
    question_hi: 'क्या आपको सीने में दर्द, धड़कन तेज होना या चलने पर सांस फूलने की समस्या है?',
    question_ta: 'உங்களுக்கு நெஞ்சு வலி, படபடப்பு அல்லது நடக்கும்போது மூச்சுத்திணறல் உள்ளதா?',
  },
  {
    system: 'respiratory',
    question: 'Any cough, breathlessness, or wheezing?',
    question_hi: 'क्या आपको खांसी, सांस लेने में तकलीफ या सीने में सीटी जैसी आवाज आती है?',
    question_ta: 'உங்களுக்கு இருமல், மூச்சுத்திணறல் அல்லது இளைப்பு (wheezing) உள்ளதா?',
  },
  {
    system: 'gastrointestinal',
    question: 'Any nausea, vomiting, changes in appetite, or bowel habits?',
    question_hi: 'क्या आपको जी मिचलाना, उल्टी, भूख में कमी या पेट साफ होने में कोई परेशानी है?',
    question_ta: 'உங்களுக்கு குமட்டல், வாந்தி, பசியின்மை அல்லது மலம் கழிப்பதில் மாற்றம் உள்ளதா?',
  },
  {
    system: 'genitourinary',
    question: 'Any burning urination, frequency, or blood in urine?',
    question_hi: 'क्या पेशाब में जलन, बार-बार पेशाब आना या पेशाब में खून आने की शिकायत है?',
    question_ta: 'சிறுநீர் கழிக்கும்போது எரிச்சல், அடிக்கடி செல்லுதல் அல்லது சிறுநீரில் ரத்தம் உள்ளதா?',
  },
  {
    system: 'neurological',
    question: 'Any headaches, dizziness, weakness, or numbness?',
    question_hi: 'क्या आपको सिरदर्द, चक्कर आना, कमजोरी या हाथ-पैर सुन्न होने की समस्या है?',
    question_ta: 'தலைவலி, தலைசுற்றல், உடல் பலவீனம் அல்லது மரத்துப்போதல் உள்ளதா?',
  },
  {
    system: 'musculoskeletal',
    question: 'Any joint pain, stiffness, or swelling?',
    question_hi: 'क्या जोड़ों में दर्द, जकड़न या सूजन की समस्या है?',
    question_ta: 'மூட்டு வலி, விரைப்புத்தன்மை அல்லது மூட்டுகளில் வீக்கம் உள்ளதா?',
  },
  {
    system: 'general',
    question: 'Any recent weight loss, fatigue, or fever?',
    question_hi: 'क्या हाल ही में वजन कम होना, कमजोरी या बुखार महसूस हुआ है?',
    question_ta: 'சமீபத்தில் உடல் எடை குறைவு, தீவிர சோர்வு அல்லது காய்ச்சல் ஏற்பட்டுள்ளதா?',
  },
];

function getRosQuestionPrompt(rosItem, language = 'en') {
  if (!rosItem) return '';
  if (language.startsWith('hi') && rosItem.question_hi) return rosItem.question_hi;
  if (language.startsWith('ta') && rosItem.question_ta) return rosItem.question_ta;
  return rosItem.question;
}

// History sections
const HISTORY_SECTIONS = {
  past_medical_history: {
    en: 'Do you have any long-term illnesses, like diabetes, high blood pressure, asthma, or thyroid problems?',
    hi: 'क्या आपको कोई पुरानी बीमारी है, जैसे शुगर (डायबिटीज), बीपी, दमा (अस्थमा) या थायरॉयड?',
    ta: 'உங்களுக்கு சர்க்கரை நோய் (நீரிழிவு), ரத்த அழுத்தம், ஆஸ்துமா அல்லது தைராய்டு போன்ற நாள்பட்ட நோய்கள் உள்ளதா?',
  },
  past_surgical_history: {
    en: 'Have you had any surgeries in the past? If so, what and when?',
    hi: 'क्या आपकी पहले कभी कोई सर्जरी या ऑपरेशन हुआ है? यदि हाँ, तो कब और किस चीज़ का?',
    ta: 'உங்களுக்கு முன்பு ஏதேனும் அறுவை சிகிச்சை செய்யப்பட்டுள்ளதா? ஆம் என்றால், எப்போது, என்ன சிகிச்சை?',
  },
  drug_allergy_history: {
    en: 'Are you currently taking any medications? Do you have any known drug allergies?',
    hi: 'क्या आप वर्तमान में कोई नियमित दवा ले रहे हैं? क्या किसी दवा से कोई एलर्जी है?',
    ta: 'நீங்கள் தற்போது ஏதேனும் மருந்துகள் உட்கொள்கிறீர்களா? உங்களுக்கு மருந்து ஒவ்வாமை (allergy) உள்ளதா?',
  },
  family_history: {
    en: 'Does anyone in your immediate family have any major illnesses, like heart disease, diabetes, or cancer?',
    hi: 'क्या आपके परिवार में किसी को दिल की बीमारी, शुगर या कैंसर जैसी कोई गंभीर बीमारी है?',
    ta: 'உங்கள் குடும்பத்தில் யாருக்காவது இதய நோய், நீரிழிவு அல்லது புற்றுநோய் போன்ற நோய்கள் உள்ளதா?',
  },
  personal_history: {
    en: 'Could you tell me about your diet, and whether you smoke or drink alcohol?',
    hi: 'आपकी खान-पान की आदतें कैसी हैं, और क्या आप धूम्रपान या शराब का सेवन करते हैं?',
    ta: 'உங்கள் உணவுப் பழக்கம் மற்றும் புகைபிடித்தல் அல்லது மது அருந்தும் பழக்கம் உள்ளதா?',
  },
};

function getHistorySectionPrompt(sectionKey, language = 'en') {
  const sec = HISTORY_SECTIONS[sectionKey];
  if (!sec) return 'Could you please provide information for this section?';
  if (language.startsWith('hi') && sec.hi) return sec.hi;
  if (language.startsWith('ta') && sec.ta) return sec.ta;
  return sec.en;
}

function getGeneralMedicineInitialQuestion(language = 'en') {
  if (language.startsWith('hi')) return GENERAL_MEDICINE_INITIAL.hi;
  if (language.startsWith('ta')) return GENERAL_MEDICINE_INITIAL.ta;
  return GENERAL_MEDICINE_INITIAL.en;
}

// AYUSH OPD - Natural Patient Intake Questions across 10 Clinical Domains
const AYUSH_INTAKE_QUESTIONS = [
  {
    field: 'current_symptoms',
    ayushField: 'vikriti',
    domainLabel: 'Current Symptoms & Changes',
    prompt: 'What current symptoms or recent physical changes have you been experiencing?',
    prompt_hi: 'हाल ही में आप किस तरह की शारीरिक परेशानी या बदलाव महसूस कर रहे हैं?',
    prompt_ta: 'சமீபத்தில் உங்களுக்கு என்ன விதமான உடல் உபாதைகள் அல்லது மாற்றங்கள் ஏற்படுகின்றன?',
    options: ['Body ache & joint pain', 'Weakness & fatigue', 'Digestive discomfort', 'Cough / cold / fever', 'Skin irritation / rash', 'Other symptom'],
    category: 'symptoms',
  },
  {
    field: 'hunger_digestion',
    ayushField: 'agni',
    domainLabel: 'Hunger & Digestion',
    prompt: 'How is your hunger and digestion? Do you experience frequent gas, acidity, bloating, or heaviness after meals?',
    prompt_hi: 'आपकी भूख और पाचन कैसा रहता है? क्या खाने के बाद गैस, एसिडिटी, पेट फूलना या भारीपन रहता है?',
    prompt_ta: 'உங்கள் பசி மற்றும் செரிமானம் எப்படி உள்ளது? சாப்பிட்ட பிறகு வாயு, அசிடிட்டி, வயிறு உப்புசம் அல்லது பாரம் ஏற்படுகிறதா?',
    options: ['Good appetite & smooth digestion', 'Irregular appetite with gas/bloating', 'Frequent burning acidity & sharp hunger', 'Low appetite & heaviness after food'],
    category: 'digestion',
  },
  {
    field: 'bowel_habits',
    ayushField: 'koshtha',
    domainLabel: 'Stool & Bowel Habits',
    prompt: 'How are your daily bowel movements and stool habits?',
    prompt_hi: 'आपका पेट रोज़ाना कैसे साफ होता है और शौच की क्या स्थिति रहती है?',
    prompt_ta: 'தினசரி மலம் கழிக்கும் பழக்கம் எப்படி உள்ளது?',
    options: ['Regular, smooth & easy (once daily)', 'Hard, dry stools / constipation tendency', 'Frequent loose stools / sensitive stomach', 'Irregular / varies day to day'],
    category: 'bowel',
  },
  {
    field: 'body_nature',
    ayushField: 'prakriti',
    domainLabel: 'Body Nature & Temperature',
    prompt: 'How does your body naturally feel regarding temperature and skin? Do you usually feel more sensitive to cold or heat?',
    prompt_hi: 'आपकी शारीरिक प्रकृति कैसी है? क्या आपको ठंड ज्यादा लगती है या गर्मी? त्वचा कैसी रहती है?',
    prompt_ta: 'உங்கள் உடலின் இயல்பு எப்படி? குளிர் அதிகம் உணர்கிறீர்களா அல்லது வெப்பமா? சருமம் எப்படி?',
    options: ['Sensitive to cold, naturally dry skin', 'Sensitive to heat, warm body & sweaty', 'Comfortable with both, smooth skin', 'Skin feels oily or cool to touch'],
    category: 'constitution',
  },
  {
    field: 'food_habits',
    ayushField: 'satmya',
    domainLabel: 'Food & Eating Habits',
    prompt: 'What are your usual eating habits and food preferences? Are there any foods that do not suit you?',
    prompt_hi: 'आपका खान-पान कैसा है? आपको किस तरह का भोजन पसंद है और क्या कोई चीज़ सूट नहीं करती?',
    prompt_ta: 'உங்கள் உணவுப் பழக்கம் மற்றும் விருப்பமான சுவைகள் எவை? உங்களுக்கு ஒவ்வாத உணவு எது?',
    options: ['Regular home-cooked vegetarian food', 'Non-vegetarian diet regularly', 'Prefer warm, fresh & mild food', 'Crave spicy, sour or fried food', 'Certain foods cause gas or allergy'],
    category: 'diet',
  },
  {
    field: 'sleep_routine',
    ayushField: 'nidra',
    domainLabel: 'Sleep & Daily Routine',
    prompt: 'How is your sleep and daily routine? Do you wake up refreshed or feel tired in the morning?',
    prompt_hi: 'आपकी नींद और दैनिक दिनचर्या कैसी है? क्या सुबह उठकर ताजगी महसूस होती है या थकान?',
    prompt_ta: 'உங்கள் தூக்கம் மற்றும் அன்றாட வழக்கம் எப்படி? காலையில் புத்துணர்ச்சியாக உணர்கிறீர்களா அல்லது சோர்வா?',
    options: ['Deep, sound sleep (7-8 hours)', 'Disturbed or light sleep, wake up tired', 'Difficulty falling asleep / racing mind', 'Excessive sleepiness / daytime lethargy'],
    category: 'sleep',
  },
  {
    field: 'exercise_strength',
    ayushField: 'vyayama_shakti',
    domainLabel: 'Exercise & Physical Strength',
    prompt: 'How is your physical strength and daily exercise activity? How quickly do you get tired?',
    prompt_hi: 'आपकी शारीरिक ताकत और व्यायाम की क्षमता कैसी है? क्या जल्दी थकान होती है?',
    prompt_ta: 'உங்கள் உடல் வலிமை மற்றும் உடற்பயிற்சி திறன் எப்படி? சீக்கிரம் சோர்வடைகிறீர்களா?',
    options: ['Good stamina, exercise regularly', 'Moderate strength, normal daily work', 'Get fatigued quickly with light effort', 'Sedentary, minimal physical activity'],
    category: 'strength',
  },
  {
    field: 'stress_emotions',
    ayushField: 'sattva',
    domainLabel: 'Stress, Emotions & Mind',
    prompt: 'How do you handle stress, emotions, and concentration in daily life?',
    prompt_hi: 'दैनिक जीवन में तनाव, गुस्सा और ध्यान केंद्रित करने की स्थिति कैसी रहती है?',
    prompt_ta: 'அன்றாட வாழ்வில் மன அழுத்தம், உணர்ச்சிகள் மற்றும் கவனக் குவிப்பு எப்படி?',
    options: ['Calm, patient & emotionally stable', 'Prone to worry, anxiety or restlessness', 'Get irritable or angry easily under stress', 'Tend to feel low, unmotivated or dull'],
    category: 'mind',
  },
  {
    field: 'body_build',
    ayushField: 'samhanana',
    domainLabel: 'Body Build & Weight Frame',
    prompt: 'How would you describe your overall body build and frame?',
    prompt_hi: 'आपकी शारीरिक बनावट और कद-काठी कैसी है?',
    prompt_ta: 'உங்கள் உடல் அமைப்பு மற்றும் கட்டமைப்பு எப்படி?',
    options: ['Slender / lean frame (hard to gain weight)', 'Medium build with balanced weight', 'Broad / heavy frame (gain weight easily)', 'Frequent weight fluctuations'],
    category: 'build',
  },
  {
    field: 'lifestyle_habits',
    ayushField: 'vihara',
    domainLabel: 'Lifestyle & Daily Habits',
    prompt: 'Could you tell us about your daily lifestyle, water intake, and habits like tea, coffee, smoking, or alcohol?',
    prompt_hi: 'आपकी दिनचर्या, पानी पीने की मात्रा और चाय/कॉफ़ी या अन्य आदतें कैसी हैं?',
    prompt_ta: 'உங்கள் நீர் அருந்தும் அளவு, தேநீர்/காபி மற்றும் பிற பழக்கவழக்கங்கள் எவை?',
    options: ['Good hydration (2-3L water daily)', 'Drink frequent tea/coffee', 'Irregular meal timings / late nights', 'No smoking or alcohol', 'Occasional/regular alcohol or tobacco'],
    category: 'lifestyle',
  },
  {
    field: 'general_medical_history',
    ayushField: 'past_medical_history',
    domainLabel: 'Medical History & Allergies',
    prompt: 'Do you have any long-term medical conditions (like diabetes or BP), past surgeries, or allergies to medicines or food?',
    prompt_hi: 'क्या आपको कोई पुरानी बीमारी (जैसे शुगर, बीपी), पिछली सर्जरी या दवाओं से कोई एलर्जी है?',
    prompt_ta: 'உங்களுக்கு நாள்பட்ட நோய் (சர்க்கரை, ரத்த அழுத்தம்), அறுவை சிகிச்சை அல்லது மருந்து ஒவ்வாமை உள்ளதா?',
    options: ['No major past illnesses or allergies', 'Diabetes / High Blood Pressure / Thyroid', 'Past surgery', 'Known drug or food allergy'],
    category: 'medical_history',
  },
];

function getAyushQuestionPrompt(question, language = 'en') {
  if (language.startsWith('hi') && question.prompt_hi) return question.prompt_hi;
  if (language.startsWith('ta') && question.prompt_ta) return question.prompt_ta;
  return question.prompt;
}

// Quick chips for General Medicine intake
const GENERAL_MEDICINE_QUICK_CHIPS = [
  { en: "Severe headache since 2 days", hi: "2 दिनों से तेज सिरदर्द", ta: "2 நாட்களாக கடுமையான தலைவலி" },
  { en: "High fever with chills", hi: "ठंड के साथ तेज बुखार", ta: "குளிருடன் கூடிய அதிக காய்ச்சல்" },
  { en: "Chest heaviness and sweating", hi: "सीने में भारीपन और पसीना", ta: "நெஞ்சு பாரம் மற்றும் வியர்வை" },
  { en: "Stomach pain and nausea", hi: "पेट दर्द और जी मिचलाना", ta: "வயிற்று வலி மற்றும் குமட்டல்" },
  { en: "Persistent cough and cold", hi: "लगातार खांसी और जुकाम", ta: "தொடர் இருமல் மற்றும் சளி" },
  { en: "Shortness of breath / difficulty breathing", hi: "सांस लेने में तकलीफ", ta: "மூச்சுத்திணறல் / மூச்சு விடுவதில் சிரமம்" },
  { en: "Body ache and extreme fatigue", hi: "बदन दर्द और अत्यधिक थकान", ta: "உடல் வலி மற்றும் அதிக சோர்வு" },
  { en: "Pain is mild to moderate (4-5/10)", hi: "दर्द हल्का से मध्यम है (4-5/10)", ta: "வலி மிதமானது (4-5/10)" },
  { en: "Pain is very severe (8-9/10)", hi: "दर्द बहुत तेज है (8-9/10)", ta: "வலி மிகவும் தீவிரமானது (8-9/10)" },
  { en: "Started suddenly today", hi: "आज अचानक शुरू हुआ", ta: "இன்று திடீரென தொடங்கியது" },
  { en: "No other previous illnesses", hi: "कोई पुरानी बीमारी नहीं है", ta: "முந்தைய பிற நோய்கள் எதுவும் இல்லை" },
  { en: "No known drug allergies", hi: "दवाओं से कोई एलर्जी नहीं", ta: "மருந்து ஒவ்வாமை எதுவும் இல்லை" },
];

module.exports = {
  GENERAL_MEDICINE_INITIAL,
  SOCRATES_TEMPLATES_EN,
  SOCRATES_TEMPLATES_HI,
  SOCRATES_TEMPLATES_TA,
  COMPLAINT_FLOWS,
  detectComplaintCategory,
  getHpiFieldOrder,
  getHpiQuestionPrompt,
  ROS_QUESTIONS,
  getRosQuestionPrompt,
  HISTORY_SECTIONS,
  getHistorySectionPrompt,
  getGeneralMedicineInitialQuestion,
  AYUSH_INTAKE_QUESTIONS,
  getAyushQuestionPrompt,
  GENERAL_MEDICINE_QUICK_CHIPS,
};
