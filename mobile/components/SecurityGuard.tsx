import React, { ReactNode, useEffect } from 'react';
import { useRouter, useSegments, useLocalSearchParams } from 'expo-router';
import { useSecurityContext } from '@/hooks/useSecurityContext';

interface SecurityGuardProps {
  children: ReactNode;
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({ children }) => {
  const { isAppLocked, isSecurityEnabled } = useSecurityContext();
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams();

  useEffect(() => {
    const currentPath = `/${segments.join('/')}`;

    if (currentPath === '/unlock') {
      return;
    }

    if (isSecurityEnabled && isAppLocked && currentPath !== '/unlock') {
      router.replace('/unlock');
    }
  }, [isAppLocked, isSecurityEnabled, segments, router, params]);

  return <>{children}</>;
};
