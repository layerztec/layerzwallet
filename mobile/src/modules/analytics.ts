import { init, trackEvent, dispose } from '@aptabase/react-native';

import { handleError } from './error-handler';

export type AnalyticsPropertyValue = string | number | boolean;

export enum AnalyticsEvents {
  AppStarted = 'app_started',
  SwapCompleted = 'swap_completed',
  McpCall = 'mcp_call',
}

type NoAnalyticsProperties = Record<never, never>;

export type AnalyticsEventPropertiesMap = {
  [AnalyticsEvents.AppStarted]: NoAnalyticsProperties;
  [AnalyticsEvents.SwapCompleted]: {
    provider: string;
    id: string;
    sendAsset: string;
    receiveAsset: string;
    sat: number;
  };
  [AnalyticsEvents.McpCall]: {
    tool_name: string;
  };
};

let isAnalyticsEnabled = false;

export const initializeAnalytics = (aptabaseAppKey?: string) => {
  if (!aptabaseAppKey) {
    isAnalyticsEnabled = false;
    console.warn('Aptabase API key not found');
    return;
  }

  try {
    init(aptabaseAppKey);
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
    trackEvent(eventName, properties as Record<string, AnalyticsPropertyValue>);
    console.log('Analytics event logged:', eventName, JSON.stringify(properties));
  } catch (error) {
    handleError(error, `analytics:trackEvent:${eventName}`);
    console.error(`Analytics failed during trackEvent:${eventName}:`, error);
  }
};

export const disposeAnalytics = () => {
  if (!isAnalyticsEnabled) {
    return;
  }

  try {
    dispose();
  } catch (error) {
    handleError(error, 'analytics:dispose');
    console.error('Analytics failed during dispose:', error);
  }
};
