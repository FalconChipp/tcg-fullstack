import { generateProofCode, moderateProofImage } from '../src/modules/marketplace/helpers.js';
import fs from 'fs';

jest.mock('nsfwjs', () => ({
  load: jest.fn().mockResolvedValue({ classify: jest.fn().mockResolvedValue([{ className: 'Neutral', probability: 0.9 }]) })
}), { virtual: true });
jest.mock('tesseract.js', () => ({
  createWorker: () => ({
    loadLanguage: jest.fn(),
    initialize: jest.fn(),
    recognize: jest.fn().mockResolvedValue({ data: { text: 'ABC123' } }),
    terminate: jest.fn()
  })
}), { virtual: true });

test('generateProofCode length', () => {
  const code = generateProofCode();
  expect(code).toHaveLength(6);
});

test('moderateProofImage returns true when text matches', async () => {
  const path = 'temp.jpg';
  fs.writeFileSync(path, 'dummy');
  const result = await moderateProofImage(path, 'ABC123');
  fs.unlinkSync(path);
  expect(result).toBe(true);
});
