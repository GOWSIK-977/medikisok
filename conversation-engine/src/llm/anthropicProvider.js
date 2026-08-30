/**
 * Anthropic (Claude) LLM provider - STUB.
 *
 * Same three-method interface as mockProvider.js. Fill in the fetch() calls
 * below, add ANTHROPIC_API_KEY to .env, and set LLM_PROVIDER=anthropic.
 * Nothing else in the codebase needs to change.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env or switch LLM_PROVIDER back to "mock".');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

async function extractStructuredAnswer({ field, question, rawText }) {
  // TODO: prompt Claude to extract a clean structured value for `field`
  // from `rawText`, given it was asked `question`. Ask for JSON-only output
  // and parse it, e.g.:
  //
  // const raw = await callClaude(
  //   'You extract structured clinical fields from patient answers. Respond with JSON only: {"value": "..."}',
  //   `Question asked: "${question}"\nField: "${field}"\nPatient answer: "${rawText}"`
  // );
  // return JSON.parse(raw);

  throw new Error('anthropicProvider.extractStructuredAnswer is not implemented yet - see TODO.');
}

async function rephraseQuestion({ templateQuestion, context }) {
  // TODO: ask Claude to naturally phrase/translate templateQuestion given
  // context (patient language, chief complaint, prior answers).
  throw new Error('anthropicProvider.rephraseQuestion is not implemented yet - see TODO.');
}

async function detectRedFlag({ transcript, context }) {
  // TODO: ask Claude to review the transcript for emergency symptom patterns
  // and return an array of { flag, severity, triggered_by } objects.
  throw new Error('anthropicProvider.detectRedFlag is not implemented yet - see TODO.');
}

module.exports = { extractStructuredAnswer, rephraseQuestion, detectRedFlag };
