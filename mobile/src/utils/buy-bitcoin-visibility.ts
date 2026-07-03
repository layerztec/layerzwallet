export const IFCONFIG_CO_JSON_URL = 'https://ifconfig.co/json';
export const GB_COUNTRY_CODE = 'GB';

export interface IfconfigCoJson {
  country_iso?: string;
}

export function isBuyBitcoinVisibleForCountry(countryCode: string | undefined): boolean {
  if (!countryCode) {
    return false;
  }

  return countryCode.toUpperCase() !== GB_COUNTRY_CODE;
}

export async function fetchBuyBitcoinVisible(): Promise<boolean> {
  const response = await fetch(IFCONFIG_CO_JSON_URL, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as IfconfigCoJson;
  return isBuyBitcoinVisibleForCountry(data.country_iso);
}
