import Constants from 'expo-constants';

/**
 * Determines if the app is currently running in a Maestro testing environment.
 * This is used to conditionally enable testing backdoors that should never be
 * available in production builds.
 */
export const isMaestroEnvironment = (): boolean => {
  if (__DEV__) {
    return true;
  }

  // Check for Maestro-specific environment variables
  // Maestro sets these when running tests
  const maestroVars = ['MAESTRO_DRIVER_HOST', 'MAESTRO_DRIVER_PORT', 'MAESTRO_APP_ID', 'MAESTRO_SESSION_ID'];

  for (const varName of maestroVars) {
    if (Constants.expoConfig?.extra?.[varName] || process.env[varName]) {
      return true;
    }
  }

  const isSimulator = Constants.platform?.ios?.simulator || Constants.platform?.android?.isEmulator;

  return Boolean(__DEV__ && isSimulator);
};
