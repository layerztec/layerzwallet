import React from 'react';
import { createRoot } from 'react-dom/client';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import BugsnagPerformance from '@bugsnag/browser-performance';
import { isPlaywrightMode } from '../../utils/playwright-detection';
import { BUGSNAG_API_KEY } from './bugsnag-config';

import Popup from './Popup';
import './index.css';

let ErrorBoundary = ({ children }) => children;

if (BUGSNAG_API_KEY && !isPlaywrightMode()) {
  const manifest = typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest() : {};

  Bugsnag.start({
    apiKey: BUGSNAG_API_KEY,
    plugins: [new BugsnagPluginReact()],
    appType: 'layerz-extension-popup',
    appVersion: manifest.version,
    releaseStage: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    enabledReleaseStages: ['development', 'production'],
    collectUserIp: false,
    generateAnonymousId: false,
    endpoints: {
      notify: 'https://notify.bugsnag.com',
      sessions: 'https://sessions.bugsnag.com',
    },
    metadata: {
      platform: {
        type: 'browser-extension',
        browser: navigator.userAgent,
        extensionName: manifest.name,
      },
    },
    onError: (event) => {
      event.errors.forEach((error) => {
        if (Array.isArray(error.stacktrace)) {
          error.stacktrace = error.stacktrace.map((frame) => {
            if (frame.file) {
              frame.file = frame.file
                .replace(/chrome-extension:/g, 'chrome_extension:')
                .replace(/moz-extension:/g, 'moz_extension:')
                .replace(/safari-extension:/g, 'safari_extension:')
                .replace(/safari-web-extension:/g, 'safari_web_extension:');
            }
            return frame;
          });
        }
      });
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
