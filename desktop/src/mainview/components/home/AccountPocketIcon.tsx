import { BarChart2, Bot, ShoppingCart, Volume2, Wallet, type LucideIcon } from 'lucide-react';
import React from 'react';

import type { AccountItem } from '@shared/hooks/AccountNumberContext';

import './AccountPocketIcon.css';

/** Lucide equivalents for mobile pocket icons (Ionicons / Foundation / MaterialCommunity). */
function resolveAccountIcon(item: AccountItem): LucideIcon {
  if (item.iconCollection === 'material-community') {
    if (item.icon === 'robot-outline') {
      return Bot;
    }
  }
  if (item.iconCollection === 'foundation') {
    if (item.icon === 'sound') {
      return Volume2;
    }
  }
  switch (item.icon) {
    case 'bar-chart-outline':
      return BarChart2;
    case 'cart-outline':
      return ShoppingCart;
    case 'wallet-outline':
    default:
      return Wallet;
  }
}

type AccountPocketIconProps = {
  item: AccountItem;
  /** Header trigger uses 22px (mobile StickyHeader); menu rows use 24px in a 40px circle. */
  variant?: 'header' | 'menu';
};

export const AccountPocketIcon: React.FC<AccountPocketIconProps> = ({ item, variant = 'header' }) => {
  const Icon = resolveAccountIcon(item);
  const isMaterial = item.iconCollection === 'material-community';

  return (
    <span className={['account-pocket-icon', variant === 'menu' ? 'account-pocket-icon--menu' : ''].filter(Boolean).join(' ')} aria-hidden>
      <Icon size={variant === 'menu' ? 24 : 22} color="#ffffff" strokeWidth={2} className={isMaterial ? 'account-pocket-icon__glyph--material' : undefined} />
    </span>
  );
};

export const AccountPocketOptionLabel: React.FC<{ item: AccountItem }> = ({ item }) => (
  <span className="dropdown-account-option">
    <AccountPocketIcon item={item} variant="menu" />
    <span className="dropdown-account-option-label">{item.name}</span>
  </span>
);
