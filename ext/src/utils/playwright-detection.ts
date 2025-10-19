/**
 * Detects if the extension is running in a Playwright test environment
 */
export function isPlaywrightMode(): boolean {
  // Check for Playwright-specific environment variable
  return typeof process !== 'undefined' && process.env && process.env.PW_CHROMIUM_ATTACH_TO_OTHER === '1';
}
