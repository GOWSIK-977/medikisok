// Test harness - simulates the demo scenario end-to-end using only the pure
// logic modules (no express/uuid/dotenv needed, so it runs in any plain node).
process.env.LLM_PROVIDER = 'mock';

const stateMachine = require('./src/dialogue/stateMachine');

function makeSession() {
  return {
    id: 'test-session-1',
    currentSection: 'chief_complaint',
    complaintCategory: null,
    hpiFieldOrder: [],
    hpiFieldIndex: 0,
    rosIndex: 0,
    transcript: [],
    schema: {
      patient: { name: 'Ramesh Kumar', age: 52, gender: 'male', preferred_language: 'hi' },
      chief_complaint: { text: '', text_en: '', duration: '' },
      hpi: {},
      review_of_systems: {},
      red_flags: [],
      meta: { generated_at: null, status: 'draft' },
    },
  };
}

// Scripted answers matching the demo scenario: 52M, chest pain 3 days,
// breathlessness + sweating, diabetes + hypertension.
const scriptedAnswers = [
  'I have chest pain',                       // chief complaint
  'It started 3 days ago',                   // onset
  'In the center of my chest',                // location
  'A heavy, pressing feeling',                // character
  'Yes, it goes to my left arm',              // radiation
  'I feel breathless and I am sweating a lot',// associated_symptoms
  'It gets worse when I walk',                // exacerbating
  'Resting helps a little',                   // relieving
  '7',                                        // severity
  'No',                                       // ROS cardiovascular
  'No',                                       // ROS respiratory
  'No',                                       // ROS gastrointestinal
  'No',                                       // ROS genitourinary
  'No',                                       // ROS neurological
  'No',                                       // ROS musculoskeletal
  'No, just tired',                           // ROS general
  'Yes, I have diabetes and high blood pressure', // past medical history
  'No surgeries',                             // past surgical history
  'I take metformin, no known allergies',     // drug/allergy
  'My father had a heart attack',             // family history
  'Vegetarian, I do not smoke, I have never drunk alcohol', // personal history
];

async function run() {
  let question = stateMachine.firstQuestion();
  const session = makeSession();
  let step = 0;

  console.log('=== Starting interview ===\n');

  while (question && step < scriptedAnswers.length) {
    const answer = scriptedAnswers[step];
    console.log(`Q [${question.section}/${question.field}]: ${question.prompt}`);
    console.log(`A: ${answer}\n`);

    const result = await stateMachine.submitAnswer(session, question, answer);

    if (result.redFlags.length > 0) {
      console.log('🚨 RED FLAG TRIGGERED:', JSON.stringify(result.redFlags, null, 2), '\n');
    }

    question = result.nextQuestion;
    step += 1;
  }

  console.log('=== Interview complete ===\n');
  console.log('Final structured schema:\n');
  console.log(JSON.stringify(session.schema, null, 2));
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
