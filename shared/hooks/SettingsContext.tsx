import React, { createContext, ReactNode, useEffect, useState } from 'react';

import { IStorage, STORAGE_KEY_SETTINGS } from '../types/IStorage';

// Define all possible settings with their types, possible values, and defaults
export const SETTINGS_CONFIG = {
  /* 
  // reserved for future use: 
  language: {
    options: ['en', 'es', 'fr', 'zh', 'ja'] as const,
    default: 'en' as const,
  }, */
  showTestnets: {
    options: ['ON', 'OFF'] as const,
    default: 'OFF' as const,
  },
} as const;

// Derive the AppSettings interface from the config
export type AppSettings = {
  [K in keyof typeof SETTINGS_CONFIG]: (typeof SETTINGS_CONFIG)[K] extends { options: readonly any[] } ? (typeof SETTINGS_CONFIG)[K]['options'][number] : (typeof SETTINGS_CONFIG)[K]['default'];
};

// Derive default settings from the config
export const DEFAULT_SETTINGS: AppSettings = Object.fromEntries(Object.entries(SETTINGS_CONFIG).map(([key, config]) => [key, config.default])) as AppSettings;

// Extract options for settings that have them
export const SETTING_OPTIONS = Object.fromEntries(
  Object.entries(SETTINGS_CONFIG)
    .filter(([_, config]) => 'options' in config)
    .map(([key, config]) => [key, (config as any).options])
) as {
  [K in keyof typeof SETTINGS_CONFIG]: (typeof SETTINGS_CONFIG)[K] extends { options: readonly any[] } ? (typeof SETTINGS_CONFIG)[K]['options'] : never;
};

interface ISettingsContext {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  getSetting: <K extends keyof AppSettings>(key: K) => AppSettings[K];
}

export const SettingsContext = createContext<ISettingsContext>({
  settings: DEFAULT_SETTINGS,
  updateSetting: async () => {
    throw new Error('SettingsContext.updateSetting(): This should never happen');
  },
  resetToDefaults: async () => {
    throw new Error('SettingsContext.resetToDefaults(): This should never happen');
  },
  getSetting: () => {
    throw new Error('SettingsContext.getSetting(): This should never happen');
  },
});

interface SettingsContextProviderProps {
  children: ReactNode;
  storage: IStorage;
}

export const SettingsContextProvider: React.FC<SettingsContextProviderProps> = (props) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load settings from storage on initialization
  useEffect(() => {
    (async () => {
      try {
        const storedSettings = await props.storage.getItem(STORAGE_KEY_SETTINGS);
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          // Merge with defaults to ensure all settings exist
          const mergedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
          setSettings(mergedSettings);
        } else {
          // No settings stored, use defaults
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (error) {
        console.error('Error loading settings, using defaults:', error);
        setSettings(DEFAULT_SETTINGS);
      }
    })();
  }, [props.storage]);

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Store in storage
    try {
      await props.storage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const resetToDefaults = async () => {
    setSettings(DEFAULT_SETTINGS);

    try {
      await props.storage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    } catch (error) {
      console.error('Error saving default settings:', error);
    }
  };

  const getSetting = <K extends keyof AppSettings>(key: K): AppSettings[K] => {
    return settings[key];
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetToDefaults,
        getSetting,
      }}
    >
      {props.children}
    </SettingsContext.Provider>
  );
};
