import * as bip21 from 'bip21';
import * as bolt11 from 'bolt11';
import * as bitcoin from 'bitcoinjs-lib';
import type { Router } from 'expo-router';
import { NETWORK_SPARK } from '@shared/types/networks';
import { SendLightningProps } from '@/app/SendLightning';
import { SendBtcParams } from '@/app/SendBtc';
import { PosMerchantParams } from '@/app/PosMerchant';
import { convertMerchantQRToLightningAddress } from '@shared/modules/merchants';

type LightningIntent = {
  type: 'lightning';
  invoice: string;
  raw: string;
  hint?: 'bolt11' | 'lnurl' | 'ln-address' | 'bip21';
};

type PosMerchantIntent = {
  type: 'posMerchant';
  raw: string;
};

type BitcoinIntent = {
  type: 'bitcoin';
  address: string;
  amount?: string;
  raw: string;
  hint?: 'bip21';
};

type UnknownIntent = {
  type: 'unknown';
  raw: string;
  reason?: string;
};

export type QrIntent = LightningIntent | BitcoinIntent | PosMerchantIntent | UnknownIntent;

const LIGHTNING_PREFIX_REGEX = /^lightning:/i;

const LIGHTNING_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LNURL_REGEX = /^lnurl[a-z0-9]+$/i;

function sanitizeInput(raw: string): string {
  return raw.trim();
}

function extractLightningCandidate(raw: string): string {
  return raw.replace(LIGHTNING_PREFIX_REGEX, '').trim();
}

function isBolt11Invoice(candidate: string): boolean {
  if (!candidate || candidate.length < 5) {
    return false;
  }

  const lower = candidate.toLowerCase();
  if (!lower.startsWith('ln')) {
    return false;
  }

  try {
    bolt11.decode(candidate);
    return true;
  } catch {
    return false;
  }
}

function isValidBitcoinAddress(address: string): boolean {
  try {
    bitcoin.address.toOutputScript(address.trim());
    return true;
  } catch {}
  return false;
}

function detectLightningIntent(raw: string): LightningIntent | undefined {
  const candidate = extractLightningCandidate(raw);

  if (isBolt11Invoice(candidate)) {
    return { type: 'lightning', invoice: candidate, raw, hint: 'bolt11' };
  }

  if (LNURL_REGEX.test(candidate) || LIGHTNING_ADDRESS_REGEX.test(candidate)) {
    const isLnurl = LNURL_REGEX.test(candidate);
    return { type: 'lightning', invoice: candidate, raw, hint: isLnurl ? 'lnurl' : 'ln-address' };
  }

  return undefined;
}

function detectPosMerchantIntent(raw: string): PosMerchantIntent | undefined {
  const merchantResult = convertMerchantQRToLightningAddress({ qrContent: raw, network: 'mainnet' });

  if (merchantResult) {
    return { type: 'posMerchant', raw };
  }

  return undefined;
}

type Bip21Intent = BitcoinIntent | LightningIntent;

function detectBitcoinIntent(raw: string): Bip21Intent | undefined {
  const sanitized = sanitizeInput(raw);

  const withScheme = sanitized.toLowerCase().startsWith('bitcoin:') ? sanitized : `bitcoin:${sanitized}`;

  try {
    const decoded = bip21.decode(withScheme);

    // @ts-ignore `.lightning` not defined in bip21 but widely used
    if (decoded?.options?.lightning && typeof decoded.options.lightning === 'string') {
      // @ts-ignore `.lightning` not defined in bip21 but widely used
      return { type: 'lightning', invoice: decoded.options.lightning, raw, hint: 'bip21' };
    }

    if (decoded?.address && isValidBitcoinAddress(decoded.address)) {
      const rawAmount = decoded.options?.amount;
      const amount = typeof rawAmount === 'string' ? rawAmount : typeof rawAmount === 'number' ? String(rawAmount) : undefined;
      return {
        type: 'bitcoin',
        address: decoded.address,
        amount,
        raw,
        hint: 'bip21',
      };
    }
  } catch {
    // ignore decode failures
  }

  return undefined;
}

export function parseQrIntent(rawInput: string): QrIntent {
  const raw = sanitizeInput(rawInput);

  if (!raw) {
    return { type: 'unknown', raw, reason: 'empty' };
  }

  const lightningIntent = detectLightningIntent(raw);
  if (lightningIntent) {
    return lightningIntent;
  }

  const posMerchantIntent = detectPosMerchantIntent(raw);
  if (posMerchantIntent) {
    return posMerchantIntent;
  }

  const bitcoinIntent = detectBitcoinIntent(raw);
  if (bitcoinIntent) {
    return bitcoinIntent;
  }

  return { type: 'unknown', raw };
}

export function handleQrIntent(rawInput: string, router: Pick<Router, 'push'>): boolean {
  const intent = parseQrIntent(rawInput);

  switch (intent.type) {
    case 'lightning': {
      const params: SendLightningProps = { network: NETWORK_SPARK, invoice: intent.invoice };
      router.push({ pathname: '/SendLightning', params });
      return true;
    }

    case 'bitcoin': {
      const params: SendBtcParams = { toAddress: intent.address };
      if (intent.amount) {
        params.amount = intent.amount;
      }

      router.push({ pathname: '/SendBtc', params });
      return true;
    }

    case 'posMerchant': {
      const params: PosMerchantParams = { raw: intent.raw };
      router.push({ pathname: '/PosMerchant', params });
      return true;
    }

    case 'unknown':
    default: {
      return false;
    }
  }
}
