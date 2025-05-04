import React from 'react';
import { useLayerzTheme, spacing } from '../themes/theme';

export const Container: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  // You can use theme if needed
  useLayerzTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxHeight: '600px',
        minHeight: 0,
        overflow: 'auto',
        boxSizing: 'border-box',
        padding: spacing.md,
        boxShadow: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Container;
