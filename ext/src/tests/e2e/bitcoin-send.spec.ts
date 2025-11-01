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
    '0200000000010102251320e93e39975fda3d7a1d4d3f8e076a37df7243c2502ba539359ada12a5000000000000000080021027000000000000160014337160bfad09c676dba5dc9f1224e6cbf3c841e31a48000000000000160014f12242f1c87064bfdda3b87461e19b2d6b3a780d0247304402201a29e782d71f6aee132836d1f92b41e7ddfe4e117261121c3d2ed6a2f98f85650220087fcd44b61d672bbb231d9ea0f52b6798e9ca9032c85389948b1a72c29330ae012102765dba02ffc8e1cbf88afd45028cd4fc47d6e96002db0b46293a36242aedec4300000000'
  );
});
