import { Typography } from '@shared/constants/Typography';

export type TypographyKey = keyof typeof Typography;
export type TextType = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph' | TypographyKey;

export interface BaseThemedTextProps {
  /**
   * Light theme color override
   */
  lightColor?: string;

  /**
   * Dark theme color override
   */
  darkColor?: string;

  /**
   * Text type/variant to apply
   * @default 'default'
   */
  type?: TextType;
}

export interface WebThemedTextProps extends BaseThemedTextProps {
  size?: number | string;

  color?: string;

  /**
   * Text alignment for web components
   * @default 'auto'
   */
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}
