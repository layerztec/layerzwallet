// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import React, { ComponentProps } from 'react';

// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'arrow.down': 'arrow-downward',
  'arrow.up': 'arrow-upward',
  gear: 'settings',
  'person.fill': 'person',
  plus: 'add',
  minus: 'remove',
  qrcode: 'qr-code',
  'qrcode.viewfinder': 'qr-code-scanner',
  'doc.text': 'description',
  'doc.text.fill': 'description',
  creditcard: 'credit-card',
  'creditcard.fill': 'credit-card',
  xmark: 'close',
  checkmark: 'check',
  trash: 'delete',
  'trash.fill': 'delete',
  lock: 'lock',
  'lock.fill': 'lock',
  'lock.open': 'lock-open',
  'lock.open.fill': 'lock-open',
  bell: 'notifications',
  'bell.fill': 'notifications',
  'info.circle': 'info',
  'info.circle.fill': 'info',
  warning: 'warning',
  'warning.fill': 'warning',
  'exclamationmark.triangle': 'warning',
  'exclamationmark.triangle.fill': 'warning',
} as Partial<Record<import('expo-symbols').SymbolViewProps['name'], React.ComponentProps<typeof MaterialIcons>['name']>>;

export type IconSymbolName = keyof typeof MAPPING;

type Props = {
  name: IconSymbolName;
  size?: ComponentProps<typeof MaterialIcons>['size'];
  color?: ComponentProps<typeof MaterialIcons>['color'];
  style?: ComponentProps<typeof MaterialIcons>['style'];
  weight?: SymbolWeight;
};

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({ name, size = 24, color, style }: Props) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
