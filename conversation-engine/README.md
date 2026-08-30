# MediKiosk — Module A: Conversational Clinical History Engine
### (Person 1's component — SIH26047 / MediKiosk)

Adaptive voice/touch clinical history intake. Asks SOCRATES-style follow-up
questions branching on the patient's chief complaint, detects emergency
red-flag symptom patterns, and outputs structured JSON matching the team's
shared clinical summary schema.

## Why it's built this way

- **Flow control is deterministic, not LLM-driven.** Which question comes
  next is decided by a rule-based state machine (`src/dialogue/`). The LLM
  is only ever used for two narrow jobs: turning a patient's free-text
  answer into a clean structured value, and phrasing/translating a question
  naturally. This is what keeps a live demo from going off-script.
- **The LLM is fully swappable.** Everything calls `src/llm/index.js`,
  which picks a provider based on `LLM_PROVIDER` in `.env`. Right now that's
  `mockProvider.js` (deterministic, no API key needed). To go live, finish
  the TODOs in `anthropicProvider.js` and flip the env var — nothing else in
  the codebase changes.

## Running it

```bash
npm install
cp .env.example .env
npm start
# -> MediKiosk conversation engine listening on port 4000
```

No API key needed by default (`LLM_PROVIDER=mock`).

### Quick logic test (no server, no dependencies beyond what's installed)

```bash
node test-flow.js
```

Runs the team's agreed demo scenario (52M, chest pain 3 days, breathless +
sweating, diabetes + hypertension) straight through the state machine and
prints the final structured JSON, including the red-flag trigger. Good
smoke test after any change to the question bank or red-flag rules.

## API

### `POST /api/session/start`
```json
// request
{ "name": "Ramesh Kumar", "age": 52, "gender": "male", "language": "hi" }

// response
{
  "sessionId": "uuid",
  "question": { "section": "chief_complaint", "field": "text", "prompt": "What is the main problem that brought you in today?" }
}
```

### `POST /api/session/:id/answer`
```json
// request
{ "answerText": "I have chest pain" }

// response
{
  "nextQuestion": { "section": "hpi", "field": "onset", "prompt": "When did this start?" },
  "redFlags": [],
  "sessionComplete": false
}
```

When a red flag newly triggers, `redFlags` is non-empty **only on the turn
it first fires** (not repeated on every subsequent answer) — this is what
Person 3's frontend should watch to pop the priority-alert screen.

### `GET /api/session/:id/summary`
Returns the full structured object in the shared schema shape — hand this
straight to Person 2's summary generator and Person 3's dashboard.

## Extending the question bank

`src/dialogue/questionBank.js` has:
- `COMPLAINT_KEYWORDS` — keyword → complaint category matching
- `COMPLAINT_FLOWS` — which SOCRATES fields to ask, and in what order, per category

Currently covers chest pain, abdominal pain, headache, fever, cough, plus a
generic default. Add a new category by adding one keyword-list entry and one
flow-order entry — no other code changes needed.

## Extending red-flag rules

`src/dialogue/redFlags.js` — add a rule object with `id`, `keywords`,
`minMatches`, `severity`. The mock provider checks these directly; when you
wire up `anthropicProvider.js`, use this same rule list as the basis for the
LLM prompt so behavior stays consistent between mock and real mode.

## What's intentionally NOT built here (by design, per team scope)

- Real ASR/TTS wiring (Bhashini/AI4Bharat) — the API takes `answerText` as
  plain text; slot a speech-to-text call in front of it on the frontend side,
  this module doesn't need to know or care where the text came from.
- AYUSH/Dashavidha Pariksha questioning — architecture supports adding it as
  another complaint-independent section later, same pattern as ROS.
- Multi-language question phrasing — `rephraseQuestion()` in the LLM
  interface is exactly where that plugs in once a real provider is wired up.
