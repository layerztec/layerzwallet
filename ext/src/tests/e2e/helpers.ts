import { Page } from '@playwright/test';

import { expect } from './fixtures';

export const assertOnboardingWelcome = async (page: Page) => {
  await expect(page.locator('body')).toHaveText(/Import wallet/i);
  await expect(page.locator('body')).toHaveText(/Create wallet/i);
};

export const assertOnboardingImport = async (page: Page) => {
  await expect(page.locator('body')).toHaveText(/Enter your secret recovery phrase or private key to import your wallet./);
};

export const fillOnboardingImport = async (page: Page, seed?: string) => {
  await page.getByRole('textbox').fill(seed || 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
};

export const assertOnboardingChoosePassword = async (page: Page) => {
  await expect(page.locator('body')).toHaveText(/Create your password/);
};

export const fillOnboardingChoosePassword = async (page: Page) => {
  await page.fill('input[name="password"]', 'qwerty');
  await page.fill('input[name="password_repeat"]', 'qwerty');
};

export const assertOnboardingAcceptTermsOfService = async (page: Page) => {
  await expect(page.locator('body')).toHaveText(/Terms of service/, { timeout: 33000 });
};

export const assertHome = async (page: Page) => {
  await expect(page.locator('body')).toHaveText(/Send/, { timeout: 33000 });
  await expect(page.locator('body')).toHaveText(/Receive/, { timeout: 33000 });
};

export const helperImportWallet = async (page: Page, extensionId: string, seed?: string) => {
  // importing wallet
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await assertOnboardingWelcome(page);
  await page.getByRole('button', { name: 'Import wallet' }).click();

  await assertOnboardingImport(page);
  await fillOnboardingImport(page, seed);
  await page.getByRole('button', { name: 'Import' }).click();
  await expect(page.locator('body')).not.toHaveText(/Failed to save mnemonic/);

  await assertOnboardingChoosePassword(page);
  await fillOnboardingChoosePassword(page);
  await page.getByRole('button', { name: 'Set password' }).click();

  await assertOnboardingAcceptTermsOfService(page);
  await page.getByRole('button', { name: 'Accept Terms' }).click();

  await assertHome(page);
};

export const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export const getPopupPage = (page: Page): Page => {
  const pages = page.context().pages();
  // just returning the last page in the context, typically it should be the thing we need.
  // in case it ever changes we might need to implement some more advanced filtering by page url or title
  return pages[pages.length - 1];
};
