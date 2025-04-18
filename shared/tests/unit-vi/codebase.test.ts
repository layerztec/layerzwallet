import fs from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import assert from 'assert';

describe('codebase', function () {
  /**
   * could not isolate shared vitest config, always some weird errors, so we keep identical copies
   * and just check if the files are the same
   */
  it('vitest config files are the same', async function () {
    const extVitestConfig = fs.readFileSync(resolve(__dirname, '../../../ext/vitest.config.mts'), 'utf8');
    const mobileVitestConfig = fs.readFileSync(resolve(__dirname, '../../../mobile/vitest.config.mts'), 'utf8');

    assert.strictEqual(extVitestConfig, mobileVitestConfig);
  });

  it('prettier config files are the same', async function () {
    const extPrettierConfig = fs.readFileSync(resolve(__dirname, '../../../ext/.prettierrc'), 'utf8');
    const mobilePrettierConfig = fs.readFileSync(resolve(__dirname, '../../../mobile/.prettierrc'), 'utf8');
    const sharedPrettierConfig = fs.readFileSync(resolve(__dirname, '../../../shared/.prettierrc'), 'utf8');

    assert.strictEqual(extPrettierConfig, mobilePrettierConfig);
    assert.strictEqual(extPrettierConfig, sharedPrettierConfig);
  });
});
