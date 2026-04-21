import { Platform } from 'react-native';

export const isIOS26OrNewer = Platform.OS === 'ios' && (typeof Platform.Version === 'string' ? parseInt(String(Platform.Version), 10) : Number(Platform.Version)) >= 26;
export const isMacCatalyst = Platform.OS === 'ios' && Boolean((Platform as typeof Platform & { isMacCatalyst?: boolean }).isMacCatalyst);
