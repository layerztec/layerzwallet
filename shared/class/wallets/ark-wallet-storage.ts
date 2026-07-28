import type { ArkTransaction, ExtendedCoin, ExtendedVirtualCoin } from '@arkade-os/sdk';
import { hex } from '@scure/base';
import { TaprootControlBlock } from '@scure/btc-signer';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

type TapLeafTuple = ExtendedVirtualCoin['forfeitTapLeafScript'];
type StoredTapLeaf = { cb: string; s: string };

type StoredAsset = { assetId: string; amount: string | number | bigint };

/** JSON-safe vtxo row persisted in app storage (matches @arkade-os/sdk repository shape). */
export type StoredVtxo = Omit<ExtendedVirtualCoin, 'createdAt' | 'tapTree' | 'forfeitTapLeafScript' | 'intentTapLeafScript' | 'extraWitness' | 'assets'> & {
  createdAt: string | number;
  tapTree: string;
  forfeitTapLeafScript: StoredTapLeaf;
  intentTapLeafScript: StoredTapLeaf;
  extraWitness?: string[];
  assets?: StoredAsset[];
};

export type StoredUtxo = Omit<ExtendedCoin, 'tapTree' | 'forfeitTapLeafScript' | 'intentTapLeafScript' | 'extraWitness'> & {
  tapTree: string;
  forfeitTapLeafScript: StoredTapLeaf;
  intentTapLeafScript: StoredTapLeaf;
  extraWitness?: string[];
};

export const serializeTapLeaf = ([cb, s]: TapLeafTuple): StoredTapLeaf => ({
  cb: hex.encode(TaprootControlBlock.encode(cb)),
  s: hex.encode(s),
});

export const deserializeTapLeaf = (t: StoredTapLeaf): TapLeafTuple => {
  const cb = TaprootControlBlock.decode(hex.decode(t.cb));
  const s = hex.decode(t.s);
  return [cb, s];
};

const serializeAsset = (a: { assetId: string; amount: bigint }) => ({
  assetId: a.assetId,
  amount: a.amount.toString(),
});

const deserializeAsset = (a: StoredAsset) => {
  if (typeof a.amount === 'number' && !Number.isSafeInteger(a.amount)) {
    throw new Error(`Unsafe legacy asset amount for ${a.assetId}`);
  }
  // digits only: BigInt('') is 0n, so a truncated write would otherwise become a silent zero balance
  if (typeof a.amount === 'string' && !/^\d+$/.test(a.amount)) {
    throw new Error(`Malformed asset amount for ${a.assetId}`);
  }
  return {
    assetId: a.assetId,
    amount: typeof a.amount === 'bigint' ? a.amount : BigInt(a.amount),
  };
};

export const serializeVtxo = (v: ExtendedVirtualCoin): StoredVtxo => ({
  ...v,
  createdAt: v.createdAt.getTime(),
  tapTree: hex.encode(v.tapTree),
  forfeitTapLeafScript: serializeTapLeaf(v.forfeitTapLeafScript),
  intentTapLeafScript: serializeTapLeaf(v.intentTapLeafScript),
  extraWitness: v.extraWitness?.map((w) => hex.encode(w)),
  assets: v.assets?.map(serializeAsset),
});

export const serializeUtxo = (u: ExtendedCoin): StoredUtxo => ({
  ...u,
  tapTree: hex.encode(u.tapTree),
  forfeitTapLeafScript: serializeTapLeaf(u.forfeitTapLeafScript),
  intentTapLeafScript: serializeTapLeaf(u.intentTapLeafScript),
  extraWitness: u.extraWitness?.map((w) => hex.encode(w)),
});

export const serializeTransaction = (t: ArkTransaction) => ({
  ...t,
  assets: t.assets?.map(serializeAsset),
});

export const deserializeVtxo = (o: StoredVtxo): ExtendedVirtualCoin => ({
  ...o,
  createdAt: new Date(o.createdAt),
  tapTree: hex.decode(o.tapTree),
  forfeitTapLeafScript: deserializeTapLeaf(o.forfeitTapLeafScript),
  intentTapLeafScript: deserializeTapLeaf(o.intentTapLeafScript),
  extraWitness: o.extraWitness?.map((w) => hex.decode(w)),
  assets: o.assets?.map(deserializeAsset),
});

export const deserializeUtxo = (o: StoredUtxo): ExtendedCoin => ({
  ...o,
  tapTree: hex.decode(o.tapTree),
  forfeitTapLeafScript: deserializeTapLeaf(o.forfeitTapLeafScript),
  intentTapLeafScript: deserializeTapLeaf(o.intentTapLeafScript),
  extraWitness: o.extraWitness?.map((w) => hex.decode(w)),
});

export const deserializeTransaction = (o: ArkTransaction & { assets?: StoredAsset[] }) => ({
  ...o,
  assets: o.assets?.map(deserializeAsset),
});

/** Coerce legacy plain-JSON Uint8Array (numeric-key object) into bytes. */
export const coerceUint8Array = (value: unknown): Uint8Array | undefined => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    try {
      return hexToBytes(value);
    } catch {
      return undefined;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, number>;
  const indices = Object.keys(record)
    .filter((k) => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);
  if (indices.length === 0) return undefined;

  return Uint8Array.from(indices.map((i) => record[String(i)]));
};

const isStoredTapLeaf = (value: unknown): value is StoredTapLeaf =>
  !!value && typeof value === 'object' && typeof (value as StoredTapLeaf).cb === 'string' && typeof (value as StoredTapLeaf).s === 'string';

/**
 * Best-effort conversion of pre-fix persisted vtxo rows (plain JSON) into the stored
 * shape the SDK deserializer expects. Returns undefined when the row is too corrupt.
 */
export const coerceStoredVtxo = (raw: unknown): StoredVtxo | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;

  const tapTreeBytes = coerceUint8Array(row.tapTree);
  if (!tapTreeBytes) return undefined;

  let forfeit = row.forfeitTapLeafScript;
  let intent = row.intentTapLeafScript;

  // Legacy codec tagged tap leaf script bytes but left control block as a plain object
  if (Array.isArray(forfeit) && forfeit.length === 2) {
    const scriptBytes = coerceUint8Array(forfeit[1]);
    const cb = forfeit[0];
    if (scriptBytes && cb && typeof cb === 'object' && 'internalKey' in (cb as object)) {
      try {
        const internalKey = coerceUint8Array((cb as { internalKey: unknown }).internalKey);
        const merklePath = ((cb as { merklePath?: unknown[] }).merklePath ?? []).map((p) => coerceUint8Array(p)).filter((p): p is Uint8Array => !!p);
        if (!internalKey) return undefined;
        forfeit = serializeTapLeaf([{ version: (cb as { version?: number }).version ?? 192, internalKey, merklePath }, scriptBytes]);
      } catch {
        return undefined;
      }
    }
  }

  if (Array.isArray(intent) && intent.length === 2) {
    const scriptBytes = coerceUint8Array(intent[1]);
    const cb = intent[0];
    if (scriptBytes && cb && typeof cb === 'object' && 'internalKey' in (cb as object)) {
      try {
        const internalKey = coerceUint8Array((cb as { internalKey: unknown }).internalKey);
        const merklePath = ((cb as { merklePath?: unknown[] }).merklePath ?? []).map((p) => coerceUint8Array(p)).filter((p): p is Uint8Array => !!p);
        if (!internalKey) return undefined;
        intent = serializeTapLeaf([{ version: (cb as { version?: number }).version ?? 192, internalKey, merklePath }, scriptBytes]);
      } catch {
        return undefined;
      }
    }
  }

  if (!isStoredTapLeaf(forfeit) || !isStoredTapLeaf(intent)) return undefined;

  let createdAt: string | number;
  if (row.createdAt instanceof Date) createdAt = row.createdAt.getTime();
  else if (typeof row.createdAt === 'string' || typeof row.createdAt === 'number') createdAt = row.createdAt;
  else return undefined;

  const assets = Array.isArray(row.assets)
    ? row.assets.map((a) => {
        const asset = a as StoredAsset;
        return {
          assetId: asset.assetId,
          amount: typeof asset.amount === 'bigint' ? asset.amount.toString() : asset.amount,
        };
      })
    : undefined;

  const extraWitness = Array.isArray(row.extraWitness)
    ? row.extraWitness
        .map((w) => {
          const bytes = coerceUint8Array(w);
          return bytes ? bytesToHex(bytes) : typeof w === 'string' ? w : undefined;
        })
        .filter((w): w is string => typeof w === 'string')
    : undefined;

  return {
    ...(row as Omit<StoredVtxo, 'createdAt' | 'tapTree' | 'forfeitTapLeafScript' | 'intentTapLeafScript' | 'extraWitness' | 'assets'>),
    createdAt,
    tapTree: bytesToHex(tapTreeBytes),
    forfeitTapLeafScript: forfeit,
    intentTapLeafScript: intent,
    extraWitness,
    assets,
  };
};

export const parseStoredVtxoList = (raw: string): ExtendedVirtualCoin[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  const vtxos: ExtendedVirtualCoin[] = [];
  for (const entry of parsed) {
    try {
      if (isStoredTapLeaf((entry as StoredVtxo)?.forfeitTapLeafScript)) {
        vtxos.push(deserializeVtxo(entry as StoredVtxo));
        continue;
      }
      const coerced = coerceStoredVtxo(entry);
      if (coerced) vtxos.push(deserializeVtxo(coerced));
    } catch (error) {
      console.warn('ARK storage: skipping corrupt vtxo row', (entry as { txid?: string })?.txid, error);
    }
  }
  return vtxos;
};

export const parseStoredUtxoList = (raw: string): ExtendedCoin[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  const utxos: ExtendedCoin[] = [];
  for (const entry of parsed) {
    try {
      if (isStoredTapLeaf((entry as StoredUtxo)?.forfeitTapLeafScript)) {
        utxos.push(deserializeUtxo(entry as StoredUtxo));
        continue;
      }
      const row = entry as Record<string, unknown>;
      const tapTreeBytes = coerceUint8Array(row.tapTree);
      if (!tapTreeBytes) continue;
      let forfeit = row.forfeitTapLeafScript;
      let intent = row.intentTapLeafScript;
      if (Array.isArray(forfeit) && forfeit.length === 2) {
        const scriptBytes = coerceUint8Array(forfeit[1]);
        const cb = forfeit[0];
        if (scriptBytes && cb && typeof cb === 'object' && 'internalKey' in (cb as object)) {
          const internalKey = coerceUint8Array((cb as { internalKey: unknown }).internalKey);
          const merklePath = ((cb as { merklePath?: unknown[] }).merklePath ?? []).map((p) => coerceUint8Array(p)).filter((p): p is Uint8Array => !!p);
          if (internalKey) {
            forfeit = serializeTapLeaf([{ version: (cb as { version?: number }).version ?? 192, internalKey, merklePath }, scriptBytes]);
          }
        }
      }
      if (Array.isArray(intent) && intent.length === 2) {
        const scriptBytes = coerceUint8Array(intent[1]);
        const cb = intent[0];
        if (scriptBytes && cb && typeof cb === 'object' && 'internalKey' in (cb as object)) {
          const internalKey = coerceUint8Array((cb as { internalKey: unknown }).internalKey);
          const merklePath = ((cb as { merklePath?: unknown[] }).merklePath ?? []).map((p) => coerceUint8Array(p)).filter((p): p is Uint8Array => !!p);
          if (internalKey) {
            intent = serializeTapLeaf([{ version: (cb as { version?: number }).version ?? 192, internalKey, merklePath }, scriptBytes]);
          }
        }
      }
      if (!isStoredTapLeaf(forfeit) || !isStoredTapLeaf(intent)) continue;
      utxos.push(
        deserializeUtxo({
          ...(row as Omit<StoredUtxo, 'tapTree' | 'forfeitTapLeafScript' | 'intentTapLeafScript'>),
          tapTree: bytesToHex(tapTreeBytes),
          forfeitTapLeafScript: forfeit,
          intentTapLeafScript: intent,
        })
      );
    } catch (error) {
      console.warn('ARK storage: skipping corrupt utxo row', (entry as { txid?: string })?.txid, error);
    }
  }
  return utxos;
};

export const stringifyVtxoList = (vtxos: ExtendedVirtualCoin[]): string => JSON.stringify(vtxos.map(serializeVtxo));

export const stringifyUtxoList = (utxos: ExtendedCoin[]): string => JSON.stringify(utxos.map(serializeUtxo));

export const parseStoredTransactionList = (raw: string): ArkTransaction[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  const txs: ArkTransaction[] = [];
  for (const entry of parsed) {
    const row = entry as ArkTransaction & { assets?: StoredAsset[] };
    try {
      // downstream code addresses transactions by tx.key, so a row without one is unusable
      if (!row?.key || typeof row.key !== 'object' || Array.isArray(row.key)) {
        console.warn('ARK storage: skipping malformed transaction row');
        continue;
      }
      txs.push(deserializeTransaction(row));
    } catch (error) {
      console.warn('ARK storage: skipping corrupt transaction row', row?.key?.arkTxid, error);
    }
  }
  return txs;
};

export const stringifyTransactionList = (txs: ArkTransaction[]): string => JSON.stringify(txs.map(serializeTransaction));
