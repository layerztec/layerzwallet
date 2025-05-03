import React from 'react';
import { useTheme } from '../hooks/ThemeContext';
import Button from './Button';
import { IoArrowUpOutline, IoArrowDownOutline, IoSwapHorizontalOutline, IoAddCircleOutline, IoCashOutline, IoEllipsisHorizontal } from 'react-icons/io5';

export type ActionType = 'send' | 'receive' | 'swap' | 'buy' | 'sell';

interface ActionButtonProps {
  type: ActionType;
  onClick: () => void;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  style?: React.CSSProperties;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  testId?: string;
}

/**
 * A specialized button component for common wallet actions
 * Includes standardized colors and icons for each action type
 */
const ActionButton: React.FC<ActionButtonProps> = ({ type, onClick, label, size = 'medium', style, disabled = false, loading = false, className, testId }) => {
  const { getColor } = useTheme();

  // Determine the button's configuration based on its type
  const getActionConfig = () => {
    switch (type) {
      case 'send':
        return {
          color: getColor('sendButton'),
          icon: <IoArrowUpOutline />,
          defaultLabel: 'Send',
        };
      case 'receive':
        return {
          color: getColor('receiveButton'),
          icon: <IoArrowDownOutline />,
          defaultLabel: 'Receive',
        };
      case 'swap':
        return {
          color: getColor('primary'),
          icon: <IoSwapHorizontalOutline />,
          defaultLabel: 'Swap',
        };
      case 'buy':
        return {
          color: getColor('success'),
          icon: <IoAddCircleOutline />,
          defaultLabel: 'Buy',
        };
      case 'sell':
        return {
          color: getColor('warning'),
          icon: <IoCashOutline />,
          defaultLabel: 'Sell',
        };
      default:
        return {
          color: getColor('primary'),
          icon: <IoEllipsisHorizontal />,
          defaultLabel: 'Action',
        };
    }
  };

  const config = getActionConfig();
  const buttonLabel = label === undefined ? config.defaultLabel : label;

  // Get icon size based on button size
  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 18;
      case 'large':
        return 22;
      default:
        return 18;
    }
  };

  const iconSize = getIconSize();

  // For icon-only buttons (when label is empty string), adjust the style
  const isIconOnly = label === '';
  const iconOnlyStyle = isIconOnly ? { padding: '0 8px' } : {};

  const iconStyle = {
    fontSize: `${iconSize}px`,
    color: getColor('white'),
    marginRight: isIconOnly ? 0 : '8px',
  };

  return (
    <Button
      title={buttonLabel}
      onClick={onClick}
      style={{
        backgroundColor: config.color,
        ...iconOnlyStyle,
        ...style,
      }}
      disabled={disabled}
      loading={loading}
      className={className}
      testId={testId}
      size={size}
      iconLeft={React.cloneElement(config.icon, { style: iconStyle })}
    />
  );
};

export default ActionButton;
