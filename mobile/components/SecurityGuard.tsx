import React, { ReactNode, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useSecurityContext } from '@/hooks/useSecurityContext';

interface SecurityGuardProps {
  children: ReactNode;
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({ children }) => {
  const { isAppLocked, isSecurityEnabled } = useSecurityContext();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const currentPath = `/${segments.join('/')}`;

    // If security is enabled and app is locked, redirect to unlock screen
    if (isSecurityEnabled && isAppLocked && currentPath !== '/unlock') {
      router.replace('/unlock');
    }
    // If security is disabled or app is unlocked, ensure we're not on unlock screen
    else if ((!isSecurityEnabled || !isAppLocked) && currentPath === '/unlock') {
      router.replace('/');
    }
  }, [isAppLocked, isSecurityEnabled, segments, router]);

  return <>{children}</>;
};
