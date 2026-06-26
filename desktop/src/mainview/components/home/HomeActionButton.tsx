import React from 'react';
import { LucideIcon } from 'lucide-react';

import { ThemedText } from '../ThemedText';

type HomeActionButtonProps = {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
};

/** Web port of mobile `HomeActionButton`. */
export const HomeActionButton: React.FC<HomeActionButtonProps> = ({ title, icon: Icon, onClick, disabled, testId }) => {
  return (
    <div className="home-action-button">
      <button type="button" className="home-action-button-surface" onClick={onClick} disabled={disabled} data-testid={testId}>
        <Icon size={24} color="rgba(255, 255, 255, 0.8)" strokeWidth={2} />
      </button>
      <ThemedText className="home-action-button-label">{title}</ThemedText>
    </div>
  );
};
