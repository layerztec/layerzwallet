/**
 * Cross-platform analytics event taxonomy (single source of truth).
 *
 * The event names + property shapes live here so mobile and desktop report identical
 * schemas to Aptabase. Platform `analytics.ts` modules wire up the SDK (which differs
 * per platform) and re-export these.
 */

export type AnalyticsPropertyValue = string | number | boolean;

export enum AnalyticsEvents {
  AppStarted = 'app_started',
  SwapCompleted = 'swap_completed',
  McpCall = 'mcp_call',
}

export type NoAnalyticsProperties = Record<never, never>;

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
