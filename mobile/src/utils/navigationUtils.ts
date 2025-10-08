/**
 * Utility functions for navigation and route detection
 */

/**
 * List of all main app screens that require authentication
 */
const MAIN_APP_SCREENS = [
  'Home',
  'Settings',
  'Swap',
  'Receive',
  'SendArk',
  'SendBtc',
  'SendEvm',
  'Transactions',
  'BackdoorNetworkSwitcher',
  'Changelog',
  'SeedBackup',
  'selftest',
  'SwapTarget',
  'SwapSparkDeposit',
  'SwapDetails',
  'Onramp',
  'AskPassword',
  'AskMnemonic',
  'DAppBrowser',
  'Action',
  'PocketSwitch',
  'TransactionDetails',
] as const;

/**
 * Determines if the user is currently in a main app screen (indicates they've authenticated before)
 * @param segments - Array of route segments from useSegments()
 * @returns boolean - true if user is in a main app screen
 */
export function isInMainApp(segments: string[]): boolean {
  return segments.some((segment) => MAIN_APP_SCREENS.includes(segment as any));
}

export { MAIN_APP_SCREENS };
