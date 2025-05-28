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
    '02000000000101d31c29292582831fa674b6747fc211e94abb56a7637e2a4b7589df6e9c2d177c010000000000000080021027000000000000160014337160bfad09c676dba5dc9f1224e6cbf3c841e3224a000000000000160014f12242f1c87064bfdda3b87461e19b2d6b3a780d02473044022012ca2322dee5a1e75b49a1f03ece5f658a064eaac2f7c640aa2435cdb0b23e7002201ca91d1a2d951d70a7b38c0b1a09cff2677b4dcd2f261414cf156d3c6ee39dee01210243b2ebd9ffb32cd52ca9ac02655bb140bd3d9fb9406b837e12e233f7768094d500000000'
  );
});
