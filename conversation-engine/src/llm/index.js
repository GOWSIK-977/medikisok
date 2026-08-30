/**
 * LLM provider interface.
 *
 * Every provider (mock, anthropic, openai, ...) must implement these three
 * async methods with this exact signature. Nothing outside this folder
 * should ever know which provider is active - the state machine and routes
 * only ever call `llm.extractStructuredAnswer(...)`, `llm.rephraseQuestion(...)`,
 * and `llm.detectRedFlag(...)`.
 *
 * To go live with a real model: implement src/llm/anthropicProvider.js fully,
 * then set LLM_PROVIDER=anthropic in .env. No other file needs to change.
 */

const mockProvider = require('./mockProvider');
const anthropicProvider = require('./anthropicProvider');
const geminiProvider = require('./geminiProvider');

const PROVIDER = (process.env.LLM_PROVIDER || 'mock').toLowerCase();

const providers = {
  mock: mockProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
};

if (!providers[PROVIDER]) {
  throw new Error(`Unknown LLM_PROVIDER "${PROVIDER}". Valid options: ${Object.keys(providers).join(', ')}`);
}

console.log(`[llm] using provider: ${PROVIDER}`);

module.exports = providers[PROVIDER];
