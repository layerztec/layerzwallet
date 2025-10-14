import { sanitizeAndValidateMnemonic } from '../../modules/wallet-utils';
import assert from 'assert';
import { test } from 'vitest';

test('sanitizeAndValidateMnemonic should handle complex whitespace scenarios', () => {
  const mnemonic = '\n\n  abandon\t abandon   abandon\r\n abandon abandon  abandon\t\t abandon abandon abandon abandon   abandon ABOUT  \n\n';
  const result = sanitizeAndValidateMnemonic(mnemonic);
  assert.strictEqual(result, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
});

test('sanitizeAndValidateMnemonic should handle double calls', () => {
  const mnemonic = '\n\n  abandon\t abandon   abandon\r\n abandon abandon  abandon\t\t abandon abandon abandon abandon   abandon ABOUT  \n\n';
  const result = sanitizeAndValidateMnemonic(sanitizeAndValidateMnemonic(mnemonic));
  assert.strictEqual(result, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
});

test('sanitizeAndValidateMnemonic should throw error for mnemonic with less than 12 words', () => {
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
  assert.throws(() => {
    sanitizeAndValidateMnemonic(mnemonic);
  }, /Invalid mnemonic length/);
});
