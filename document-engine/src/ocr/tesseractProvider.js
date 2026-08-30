/**
 * Real OCR via tesseract.js. Requires `npm install tesseract.js` (it's an
 * optionalDependency so a plain `npm install` won't fail without it).
 *
 * NOT exercised in this sandbox (npm registry is blocked here) - test this
 * path yourself once installed, on a real printed document photo, before
 * relying on it for the demo. If OCR quality is inconsistent close to demo
 * day, fall back to OCR_PROVIDER=mock rather than risk a live failure.
 */

let Tesseract;
try {
  // Lazy require so the app doesn't crash if tesseract.js isn't installed
  // and OCR_PROVIDER is still set to "mock".
  Tesseract = require('tesseract.js');
} catch (e) {
  Tesseract = null;
}

async function recognize({ imageBase64 }) {
  if (!Tesseract) {
    throw new Error('tesseract.js is not installed. Run `npm install tesseract.js`, or set OCR_PROVIDER=mock in .env.');
  }
  if (!imageBase64) {
    throw new Error('imageBase64 is required for the tesseract provider.');
  }

  const buffer = Buffer.from(imageBase64, 'base64');
  const { data } = await Tesseract.recognize(buffer, 'eng'); // add more language codes as needed, e.g. 'eng+hin'
  return { rawText: data.text };
}

module.exports = { recognize };
