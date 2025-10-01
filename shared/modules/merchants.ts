/**
 *
 * https://github.com/GaloyMoney/galoy-client/blob/main/src/parsing/merchants.ts
 */

export type Network = 'mainnet' | 'signet' | 'regtest';

type MerchantConfig = {
  id: string;
  identifierRegex: RegExp;
  defaultDomain: string;
  domains: { [K in Network]: string };
};

export const merchants: MerchantConfig[] = [
  {
    id: 'picknpay',
    identifierRegex: /(?<identifier>.*za\.co\.electrum\.picknpay.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'ecentric',
    identifierRegex: /(?<identifier>.*za\.co\.ecentric.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
];

export const convertMerchantQRToLightningAddress = ({ qrContent, network }: { qrContent: string; network: Network }): string | null => {
  if (!qrContent) {
    return null;
  }

  for (const merchant of merchants) {
    const match = qrContent.match(merchant.identifierRegex);
    if (match?.groups?.identifier) {
      const domain = merchant.domains[network] || merchant.defaultDomain;
      return `${encodeURIComponent(match.groups.identifier)}@${domain}`;
    }
  }

  return null;
};
