import './polyfills';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './pages/App';
import { AnalyticsEvents } from '@shared/types/analytics';
import { initializeAnalytics, trackAnalyticsEvent } from './modules/analytics';

const APTABASE_APP_KEY = process.env.EXPO_PUBLIC_APTABASE_KEY;
if (APTABASE_APP_KEY) {
  initializeAnalytics(APTABASE_APP_KEY);
  trackAnalyticsEvent(AnalyticsEvents.AppStarted, {});
} else {
  console.warn('Analytics not started');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
