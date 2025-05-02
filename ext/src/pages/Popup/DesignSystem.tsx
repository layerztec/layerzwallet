import React, { useRef, useState, useEffect, ReactNode } from 'react';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { ClipboardCopy } from 'lucide-react';
import { getCurrentTheme, getLayerzColor, textStyles, borderRadius, spacing, LayerzColors } from './theme';

type TextProps = {
  children: ReactNode;
  variant?: keyof typeof textStyles;
  color?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  className?: string;
};

export const Text: React.FC<TextProps> = ({ children, variant = 'bodyMedium', color, style, onClick, className }) => {
  const theme = getCurrentTheme();
  const textColor = color || LayerzColors[theme].text;

  return (
    <span
      className={className}
      onClick={onClick}
      style={{
        color: textColor,
        ...textStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
};

type HeadingProps = {
  children: ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
};

export const Heading: React.FC<HeadingProps> = ({ children, level = 1, color, style, className }) => {
  const theme = getCurrentTheme();
  const textColor = color || LayerzColors[theme].text;

  // Map heading level to variant
  let variant: keyof typeof textStyles;
  switch (level) {
    case 1:
      variant = 'displayLarge';
      break;
    case 2:
      variant = 'displayMedium';
      break;
    case 3:
      variant = 'headingLarge';
      break;
    case 4:
      variant = 'headingMedium';
      break;
    case 5:
      variant = 'headingSmall';
      break;
    case 6:
      variant = 'subtitleLarge';
      break;
    default:
      variant = 'displayLarge';
  }

  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <HeadingTag
      className={className}
      style={{
        color: textColor,
        margin: 0,
        ...textStyles[variant],
        ...style,
      }}
    >
      {children}
    </HeadingTag>
  );
};

type CardProps = {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
};

export const Card: React.FC<CardProps> = ({ children, style, className, elevated = false, onClick }) => {
  const theme = getCurrentTheme();

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: LayerzColors[theme].cardBackground,
        borderRadius: borderRadius.m,
        padding: spacing.m,
        border: `1px solid ${LayerzColors[theme].border}`,
        boxShadow: elevated ? `0 2px 8px ${LayerzColors[theme].shadow}` : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'text' | 'success' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
};

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'medium', fullWidth = false, disabled = false, onClick, style, className, type = 'button' }) => {
  const theme = getCurrentTheme();

  // Determine button colors based on variant
  let backgroundColor;
  let textColor;
  let borderColor;

  switch (variant) {
    case 'primary':
      backgroundColor = LayerzColors[theme].primary;
      textColor = LayerzColors[theme].textInverted;
      borderColor = 'transparent';
      break;
    case 'secondary':
      backgroundColor = LayerzColors[theme].secondary;
      textColor = LayerzColors[theme].textInverted;
      borderColor = 'transparent';
      break;
    case 'outlined':
      backgroundColor = 'transparent';
      textColor = LayerzColors[theme].primary;
      borderColor = LayerzColors[theme].primary;
      break;
    case 'text':
      backgroundColor = 'transparent';
      textColor = LayerzColors[theme].primary;
      borderColor = 'transparent';
      break;
    case 'success':
      backgroundColor = LayerzColors[theme].success;
      textColor = LayerzColors[theme].textInverted;
      borderColor = 'transparent';
      break;
    case 'danger':
      backgroundColor = LayerzColors[theme].error;
      textColor = LayerzColors[theme].textInverted;
      borderColor = 'transparent';
      break;
    default:
      backgroundColor = LayerzColors[theme].primary;
      textColor = LayerzColors[theme].textInverted;
      borderColor = 'transparent';
  }

  // Determine button size
  let padding;
  let fontSize;

  switch (size) {
    case 'small':
      padding = `${spacing.xs} ${spacing.s}`;
      fontSize = textStyles.labelSmall.fontSize;
      break;
    case 'large':
      padding = `${spacing.m} ${spacing.l}`;
      fontSize = textStyles.labelLarge.fontSize;
      break;
    default: // medium
      padding = `${spacing.s} ${spacing.m}`;
      fontSize = textStyles.labelMedium.fontSize;
  }

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? LayerzColors[theme].textTertiary : backgroundColor,
        color: disabled ? LayerzColors[theme].textSecondary : textColor,
        border: `1px solid ${borderColor}`,
        borderRadius: borderRadius.m,
        padding,
        fontSize,
        fontWeight: textStyles.button.fontWeight,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        outline: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

// Input component
type InputProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  fullWidth?: boolean;
  style?: React.CSSProperties;
  className?: string;
};

export const Input: React.FC<InputProps> = ({ value, onChange, placeholder, type = 'text', disabled = false, label, error, fullWidth = false, style, className }) => {
  const theme = getCurrentTheme();

  return (
    <div
      style={{
        width: fullWidth ? '100%' : 'auto',
        marginBottom: error ? spacing.s : 0,
        ...style,
      }}
    >
      {label && (
        <Text variant="labelMedium" style={{ display: 'block', marginBottom: spacing.xs }}>
          {label}
        </Text>
      )}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        style={{
          width: '100%',
          padding: spacing.s,
          borderRadius: borderRadius.s,
          border: `1px solid ${error ? LayerzColors[theme].error : LayerzColors[theme].border}`,
          fontSize: textStyles.bodyMedium.fontSize,
          color: LayerzColors[theme].text,
          backgroundColor: disabled ? LayerzColors[theme].surfaceBackground : LayerzColors[theme].white,
          outline: 'none',
          transition: 'border-color 0.2s ease',
        }}
      />

      {error && (
        <Text variant="bodySmall" color={LayerzColors[theme].error} style={{ marginTop: spacing.xxs }}>
          {error}
        </Text>
      )}
    </div>
  );
};

// Container for layout
type ContainerProps = {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  fullWidth?: boolean;
  center?: boolean;
};

export const Container: React.FC<ContainerProps> = ({ children, style, className, fullWidth = false, center = false }) => {
  return (
    <div
      className={className}
      style={{
        maxWidth: fullWidth ? '100%' : '1200px',
        width: '100%',
        padding: `0 ${spacing.m}`,
        margin: fullWidth ? 0 : '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : 'flex-start',
        justifyContent: center ? 'center' : 'flex-start',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
