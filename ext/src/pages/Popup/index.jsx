import React from 'react';
import { createRoot } from 'react-dom/client';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import BugsnagPerformance from '@bugsnag/browser-performance';
import { isPlaywrightMode } from '../../utils/playwright-detection';

import Popup from './Popup';
import './index.css';

const BUGSNAG_API_KEY = process.env.EXPO_PUBLIC_BUGSNAGJS_API_KEY;

let ErrorBoundary = ({ children }) => children;

if (BUGSNAG_API_KEY && !isPlaywrightMode()) {
  Bugsnag.start({
    apiKey: BUGSNAG_API_KEY,
    plugins: [new BugsnagPluginReact()],
    appType: 'browser-extension',
    releaseStage: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    enabledReleaseStages: ['development', 'production'],
    collectUserIp: false,
    endpoints: {
      notify: 'https://notify.bugsnag.com',
      sessions: 'https://sessions.bugsnag.com',
    },
    metadata: {
      platform: {
        type: 'browser-extension',
        browser: navigator.userAgent,
      },
    },
    onError: (event) => {
      console.log('[Bugsnag] Preparing to send error:', event.errors[0]?.errorMessage);
      console.log('[Bugsnag] API Key being used:', BUGSNAG_API_KEY);
      return true;
    },
  });

  BugsnagPerformance.start({ apiKey: BUGSNAG_API_KEY });

  try {
    const reactPlugin = Bugsnag.getPlugin('react');
    if (reactPlugin) {
      ErrorBoundary = reactPlugin.createErrorBoundary(React);
    }
  } catch (error) {
    console.warn('[Popup] Could not create Bugsnag ErrorBoundary:', error);
  }
}

const container = document.getElementById('app-container');
const root = createRoot(container);

root.render(
  <ErrorBoundary>
    <Popup />
  </ErrorBoundary>
);
