import assert from 'assert';
import { expect, test } from './fixtures';
import {
  assertHome,
  assertOnboardingAcceptTermsOfService,
  assertOnboardingChoosePassword,
  assertOnboardingImport,
  assertOnboardingWelcome,
  fillOnboardingChoosePassword,
  fillOnboardingImport,
  getPopupPage,
  helperImportWallet,
  sleep,
} from './helpers';
import BigNumber from 'bignumber.js';

test('receive address on receive screen is correct', async ({ page, extensionId }) => {
  await helperImportWallet(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByText(/Rootstock/).click();
  await page.getByText(/Receive/).click();
  await expect(page).toHaveURL(new RegExp(`${extensionId}/popup.html#/receive`));

  const firstPart = '0x9858';
  const middlePart = 'EfFD232B4033E47d90003D41EC34Ec';
  const lastPart = 'aEda94';

  // Check that each part of the address is displayed on the page
  await expect(page.locator('body')).toContainText(firstPart, { timeout: 33000 });
  await expect(page.locator('body')).toContainText(middlePart, { timeout: 33000 });
  await expect(page.locator('body')).toContainText(lastPart, { timeout: 33000 });
});

test('switch account and verify receive address', async ({ page, extensionId }) => {
  await helperImportWallet(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByText(/Rootstock/).click();

  await page.getByTestId('settings-button').click();
  await page.selectOption('select[id="account-select"]', '1'); // Select "Account 1"
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByText(/Receive/).click();
  await expect(page).toHaveURL(new RegExp(`${extensionId}/popup.html#/receive`));

  // await new Promise((resolve) => setTimeout(resolve, 50_000)); // sleep

  // Assuming the receive address changes based on the account
  await expect(page.locator('body')).toContainText('0x6Fac', { timeout: 33000 });
  await expect(page.locator('body')).toContainText('4Ab9C0', { timeout: 33000 });
});

test('can send coins to second account, and verify balance', async ({ page, extensionId }) => {
  test.skip(!process.env.TEST_MNEMONIC, 'skipped because TEST_MNEMONIC env var is not set');

  /**
   * test plan:
   *
   * import test wallet
   * check balance
   * go to settings and switch to account#1
   * check balance and save it for later
   * go to receive screen and copy receive address toclipboard
   * switch account back to account#0
   * go to send screen, paste the receive address, type amount 0.001
   * send!
   * swtich account to account#1
   * check that balance actually increased by 0.001
   */

  await helperImportWallet(page, extensionId, process.env.TEST_MNEMONIC);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Testnet is not visible by default
  await expect(page.getByText(/Sepolia/)).not.toBeVisible();

  // Enabling all testnets
  await page.getByTestId('settings-button').click();
  await page.selectOption('select[id="setting-showTestnets"]', 'ON');
  await page.goto(`chrome-extension://${extensionId}/popup.html`); // Navigate back to home

  await page.getByText(/Sepolia/).click();
  await new Promise((resolve) => setTimeout(resolve, 5_000)); // sleep, waiting for balance to load on screen

  const messagesDiv = await page.locator('[id="home-balance"]');
  let account0balance = await messagesDiv.innerText();
  await expect(+account0balance).toBeGreaterThan(0);

  await page.getByTestId('settings-button').click();
  await page.selectOption('select[id="account-select"]', '1'); // Switch to "Account 1"
  await page.goto(`chrome-extension://${extensionId}/popup.html`); // Navigate back to home
  await new Promise((resolve) => setTimeout(resolve, 5_000)); // sleep, waiting for balance to load on screen
  const newBalanceDiv = await page.locator('[id="home-balance"]');
  let account1balance = await newBalanceDiv.innerText();

  await page.getByText(/Receive/).click();
  await page.getByTestId('copy-to-clipboard').click();

  await page.getByTestId('settings-button').click();
  await page.selectOption('select[id="account-select"]', '0'); // Switch to "Account 0"
  await page.goto(`chrome-extension://${extensionId}/popup.html`); // Navigate back to home
  await page.getByText(/Send/).click();

  await page.getByTestId('amount-input').fill('0.001');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByTestId('recipient-address-input').fill(await page.evaluate(() => navigator.clipboard.readText())); // paste
  await page.getByTestId('send-screen-send-button').click();

  await page.getByTestId('password-provider-input2').fill('wrong'); // wrong password
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveText(/Incorrect password/, { timeout: 10000 });

  await page.getByTestId('password-provider-input2').fill('qwerty'); // correct password
  await page.getByTestId('unlock-wallet-button').click();

  // hodl button:
  const hodlButton = page.locator('text=Hold to confirm send');
  await hodlButton.hover();
  await page.mouse.down();
  await page.waitForTimeout(5000); // Hold for 5 seconds
  await page.mouse.up();

  await expect(page.locator('body')).toHaveText(/Transaction sent successfully/, { timeout: 45000 });
  await new Promise((resolve) => setTimeout(resolve, 30_000)); // waiting for tx to confirm
  //

  await page.getByTestId('settings-button').click();
  await page.selectOption('select[id="account-select"]', '1'); // Switch to "Account 1"
  await page.goto(`chrome-extension://${extensionId}/popup.html`); // Navigate back to home
  await new Promise((resolve) => setTimeout(resolve, 5_000)); // sleep, waiting for balance to load on screen
  const newBalanceDiv2 = await page.locator('[id="home-balance"]');
  let newAccount1balance = await newBalanceDiv2.innerText();
  console.log(`New balance for Account 1: ${newAccount1balance}`);

  const diff = new BigNumber(newAccount1balance).minus(account1balance).toString(10);
  assert.strictEqual(diff, '0.001');
});

test('is discoverable via EIP6963', async ({ page, extensionId }) => {
  await helperImportWallet(page, extensionId);
  await page.goto('https://metamask.github.io/test-dapp/');
  await expect(page.locator('body')).toHaveText(/Use Layerz Wallet/, { timeout: 33000 }); // EIP6963 works!
});

test('open popup and perform a personal sign', async ({ page, extensionId }) => {
  await helperImportWallet(page, extensionId);
  await page.goto('https://metamask.github.io/test-dapp/');
  await page.getByText(/Use Layerz Wallet/).click();
  await page.locator('[id="connectButton"]').click(); // triggering dapp to request permissions
  await sleep(3000); // allow page to actually open

  while ((await getPopupPage(page).title()) === 'Popup') {
    // got multiple popups, need to press Allow in all of them.
    // this is a workaround for the issue with multiple popups. this should be investigated and
    // deduped if multiple same popups triggered legitely

    await getPopupPage(page).getByRole('button', { name: 'Allow' }).click(); // allow connecting to the Dapp
    await sleep(2000); // propagate to main page
  }

  await page.locator('[id="personalSign"]').click();
  await sleep(3000); // allow page to actually open

  await getPopupPage(page).getByRole('button', { name: 'Allow' }).click(); // allow signature
  await getPopupPage(page).getByTestId('password-provider-input').fill('qwerty');
  await getPopupPage(page).getByText(/OK/).click();
  await sleep(9000); // allow it to make a signature and post message back to Dapp

  const spanLocator = page.locator('span[id="personalSignResult"]');
  const spanText = await spanLocator.textContent();
  expect(spanText).toEqual('0xb836ae2bac525ae9d2799928cf6f52919cb2ed5e5e52ca26e3b3cdbeb136ca2f618da0e6413a6aa3aaa722fbc2bcc87f591b8b427ee6915916f257de8125810e1b');
});

test('can switch network', async ({ page, extensionId }) => {
  await helperImportWallet(page, extensionId);
  await page.goto('https://metamask.github.io/test-dapp/');
  await page.getByText(/Use Layerz Wallet/).click();
  await page.locator('[id="connectButton"]').click(); // triggering dapp to request permissions
  await sleep(3000); // allow page to actually open

  await getPopupPage(page).getByRole('button', { name: 'Allow' }).click(); // allow connecting to the Dapp
  await sleep(1000); // propagate to main page

  const spanText = await page.locator('span[id="network"]').textContent();
  expect(parseInt(String(spanText))).toEqual(0); // current selected network is 0 (bitcoin)

  // navigating to our ext to change the network
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  // await page.selectOption('[id="networkSelect"]', 'optimism');
  await page.getByRole('button', { name: 'Rootstock' }).click(); // allow connecting to the Dapp

  // navigating back to the dapp to check current network
  await page.goto('https://metamask.github.io/test-dapp/');
  await sleep(4_000); // waiting for a page to interact with injected provider and load that stuff
  const spanText2 = await page.locator('span[id="network"]').textContent();
  expect(parseInt(String(spanText2))).toEqual(30); // current selected network is 10
});

test('onboarding: does not have mnemonic', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingWelcome(page);
  await page.getByRole('button', { name: 'Import' }).click();

  await assertOnboardingImport(page);
  await fillOnboardingImport(page);
  // Don't click import

  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingWelcome(page);
});

test('onboarding: has mnemonic but not encrypted', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingWelcome(page);
  await page.getByRole('button', { name: 'Import' }).click();

  await assertOnboardingImport(page);
  await fillOnboardingImport(page);
  await page.getByRole('button', { name: 'Import' }).click();

  await assertOnboardingChoosePassword(page);
  // Don't click set password

  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingChoosePassword(page);
});

test('onboarding: has encrypted mnemonic but has not accepted terms of service', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingWelcome(page);
  await page.getByRole('button', { name: 'Import' }).click();

  await assertOnboardingImport(page);
  await fillOnboardingImport(page);
  await page.getByRole('button', { name: 'Import' }).click();

  await assertOnboardingChoosePassword(page);
  await fillOnboardingChoosePassword(page);
  await page.getByRole('button', { name: 'Set password' }).click();

  await assertOnboardingAcceptTermsOfService(page);
  // Don't click Agree & continue

  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingAcceptTermsOfService(page);
});

test('onboarding: has encrypted mnemonic and has accepted terms of service', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingWelcome(page);
  await page.getByRole('button', { name: 'Import' }).click();

  await assertOnboardingImport(page);
  await fillOnboardingImport(page);
  await page.getByRole('button', { name: 'Import' }).click();

  await assertOnboardingChoosePassword(page);
  await fillOnboardingChoosePassword(page);
  await page.getByRole('button', { name: 'Set password' }).click();

  await assertOnboardingAcceptTermsOfService(page);
  await page.getByRole('button', { name: 'Accept Terms' }).click();

  await assertHome(page);
});

test('self-diagnostics passes', async ({ page, extensionId }) => {
  await helperImportWallet(page, extensionId);
  await page.getByTestId('settings-button').click();

  await page.getByRole('button', { name: 'test' }).click();

  let messagesText = '';

  for (let c = 0; c < 30; c++) {
    await sleep(1000);

    const messagesDiv = await page.locator('[data-testid="messages"]');
    messagesText = await messagesDiv.innerText();
    if (messagesText.includes('OK')) {
      return; // all good
    }
  }

  assert(false, messagesText); // test failed
});
