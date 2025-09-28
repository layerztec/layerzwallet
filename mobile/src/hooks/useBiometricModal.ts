import { useEffect, useContext, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSegments, useRouter } from 'expo-router';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { isInMainApp } from '@/src/utils/navigationUtils';

export function useBiometricModal() {
  const { isAuthenticated, isBiometricEnabled, isUpdatingBiometric } = useAuthState();
  const segments = useSegments();
  const router = useRouter();
  const { dismissScanner } = useContext(ScanQrContext);
  const appStateRef = useRef(AppState.currentState);

  // Determine if user is currently in main app (indicates they've authenticated before)
  const userInMainApp = isInMainApp(segments);

  // Show modal when user has been to main app before but is now locked
  const shouldShowBiometricModal = isBiometricEnabled && userInMainApp && !isAuthenticated && !isUpdatingBiometric;

  useEffect(() => {
    if (shouldShowBiometricModal) {
      dismissScanner();
      router.push('/BiometricLogin');
    }
  }, [shouldShowBiometricModal, dismissScanner, router]);

  useEffect(() => {
    if (!isBiometricEnabled) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.debug('useBiometricModal: AppState changed', {
        previous: appStateRef.current,
        current: nextAppState,
        isAuthenticated,
        userInMainApp,
        isUpdatingBiometric,
      });

      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (userInMainApp && !isAuthenticated && !isUpdatingBiometric) {
          console.debug('useBiometricModal: Showing modal after background return');
          dismissScanner();
          router.push('/BiometricLogin');
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isBiometricEnabled, isAuthenticated, userInMainApp, isUpdatingBiometric, dismissScanner, router]);

  return {
    shouldShowBiometricModal,
    userInMainApp,
  };
}
