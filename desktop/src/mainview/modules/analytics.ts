import { init, trackEvent } from '@aptabase/web';
import type { AnalyticsEventPropertiesMap, AnalyticsEvents, AnalyticsPropertyValue } from '@shared/types/analytics';

import { version as appVersion } from '../../../package.json';
import { handleError } from './error-handler';

let isAnalyticsEnabled = false;

export const initializeAnalytics = (aptabaseAppKey?: string) => {
  if (!aptabaseAppKey) {
    isAnalyticsEnabled = false;
    console.warn('Aptabase API key not found');
    return;
  }

  try {
    init(aptabaseAppKey, {
      appVersion,
      isDebug: process.env.NODE_ENV !== 'production',
    });
    console.log('Analytics initialized successfully');
    isAnalyticsEnabled = true;
  } catch (error) {
    handleError(error, 'analytics:init');
    console.error('Analytics failed during init:', error);
  }
};

export const trackAnalyticsEvent = <TEventName extends AnalyticsEvents>(eventName: TEventName, properties: AnalyticsEventPropertiesMap[TEventName]) => {
  if (!isAnalyticsEnabled) {
    return;
  }

  try {
    // @aptabase/web's trackEvent is fire-and-forget (returns a promise); swallow rejections so analytics never breaks the app.
    void trackEvent(eventName, properties as Record<string, AnalyticsPropertyValue>).catch((error) => {
      handleError(error, `analytics:trackEvent:${eventName}`);
    });
    console.log('Analytics event logged:', eventName, JSON.stringify(properties));
  } catch (error) {
    handleError(error, `analytics:trackEvent:${eventName}`);
    console.error(`Analytics failed during trackEvent:${eventName}:`, error);
  }
};
