import { createRef } from 'react';
import { View } from 'react-native';

/** Ref to Home's BlurTargetView — used by PlatformBlurView when not under BlurTargetContext (e.g. transparent modals + DetachedSheet). */
export const homeBlurTargetRef = createRef<View | null>();
