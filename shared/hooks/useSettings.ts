import { useContext } from 'react';
import { SettingsContext, AppSettings } from './SettingsContext';

export const useSettings = () => {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used within a SettingsContextProvider');
  }

  return context;
};

// Type-safe hook for getting a specific setting
export const useSetting = <K extends keyof AppSettings>(key: K): AppSettings[K] => {
  const { getSetting } = useSettings();
  return getSetting(key);
};
