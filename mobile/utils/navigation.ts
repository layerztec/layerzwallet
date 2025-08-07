import { UNLOCK_ACTIONS, type UnlockRouteParams } from '@/types/routes';

export const unlockRoutes = {
  enableSecurity: () => ({
    pathname: '/unlock' as const,
    params: { action: UNLOCK_ACTIONS.ENABLE_SECURITY } satisfies UnlockRouteParams,
  }),

  disableSecurity: () => ({
    pathname: '/unlock' as const,
    params: { action: UNLOCK_ACTIONS.DISABLE_SECURITY } satisfies UnlockRouteParams,
  }),

  regular: () => '/unlock' as const,
} as const;
