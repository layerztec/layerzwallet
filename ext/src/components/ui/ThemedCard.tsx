import React, { ReactNode } from 'react';
import styled from 'styled-components';
import { useTheme } from '@/hooks/ThemeContext';

type ThemedCardProps = {
  children: ReactNode;
  title?: string;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated';
};

// Card container with variants
const CardContainer = styled.div<{
  backgroundColor: string;
  borderColor: string;
  shadowColor: string;
  variant: 'default' | 'outlined' | 'elevated';
}>`
  border-radius: 12px;
  padding: 16px;
  margin: 8px 0;
  background-color: ${(props) => props.backgroundColor};
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  ${(props) =>
    props.variant === 'outlined' &&
    `
    border: 1px solid ${props.borderColor};
  `}

  ${(props) =>
    props.variant === 'elevated' &&
    `
    box-shadow: 0 2px 4px ${props.shadowColor};
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px ${props.shadowColor};
    }
  `}
`;

// Card title
const CardTitle = styled.h3<{ textColor: string }>`
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: bold;
  color: ${(props) => props.textColor};
`;

export function ThemedCard({ children, title, className, variant = 'default' }: ThemedCardProps) {
  const { getColor } = useTheme();

  const backgroundColor = getColor('card');
  const borderColor = getColor('border');
  const shadowColor = getColor('shadowColor');
  const textColor = getColor('text');

  return (
    <CardContainer className={className} backgroundColor={backgroundColor} borderColor={borderColor} shadowColor={shadowColor} variant={variant}>
      {title && <CardTitle textColor={textColor}>{title}</CardTitle>}
      {children}
    </CardContainer>
  );
}
