// src/modules/marketplace/helpers.js
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Lazy imports for heavy libraries
let nsfwModel = null;

/**
 * Generate a random alphanumeric proof code
 * @param {number} length
 * @returns {string}
 */
export function generateProofCode(length = 6) {
  return crypto
    .randomBytes(length)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, length)
    .toUpperCase();
}

/**
 * Load nsfwjs model lazily
 */
async function getNsfwModel() {
  if (nsfwModel) return nsfwModel;
  const nsfwjs = await import('nsfwjs');
  const tf = await import('@tensorflow/tfjs-node');
  nsfwModel = await nsfwjs.load();
  return nsfwModel;
}

/**
 * Run NSFW and OCR checks on a proof image
 * @param {string} imagePath
 * @param {string} code
 * @param {object} opts
 * @returns {Promise<boolean>} true if passes moderation
 */
export async function moderateProofImage(imagePath, code, opts = {}) {
  const { nsfwThreshold = 0.7 } = opts;
  const model = await getNsfwModel();
  const image = await import('canvas').then(mod => mod.loadImage(imagePath));
  const predictions = await model.classify(image);
  const porn = predictions.find(p => p.className === 'Porn');
  if (porn && porn.probability > nsfwThreshold) {
    return false;
  }
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();
  if (!data.text || !data.text.toUpperCase().includes(code.toUpperCase())) {
    return false;
  }
  return true;
}

/**
 * Save base64 image string to disk
 * @param {string} base64
 * @param {string} dir
 * @returns {string} file path
 */
export function saveBase64Image(base64, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}
