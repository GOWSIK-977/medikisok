/**
 * Real Claude integration - STUB. Same interface as mockProvider.js.
 * Fill in the TODO, add ANTHROPIC_API_KEY to .env, set LLM_PROVIDER=anthropic.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  });
  if (!response.ok) throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

async function generateSummaryText({ clinicalHistory, documents }) {
  // TODO: prompt Claude with the merged clinicalHistory + documents objects
  // and ask for a concise physician-facing paragraph. e.g.:
  //
  // const text = await callClaude(
  //   'You write concise, physician-facing clinical summaries from structured intake data. Plain prose, no diagnosis, flag abnormal findings clearly.',
  //   `Clinical history: ${JSON.stringify(clinicalHistory)}\nDocuments: ${JSON.stringify(documents)}`
  // );
  // return { summaryText: text };
  throw new Error('anthropicProvider.generateSummaryText is not implemented yet - see TODO.');
}

module.exports = { generateSummaryText };
