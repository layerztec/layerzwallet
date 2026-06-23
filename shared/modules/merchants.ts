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

/**
 * @see https://moneybadger-qr-scanner.readme.io/reference/getqrinfo
 */
export type PosMetadata = {
  merchantName: string;
  amountMin: number;
  amountMax: number;
  amountDefault: number;
  orderReferenceRequired: boolean;
  orderReferenceDefault?: string;
  tipEnabled: boolean;
  currencyISOCode: string;
  denomination: 'cents' | string;
  createdAt?: string; // ISO
};

export const queryForMetadata = async (payload: string): Promise<PosMetadata> => {
  if (payload.includes('/') || payload.includes('_')) {
    payload = encodeURIComponent(payload);
  }

  const response = await fetch(`https://api.cryptoqr.net/scanner/v1/scan?payload=${payload}`, {
    headers: {
      'X-API-Key': '4f52bd20-ada0-42d9-8dee-bdc02de56840',
    },
  });

  const data: PosMetadata = await response.json();

  if (!data.merchantName) {
    // invalid response, something went wrong
    throw new Error('Failed to fetch POS payload metadata: ' + JSON.stringify(data));
  }

  return data;
};

/** @see https://api.cryptoqr.net/scanner/v1/swagger.yaml */
export type ScanRefundAddress = {
  address_type: 'lightning';
  address: string;
};

/**
 * @see https://moneybadger-qr-scanner.readme.io/reference/scan
 * @see https://api.cryptoqr.net/scanner/v1/swagger.yaml
 */
export type ScanRequest = {
  scan_id: string;
  transaction_id?: string;
  time: string;
  device_id: string;
  user_id: string;
  scan_data: string;
  allowed_payment_methods?: string[];
  payment_currencies?: string[];
  payment_reference?: string;
  refund_address: ScanRefundAddress;
  requested_payment_amount?: {
    currency: string;
    denomination: string;
    amount: number;
  };
};

export type PaymentRequestStatus = 'REQUESTED' | 'AUTHORIZED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'ERRORED';

export type PaymentRequest = {
  id: string;
  created_at: string;
  amount_cents: number;
  currency: string;
  status: PaymentRequestStatus;
  payment_methods: Record<string, string>;
  expiry_time: string;
  merchant_name: string;
  merchant_code: string;
  merchant_category_code: string;
  order_description?: string;
  notification_url?: string;
  merchant_info?: Record<string, unknown>;
};

/**
 * Initiates a scan by posting to the /scanner/v1/scan endpoint
 * @param scanRequest - The scan request parameters
 *
 * @returns A PaymentRequest object
 */
export const initiateScan = async (scanRequest: ScanRequest): Promise<PaymentRequest> => {
  const response = await fetch('https://api.cryptoqr.net/scanner/v1/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': '4f52bd20-ada0-42d9-8dee-bdc02de56840',
    },
    body: JSON.stringify(scanRequest),
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate scan: ${response.status} ${response.statusText}`);
  }

  const data: PaymentRequest = await response.json();
  return data;
};
