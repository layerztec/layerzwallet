import { expect, test } from './fixtures';
import { helperImportWallet } from './helpers';

test('can prepare BTC transaction', async ({ page, extensionId }) => {
  test.skip(!process.env.TEST_MNEMONIC, 'skipped because TEST_MNEMONIC env var is not set');

  await helperImportWallet(page, extensionId, process.env.TEST_MNEMONIC);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  // await page.getByText(/Rootstock/).click();
  await page.getByText(/Send/).click();
  await expect(page).toHaveURL(new RegExp(`${extensionId}/popup.html#/send-btc`));

  // Test if we have any funds
  await expect(page.getByText(/Available balance: 0 BTC/)).toBeHidden();

  await page.getByTestId('recipient-address-input').fill('bc1qxdckp0adp8r8dka9mj03yf8xe0euss0ry3mq7a');
  await page.getByTestId('amount-input').fill('0.0001');

  // Test high custom fee first
  await page.getByTestId('change-fee-button').click();
  await page.getByTestId('custom-fee-input').fill('200');
  await page.getByTestId('fee-done-button').click();

  // Switch to medium fee
  await page.getByTestId('change-fee-button').click();
  await page.getByTestId('fee-standard-radio').click();
  await page.getByTestId('fee-done-button').click();

  // Finally set to 1 sat/vbyte using custom
  await page.getByTestId('change-fee-button').click();
  await page.getByTestId('custom-fee-input').fill('1');
  await page.getByTestId('fee-done-button').click();

  await page.getByTestId('send-screen-send-button').click();
  await page.getByTestId('password-provider-input2').fill('wrong'); // wrong password
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveText(/Incorrect password/, { timeout: 10000 });

  await page.getByTestId('password-provider-input2').fill('qwerty'); // correct password
  await page.getByTestId('unlock-wallet-button').click();

  // wait for tx to be prepared
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // tap 3 times on "clipboard-backdoor"
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByTestId('clipboard-backdoor').click();
  await page.getByTestId('clipboard-backdoor').click();
  await page.getByTestId('clipboard-backdoor').click();

  const txhex = await page.evaluate(() => navigator.clipboard.readText());
  expect(txhex).toEqual(
    '02000000000101374d7f22707d09a181203ac38993586570593ed48013956757a9e5fe2997e079010000000000000080021027000000000000160014337160bfad09c676dba5dc9f1224e6cbf3c841e' +
      '37820000000000000160014c6b08fda6aa787cdda542ea0823d7819ec334f910247304402205873e09ee5a939c5070b576965bc3db71b97c89f770ec48cd9d14337f8a403c402207b9c6e4a4ced44682a2066c009c561b' +
      '7d6927bb7876b721738c9136bc08d5625012103f02e210ad6d55ae142ec7ba190e3c21874c0a60eb245280566b873657950bea800000000'
  );
});
