import React, { cloneElement, ReactElement } from 'react';
import { TouchableOpacityProps } from 'react-native';
import { useRouter } from 'expo-router';
import { useActionPopup } from '@/contexts/ActionPopupContext';

interface Action {
  onClick: () => void;
  children: ReactElement;
}

interface ActionPopupButtonProps {
  children: ReactElement<TouchableOpacityProps>;
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
