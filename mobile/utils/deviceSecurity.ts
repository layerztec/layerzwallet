import * as LocalAuthentication from 'expo-local-authentication';

export const isDevicePasscodeEnabled = async (): Promise<boolean> => {
  try {
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
    return securityLevel >= LocalAuthentication.SecurityLevel.SECRET;
  } catch (error) {
    console.error('Error checking device passcode status:', error);
    return false;
  }
};

export const getDeviceSecurityInfo = async () => {
  try {
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

    let description = '';
    let hasPasscode = false;

    switch (securityLevel) {
      case LocalAuthentication.SecurityLevel.NONE:
        description = 'No device security enabled';
        hasPasscode = false;
        break;
      case LocalAuthentication.SecurityLevel.SECRET:
        description = 'Device has PIN/Pattern/Passcode enabled';
        hasPasscode = true;
        break;
      case LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK:
        description = 'Device has weak biometric authentication (usually with passcode fallback)';
        hasPasscode = true;
        break;
      case LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG:
        description = 'Device has strong biometric authentication (usually with passcode fallback)';
        hasPasscode = true;
        break;
      default:
        description = 'Unknown security level';
        hasPasscode = false;
        break;
    }

    return {
      hasPasscode,
      securityLevel,
      description,
    };
  } catch (error) {
    console.error('Error getting device security info:', error);
    return {
      hasPasscode: false,
      securityLevel: LocalAuthentication.SecurityLevel.NONE,
      description: 'Error checking device security',
    };
  }
};
