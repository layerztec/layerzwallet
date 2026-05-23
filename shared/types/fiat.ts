export const SUPPORTED_FIAT_CURRENCIES = ['USD', 'EUR', 'BRL', 'MXN', 'NGN', 'KES', 'ZAR', 'AUD', 'GBP', 'CAD', 'JPY', 'CHF'] as const;

export type TFiat = (typeof SUPPORTED_FIAT_CURRENCIES)[number];
