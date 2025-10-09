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
  {
    id: 'yoyo',
    identifierRegex: /(?<identifier>.*wigroup\.co.*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'yoyo2',
    identifierRegex: /(?<identifier>.*yoyogroup.co.*)/,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'zapper',
    identifierRegex: /(?<identifier>.*(zapper\.com|\.wigroup\.|payat\.io|paynow\.netcash\.co\.za|paynow\.sagepay\.co\.za|\.zap\.pe|transactionjunction\.co\.za).*)/iu,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'scantopay',
    identifierRegex: /(?<identifier>.*scantopay\.io.*)/,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'scantopay-numeric',
    identifierRegex: /^(?<identifier>\d{10})$/,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'Checkers/Shoprite',
    identifierRegex: /(?<identifier>.*za.co.electrum.*)/,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'snapscan',
    identifierRegex: /(?<identifier>.*snapscan.*)/,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'Ecentric T1/T2 retailers',
    identifierRegex: /(?<identifier>.*za.co.ecentric.*)/,
    defaultDomain: 'cryptoqr.net',
    domains: {
      mainnet: 'cryptoqr.net',
      signet: 'staging.cryptoqr.net',
      regtest: 'staging.cryptoqr.net',
    },
  },
  {
    id: 'moneybadger',
    identifierRegex: /(?<identifier>.*cryptoqr.net.*)/,
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

      if (qrContent.includes(`@${domain}`)) {
        // trying to convert already converted result
        continue;
      }

      return `${encodeURIComponent(match.groups.identifier)}@${domain}`;
    }
  }

  return null;
};
