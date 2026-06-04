import React, { cloneElement, ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { useActionPopup, type ActionPopupItem } from '../contexts/ActionPopupContext';

type ChildProps = { onClick?: () => void; onPress?: () => void };

interface ActionPopupButtonProps {
  children: ReactElement<ChildProps>;
  actions: ActionPopupItem[];
  title?: string;
}

/** Web port of mobile `ActionPopupButton`. */
export const ActionPopupButton: React.FC<ActionPopupButtonProps> = ({ children, actions, title }) => {
  const navigate = useNavigate();
  const { setActions } = useActionPopup();

  const handlePress = () => {
    setActions(actions, title);
    navigate('/action-popup-modal');
  };

  return cloneElement(children, { onClick: handlePress, onPress: handlePress });
};
