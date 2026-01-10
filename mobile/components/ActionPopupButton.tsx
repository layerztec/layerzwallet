import React, { cloneElement, ReactElement } from 'react';

import { useRouter } from 'expo-router';
import { useActionPopup } from '@/contexts/ActionPopupContext';
import Pressable, { PressableProps } from '@/components/Pressable';

interface Action {
  onClick: () => void;
  children: ReactElement;
}

interface ActionPopupButtonProps {
  children: ReactElement<PressableProps>;
  actions: Action[];
  title?: string;
}

export const ActionPopupButton: React.FC<ActionPopupButtonProps> = ({ children, actions, title }) => {
  const router = useRouter();
  const { setActions } = useActionPopup();

  // Handle press to show popup using Expo Router modal
  const handlePressWithRef = () => {
    console.debug('[ActionPopupButton] Button pressed, setting actions:', actions.length, 'title:', title);
    // Store actions in context
    setActions(actions, title);
    console.debug('[ActionPopupButton] Navigating to modal');
    // Navigate to modal route
    router.push('/ActionPopupModal');
  };

  const enhancedChild = cloneElement(children, {
    onPress: handlePressWithRef,
  });

  return enhancedChild;
};
