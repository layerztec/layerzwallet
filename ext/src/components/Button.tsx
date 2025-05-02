import React from 'react';
import { useTheme } from '../hooks/ThemeContext';
import styled from 'styled-components';
import { IoArrowUpOutline, IoArrowDownOutline } from 'react-icons/io5';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'send' | 'receive';
export type ButtonSize = 'small' | 'medium' | 'large';
export type IconPosition = 'left' | 'right';

interface ButtonProps {
  onClick: () => void;
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
  className?: string;
  iconName?: string;
  iconPosition?: IconPosition;
  iconOnly?: boolean;
  testId?: string;
}

/**
 * A standardized button component for use across the extension
 * Uses the shared theme system for consistent styling
 * Matches the API and styling of the mobile Button component
 */
const Button: React.FC<ButtonProps> = ({
  onClick,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  className,
  iconName,
  iconPosition = 'left',
  iconOnly = false,
  testId,
}) => {
  const { getColor } = useTheme();

  // Define styles based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: getColor('primary'),
          color: getColor('white'),
          border: 'none',
        };
      case 'secondary':
        return {
          backgroundColor: getColor('accent'),
          color: getColor('white'),
          border: 'none',
        };
      case 'danger':
        return {
          backgroundColor: getColor('error'),
          color: getColor('white'),
          border: 'none',
        };
      case 'success':
        return {
          backgroundColor: getColor('success'),
          color: getColor('white'),
          border: 'none',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: getColor('primary'),
          border: `1px solid ${getColor('primary')}`,
        };
      case 'send':
        return {
          backgroundColor: getColor('sendButton'),
          color: getColor('white'),
          border: 'none',
        };
      case 'receive':
        return {
          backgroundColor: getColor('receiveButton'),
          color: getColor('white'),
          border: 'none',
        };
      default:
        return {
          backgroundColor: getColor('primary'),
          color: getColor('white'),
          border: 'none',
        };
    }
  };

  // Define styles based on size
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          height: '36px',
          padding: iconOnly ? '0 12px' : '0 16px',
          fontSize: '14px',
          iconSize: '16px',
        };
      case 'medium':
        return {
          height: '48px',
          padding: iconOnly ? '0 12px' : '0 24px',
          fontSize: '16px',
          iconSize: '18px',
        };
      case 'large':
        return {
          height: '56px',
          padding: iconOnly ? '0 12px' : '0 32px',
          fontSize: '18px',
          iconSize: '22px',
        };
      default:
        return {
          height: '48px',
          padding: iconOnly ? '0 12px' : '0 24px',
          fontSize: '16px',
          iconSize: '18px',
        };
    }
  };

  // Get the icon based on variant if not explicitly provided
  const getIconForVariant = () => {
    if (iconName) {
      switch (iconName) {
        case 'arrow-up-outline':
          return <IoArrowUpOutline />;
        case 'arrow-down-outline':
          return <IoArrowDownOutline />;
        default:
          return null;
      }
    }

    switch (variant) {
      case 'send':
        return <IoArrowUpOutline />;
      case 'receive':
        return <IoArrowDownOutline />;
      default:
        return null;
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const icon = getIconForVariant();

  const buttonStyle = {
    ...variantStyles,
    height: sizeStyles.height,
    padding: sizeStyles.padding,
    fontSize: sizeStyles.fontSize,
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  return (
    <ButtonContainer onClick={disabled || loading ? undefined : onClick} style={buttonStyle} className={className} data-testid={testId} disabled={disabled || loading}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <ContentContainer>
          {icon && iconPosition === 'left' && !iconOnly && <IconContainer style={{ marginRight: '8px', fontSize: sizeStyles.iconSize }}>{icon}</IconContainer>}

          {icon && iconOnly && <IconContainer style={{ fontSize: sizeStyles.iconSize }}>{icon}</IconContainer>}

          {!iconOnly && <span>{title}</span>}

          {icon && iconPosition === 'right' && !iconOnly && <IconContainer style={{ marginLeft: '8px', fontSize: sizeStyles.iconSize }}>{icon}</IconContainer>}
        </ContentContainer>
      )}
    </ButtonContainer>
  );
};

const ButtonContainer = styled.button`
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;

  &:disabled {
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    filter: brightness(0.9);
  }

  &:not(:disabled):active {
    opacity: 0.8;
    transform: translateY(1px);
  }
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const IconContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export default Button;
