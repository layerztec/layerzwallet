import { expect, test } from './fixtures';
import { helperImportWallet } from './helpers';

test('can prepare BTC transaction', async ({ page, extensionId }) => {
  test.skip(!process.env.TEST_MNEMONIC, 'skipped because TEST_MNEMONIC env var is not set');

  await helperImportWallet(page, extensionId, process.env.TEST_MNEMONIC);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  // await page.getByText(/Rootstock/).click();
  await page.getByText(/Send/).click();
  await expect(page).toHaveURL(new RegExp(`${extensionId}/popup.html#/send-btc`));

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
  await page.getByTestId('password-provider-input').fill('qwerty');
  await page.getByText(/OK/).click();

  // wait for tx to be prepared
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // tap 3 times on "clipboard-backdoor"
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByTestId('clipboard-backdoor').click();
  await page.getByTestId('clipboard-backdoor').click();
  await page.getByTestId('clipboard-backdoor').click();

  const txhex = await page.evaluate(() => navigator.clipboard.readText());
  expect(txhex).toEqual(
    '02000000000101dde5dc7aeff35833c8ab820e0252d7e634c1e7e1a082e652991b0bbe76827c7b010000000000000080021027000000000000160014337160bfad09c676dba5dc9f1224e6cbf3c841e38e4d000000000000160014f12242f1c87064bfdda3b87461e19b2d6b3a780d024730440220235a8d87eb6d8728dd4a6c6ff340d7a6474fa636f2a0f7c13569b498af786dfa02203d23459396112d4e5584dc3f1d0c854cfa6ba25983a864c6253e942052be7d6b01210288c6fff2d453f7c54785a2bf652b3b70571ebc1dd539ba9aa8031cca0b18abe600000000'
  );
});
