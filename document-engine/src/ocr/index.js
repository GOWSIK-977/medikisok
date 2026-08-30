/**
 * OCR provider interface. Both providers implement:
 *   async recognize({ documentType, imageBase64 }) -> { rawText }
 *
 * Nothing outside this folder should know which one is active.
 * To go live: `npm install tesseract.js`, set OCR_PROVIDER=tesseract in .env.
 */

const mockOcrProvider = require('./mockOcrProvider');
const tesseractProvider = require('./tesseractProvider');

const PROVIDER = (process.env.OCR_PROVIDER || 'mock').toLowerCase();

const providers = {
  mock: mockOcrProvider,
  tesseract: tesseractProvider,
};

if (!providers[PROVIDER]) {
  throw new Error(`Unknown OCR_PROVIDER "${PROVIDER}". Valid options: ${Object.keys(providers).join(', ')}`);
}

console.log(`[ocr] using provider: ${PROVIDER}`);

module.exports = providers[PROVIDER];
