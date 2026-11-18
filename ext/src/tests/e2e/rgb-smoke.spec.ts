import { expect, test } from './fixtures';
import { helperImportWallet } from './helpers';

// Smoke for the RGB_L1 web engine (rgb-sdk-web / rgb-lib-wasm): the wallet
// must open and sync. Talks to UTEXO's public
// signet, so it only proves the engine boots inside the extension.
test('rgb testnet wallet opens and syncs on the L1 web engine', async ({ page, extensionId }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await helperImportWallet(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(async () => {
    const stored = (await chrome.storage.local.get('STORAGE_KEY_SETTINGS')).STORAGE_KEY_SETTINGS;
    const settings = { ...(stored ? JSON.parse(stored) : {}), showTestnets: 'ON' };
    await chrome.storage.local.set({ STORAGE_KEY_SETTINGS: JSON.stringify(settings), STORAGE_SELECTED_NETWORK: 'rgb_testnet' });
  });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.locator('body')).toContainText('tBTC', { timeout: 60_000 });
  // The balance row renders "0 tBTC"-style text only once the engine has
  // opened and synced; an engine failure surfaces as an error line instead.
  await page.waitForTimeout(20_000);
  const body = await page.locator('body').innerText();
  console.log('rgb smoke body:', JSON.stringify(body.slice(0, 600)), 'errors:', JSON.stringify(errors.slice(0, 8)));
  expect(errors.filter((e) => /rgb|wasm|RgbLib/i.test(e))).toEqual([]);
});
