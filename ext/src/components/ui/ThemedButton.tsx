import React from 'react';
import { useTheme } from '@/hooks/ThemeContext';
import { ColorNames } from '@shared/theme';
import styled from 'styled-components';

export type ThemedButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  colorName?: ColorNames;
};

// Base button styles
const StyledButton = styled.button<{
  btnColor: string;
  textColor: string;
  isOutline: boolean;
  btnSize: string;
}>`
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  border: ${(props) => (props.isOutline ? `1px solid ${props.btnColor}` : 'none')};
  background-color: ${(props) => (props.isOutline ? 'transparent' : props.btnColor)};
  color: ${(props) => props.textColor};

  /* Size variations */
  padding: ${(props) => {
    switch (props.btnSize) {
      case 'small':
        return '6px 12px';
      case 'large':
        return '14px 20px';
      default:
        return '10px 16px'; // medium
    }
  }};

  font-size: ${(props) => {
    switch (props.btnSize) {
      case 'small':
        return '14px';
      case 'large':
        return '18px';
      default:
        return '16px'; // medium
    }
  }};

  &:hover {
    opacity: 0.9;
  }

  &:active {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export function ThemedButton({ title, variant = 'primary', size = 'medium', colorName, ...otherProps }: ThemedButtonProps) {
  const { getColor } = useTheme();

  // Determine button color based on variant and custom color
  let btnColor;
  let textColor = '#FFFFFF'; // Default white text
  let isOutline = false;

  switch (variant) {
    case 'primary':
      btnColor = colorName ? getColor(colorName) : getColor('primary');
      break;
    case 'secondary':
      btnColor = getColor('secondary');
      break;
    case 'danger':
      btnColor = getColor('danger');
      break;
    case 'outline':
      isOutline = true;
      btnColor = colorName ? getColor(colorName) : getColor('primary');
      textColor = btnColor;
      break;
    default:
      btnColor = getColor('primary');
  }

  return (
    <StyledButton btnColor={btnColor} textColor={textColor} isOutline={isOutline} btnSize={size} {...otherProps}>
      {title}
    </StyledButton>
  );
}
