import { Platform } from 'react-native';

export const isIOS26OrNewer = Platform.OS === 'ios' && (typeof Platform.Version === 'string' ? parseInt(String(Platform.Version), 10) : Number(Platform.Version)) >= 26;
