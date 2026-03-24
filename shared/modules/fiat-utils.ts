import { FiatUnit } from '../models/fiatUnit';
import { TFiat } from '../types/fiat';

export function getFiatSymbol(fiat: TFiat): string {
  return FiatUnit[fiat]?.symbol || fiat;
}

export function formatFiatDisplay(amount: string, fiat: TFiat): string {
  const symbol = getFiatSymbol(fiat);
  return `${symbol}${amount}`;
}
