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
