export type TypographyKey = 'headline' | 'subHeadline' | 'paragraph' | 'button';
export type TextType = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph' | 'button' | TypographyKey;
export type WebTextAlign = 'start' | 'end' | 'left' | 'right' | 'center' | 'justify' | 'match-parent';

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
   * @default 'start'
   */
  textAlign?: WebTextAlign;
}
