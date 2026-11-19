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

// The backup file is the only RGB recovery path while there is no cloud
// backup: export it, feed it back, and the wallet must still open. A file that
// is not a backup must be refused without losing the current state.
test('rgb backup file exports and imports back', async ({ page, extensionId }) => {
  await helperImportWallet(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(async () => {
    const stored = (await chrome.storage.local.get('STORAGE_KEY_SETTINGS')).STORAGE_KEY_SETTINGS;
    const settings = { ...(stored ? JSON.parse(stored) : {}), showTestnets: 'ON' };
    await chrome.storage.local.set({ STORAGE_KEY_SETTINGS: JSON.stringify(settings), STORAGE_SELECTED_NETWORK: 'rgb_testnet' });
  });
  await page.goto(`chrome-extension://${extensionId}/popup.html#/settings`);

  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.getByTestId('export-rgb-backup').click()]);
  const backupPath = await download.path();
  expect(download.suggestedFilename()).toBe('layerz-rgb-testnet.rgbbackup');

  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.accept();
  });

  await page.getByTestId('import-rgb-backup-input').setInputFiles({ name: 'junk.rgbbackup', mimeType: 'application/octet-stream', buffer: Buffer.from('not a backup') });
  await expect.poll(() => dialogs.some((m) => m.includes('import failed, previous state kept')), { timeout: 90_000 }).toBe(true);

  await page.goto(`chrome-extension://${extensionId}/popup.html#/settings`);
  await page.getByTestId('import-rgb-backup-input').setInputFiles(backupPath);
  await expect.poll(() => dialogs.some((m) => m === 'RGB backup restored.'), { timeout: 90_000 }).toBe(true);

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('body')).toContainText('tBTC', { timeout: 60_000 });
});

// KNOWN UPSTREAM BUG (rgb-sdk-web beta.13 and beta.14, rgb-lib-wasm beta.4):
// syncing a wallet whose state was loaded rather than freshly created — a
// reopen from IndexedDB, or a restoreBackup() — can kill the renderer
// (SIGTRAP, no JS error). Probabilistic: roughly one reopen in ten on an empty
// wallet, nearly every reopen on a wallet with on-chain history. In the
// extension a reopen is every popup open after the first one.
// Un-fixme on each SDK bump; it must pass before RGB ships in the extension.
test.fixme('rgb wallet survives being reopened', async ({ page, extensionId }) => {
  test.setTimeout(240_000);
  await helperImportWallet(page, extensionId);
  let crashed = false;
  page.on('crash', () => (crashed = true));
  const run = page.evaluate(async () => {
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    for (let i = 0; i < 10; i++) {
      const wallet = await globalThis.rgbAdapter.createWallet({ mnemonic, network: 'testnet' });
      await wallet.syncWallet();
      await wallet.dispose();
    }
  });
  await Promise.race([run.catch(() => {}), page.waitForEvent('crash').catch(() => {})]);
  expect(crashed).toBe(false);
});
