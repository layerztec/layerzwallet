import assert from 'assert';
import { generateNewAccount, generateWallet, getStxAddress, Wallet as SdkWallet } from '@stacks/wallet-sdk';
import { createClient } from '@stacks/blockchain-api-client';
import { hexToBytes } from '@stacks/common';
import {
  privateKeyToPublic,
  broadcastTransaction,
  deserializeCV,
  makeContractCall,
  makeSTXTokenTransfer,
  noneCV,
  SignedTokenTransferOptions,
  standardPrincipalCV,
  uintCV,
  validateStacksAddress,
} from '@stacks/transactions';

import { CachedTokenInfo, NftInfo } from '../../types/token-info';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_STACKS } from '../../types/networks';
import { IStorage } from '../../types/IStorage';
import { InterfaceAccountBasedWallet } from './interface-account-based-wallet';
import { InterfaceCanHaveTokens } from './interface-can-have-tokens';
import { uint8ArrayToHex } from '@shared/modules/uint8array-extras';
import { MethodParams, MethodResult } from '@stacks/connect';

const sbtcId = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token';
const baseUrl = 'https://api.mainnet.hiro.so';

const STORAGE_KEY = 'STACKS_TOKEN_METADATA';
const STORAGE_KEY_NFT = 'STACKS_NFT_METADATA_V2';

export class StacksWallet implements InterfaceAccountBasedWallet, InterfaceCanHaveTokens {
  private _accountNumber: number = 0;
  private _sdkWallet: SdkWallet | undefined = undefined;
  private secret: string = '';
  private _tokenBalances: CachedTokenInfo[] = [];
  private _storage: IStorage | undefined = undefined;

  async init(storage: IStorage) {
    assert(this.secret, 'Internal error: cant init Stacks wallet, secret is not set.');

    this._storage = storage;

    // @ts-ignore
    const wallet = await generateWallet({
      secretKey: this.secret,
      // password: '',
    });

    this._sdkWallet = wallet;
  }

  setSecret(seed: string) {
    this.secret = seed;
  }

  setAccountNumber(value: number) {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');

    while (this._sdkWallet.accounts.length < value + 1) {
      this._sdkWallet = generateNewAccount(this._sdkWallet); // adds a new account to an existing wallet object, immutable, NOT in-place
    }

    this._accountNumber = value;
  }

  async getOffchainReceiveAddress(): Promise<string> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');

    const account = this._sdkWallet.accounts[this._accountNumber];

    return getStxAddress({ account, network: 'mainnet' });
  }

  async getPublicKey(): Promise<string> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');

    const account = this._sdkWallet.accounts[this._accountNumber];
    const privkey = account.stxPrivateKey;
    const pk = privateKeyToPublic(privkey);
    if (pk instanceof Uint8Array) {
      return uint8ArrayToHex(pk);
    }
    return pk;
  }

  async callContract(params: MethodParams<'stx_callContract'>): Promise<MethodResult<'stx_callContract'>> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');

    const [contractAddress, contractName] = params.contract.split('.');
    const functionArgs = (params.functionArgs ?? []).map((arg) => {
      if (typeof arg !== 'string') {
        return arg;
      }

      const cleanHex = arg.replace(/^0x/i, '');
      return deserializeCV(hexToBytes(cleanHex));
    });
    const postConditions = (params.postConditions ?? []).map((pc) => {
      if (typeof pc !== 'string') {
        return pc;
      }
      return pc.replace(/^0x/i, '');
    });

    const transaction = await makeContractCall({
      contractAddress,
      contractName: contractName ?? '',
      functionName: params.functionName,

      functionArgs,
      postConditionMode: params.postConditionMode,
      postConditions,
      senderKey: this._sdkWallet.accounts[this._accountNumber].stxPrivateKey,
      network: 'mainnet',
    });

    const txhex = transaction.serialize();

    const broadcastResponse = await broadcastTransaction({ transaction });
    return { txid: broadcastResponse.txid, transaction: txhex };
  }

  public async fetchTokenBalances() {
    const address = await this.getOffchainReceiveAddress();
    assert(address, 'Stacks address is missing');

    const client = createClient({ baseUrl });

    // tokens:
    const { data: ftBalances } = await client.GET('/extended/v2/addresses/{principal}/balances/ft', {
      params: {
        path: { principal: address },
        query: { limit: 100, offset: 0 },
      },
    });

    const tokens: CachedTokenInfo[] = [];
    for (const token of ftBalances?.results || []) {
      const tokenId = token.token.split('::')[0];

      let tokenMetadata: any = undefined;

      const cachedTokenMetadata = await this._storage?.getItem(`${STORAGE_KEY}-${tokenId}`);
      if (cachedTokenMetadata) {
        tokenMetadata = JSON.parse(cachedTokenMetadata) as unknown;
      } else {
        // @ts-ignore
        const response = await client.GET('/metadata/v1/ft/{principal}', {
          params: {
            path: { principal: tokenId },
          },
        });
        tokenMetadata = response.data;

        await this._storage?.setItem(`${STORAGE_KEY}-${tokenId}`, JSON.stringify(tokenMetadata));
      }

      const nameParts = token.token.split('::');
      let nameParsed = nameParts[1] ? nameParts[1].replace('-token', '') : '?';
      if (nameParsed === 'sbtc') nameParsed = 'sBTC';
      tokens.push({
        logoURI: tokenMetadata?.image_uri || undefined,
        id: token.token,
        balance: token.balance,
        chainId: 0, // N/A on stacks
        name: tokenMetadata?.name || nameParsed,
        decimals: tokenMetadata?.decimals || 8,
        symbol: tokenMetadata?.symbol || nameParsed,
      });
    }

    // we treat STX balance as a regular token
    const { data: balance } = await client.GET('/extended/v2/addresses/{principal}/balances/stx', {
      params: {
        path: { principal: address },
      },
    });

    assert(balance, 'Failed to fetch Stacks balance');

    tokens.push({
      logoURI: 'https://static.tildacdn.net/tild6638-6331-4134-b936-386137393566/favicon_6.ico',
      id: 'STX',
      balance: balance.balance,
      name: 'STX',
      chainId: 0, // N/A
      symbol: 'STX',
      decimals: 6,
    });

    this._tokenBalances = tokens;
  }

  public async fetchNfts(): Promise<NftInfo[]> {
    const address = await this.getOffchainReceiveAddress();
    assert(address, 'Stacks address is missing');

    const client = createClient({ baseUrl });

    const { data: nftBalances } = await client.GET('/extended/v1/tokens/nft/holdings', {
      params: {
        query: { limit: 100, offset: 0, principal: address, tx_metadata: false },
      },
    });

    if (!Array.isArray(nftBalances?.results)) {
      throw new Error('Failed to fetch NFTs for Stacks');
    }

    const nfts: NftInfo[] = [];
    for (const token of nftBalances.results || []) {
      const contractAddress = token.asset_identifier.split('::')[0];
      const tokenId = token.value.repr.replace('u', '');

      let tokenMetadata: any = undefined;

      try {
        const cacheKey = `${STORAGE_KEY_NFT}-${contractAddress}-${tokenId}`;
        const cachedTokenMetadata = await this._storage?.getItem(cacheKey);
        if (cachedTokenMetadata) {
          tokenMetadata = JSON.parse(cachedTokenMetadata) as unknown;
        } else {
          const response = await fetch(`https://stacks.gamma.io/api/v1/collections/${contractAddress}/${tokenId}`);
          tokenMetadata = await response.json();
          await this._storage?.setItem(cacheKey, JSON.stringify(tokenMetadata));
        }
      } catch (error) {
        console.error('Failed to fetch NFT metadata from Gamma:', error);
      }

      const name = tokenMetadata?.data?.token_metadata?.name ?? '';
      const image = tokenMetadata?.data?.token_metadata?.image_url ?? '';
      const description = tokenMetadata?.data?.token_metadata?.description ?? '';

      nfts.push({
        contractAddress,
        tokenId,
        collectionName: '',
        name,
        image,
        description,
      });
    }

    return nfts;
  }

  public getTokenBalances() {
    // not showing sBTC as we treat it as native coin
    return this._tokenBalances.filter((t) => t.id !== sbtcId);
  }

  /**
   * returning sBTC balance, which is technically a token, NOT a native balance (STX)
   */
  public async getOffchainBalance(): Promise<number> {
    const address = await this.getOffchainReceiveAddress();
    assert(address, 'Stacks address is missing');

    const client = createClient({ baseUrl });

    // tokens:
    const { data: ftBalances } = await client.GET('/extended/v2/addresses/{principal}/balances/ft', {
      params: {
        path: { principal: address },
        query: { limit: 100, offset: 0 },
      },
    });

    // we treat sBTC token as main balance for this wallet
    for (const token of ftBalances?.results || []) {
      if (token.token === sbtcId) {
        return Number(token.balance);
      }
    }

    return 0;
  }

  /**
   * sending sBTC, not STX
   */
  async pay(address: string, amount: number): Promise<string> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');
    assert(address, 'Recipient address is required');
    assert(Number.isFinite(amount) && amount > 0, 'Amount must be a positive number');

    // Ensure cached sBTC balance is sufficient
    const sbtcTokenId = sbtcId;
    const sbtc = this._tokenBalances.find((t) => t.id === sbtcTokenId);
    assert(sbtc && sbtc.balance != null, 'sBTC token balance is unavailable');
    const available = BigInt(sbtc.balance);
    assert(available >= BigInt(amount), `Insufficient sBTC balance. Have ${available}, need ${BigInt(amount)}`);

    const senderKey = this._sdkWallet.accounts[this._accountNumber].stxPrivateKey;
    const senderAddress = await this.getOffchainReceiveAddress();

    const contractAddress = sbtcId.split('.')[0];
    const contractName = 'sbtc-token';

    const transaction = await makeContractCall({
      contractAddress,
      contractName,
      functionName: 'transfer',
      functionArgs: [uintCV(BigInt(amount)), standardPrincipalCV(senderAddress), standardPrincipalCV(address), noneCV()],
      senderKey,
      network: 'mainnet',
      postConditionMode: 'allow',
    });

    const broadcastResponse: any = await broadcastTransaction({ transaction });

    if (broadcastResponse && typeof broadcastResponse.txid === 'string') {
      return broadcastResponse.txid;
    }

    if (typeof broadcastResponse === 'string') {
      return broadcastResponse;
    }

    throw new Error(`Failed to broadcast sBTC transfer: ${JSON.stringify(broadcastResponse)}`);
  }

  /**
   * sending native coin (STX)
   */
  async payStx(address: string, amount: number, memo?: string): Promise<string> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');

    const txOptions: SignedTokenTransferOptions = {
      recipient: address,
      amount: BigInt(amount),
      senderKey: this._sdkWallet.accounts[this._accountNumber].stxPrivateKey,
      network: 'mainnet',
      memo,
      // nonce: 0n, // set a nonce manually if you don't want builder to fetch from a Stacks node
      // fee: 200n, // set a tx fee if you don't want the builder to estimate
    };

    const transaction = await makeSTXTokenTransfer(txOptions);

    // broadcasting transaction to the specified network
    const broadcastResponse = await broadcastTransaction({ transaction });
    return broadcastResponse.txid;
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');

    const address = await this.getOffchainReceiveAddress();
    assert(address, 'Stacks address is missing');

    const client = createClient({ baseUrl });

    const { data } = await client.GET('/extended/v1/address/{principal}/transactions', {
      params: {
        path: { principal: address },
        query: { limit: 50, offset: 0 },
      },
    });

    const txs: CommonTransaction[] = [];

    for (const tx of (data?.results as any[]) || []) {
      const txid = tx.tx_id as string;
      const statusRaw = (tx.tx_status || tx.execution_status || '').toString();
      const status = statusRaw === 'success' ? 'confirmed' : statusRaw === 'pending' ? 'pending' : statusRaw === 'failed' ? 'failed' : undefined;
      const blockHeight = typeof tx.block_height === 'number' ? tx.block_height : undefined;
      const timestamp = typeof tx.burn_block_time === 'number' ? tx.burn_block_time : Math.floor(Date.now() / 1000);
      const feeNum = tx.fee_rate != null ? Number(tx.fee_rate) : undefined;

      let direction: 'send' | 'receive' | 'swap' | 'other' = 'other';
      let amount: number | undefined = undefined;
      let counterparty: string | undefined = undefined;
      let memo: string | undefined = undefined;

      ////////////////////////////////////// parsing contract call:
      if (tx.contract_call && tx.contract_call.contract_id === sbtcId.split('::')[0]) {
        direction = 'send';
        for (const arg of tx.contract_call.function_args ?? []) {
          if (arg.name === 'amount' && arg.repr) {
            amount = arg.repr.replace('u', '');
          }

          if (arg.name === 'recipient' && arg.repr === address) {
            direction = 'receive';
          }

          if (arg.name === 'recipient' && arg.repr !== address) {
            counterparty = arg.repr;
          }

          if (arg.name === 'sender' && arg.repr !== address) {
            counterparty = arg.repr;
          }
        }
      } else {
        // not sBTC transfer (which we treat as native coin)
        continue;
      }
      ////////////////////////////////////

      txs.push({
        txid,
        network: NETWORK_STACKS,
        timestamp,
        direction,
        amount,
        status,
        fee: feeNum,
        memo,
        confirmations: undefined,
        counterparty,
        blockHeight,
        explorerUrl: `https://explorer.hiro.so/txid/${txid}?chain=mainnet`,
      });
    }

    // newest first
    txs.sort((a, b) => b.timestamp - a.timestamp);

    return txs;
  }

  async transferToken(tokenId: string, amount: bigint, address: string, memo?: string): Promise<string> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');
    assert(address, 'Recipient address is required');
    assert(amount > 0, `Amount must be a positive number (got ${amount})`);

    if (tokenId === 'STX') {
      // its actually a native token
      return this.payStx(address, Number(amount), memo);
    }

    // Ensure cached balance is sufficient
    const tokenBalance = this._tokenBalances.find((t) => t.id === tokenId);
    assert(tokenBalance && tokenBalance.balance != null, 'token balance is unavailable');
    const available = BigInt(tokenBalance.balance);
    assert(available >= BigInt(amount), `Insufficient token balance. Have ${available}, need ${BigInt(amount)}`);

    const senderKey = this._sdkWallet.accounts[this._accountNumber].stxPrivateKey;
    const senderAddress = await this.getOffchainReceiveAddress();

    const contractAddress = tokenId.split('.')[0];
    const contractName = tokenId.split('::')[0].split('.')[1];
    assert(contractName, `Incorrect Stacks contract name for token ${tokenId}`);

    const transaction = await makeContractCall({
      contractAddress,
      contractName,
      functionName: 'transfer',
      functionArgs: [uintCV(BigInt(amount)), standardPrincipalCV(senderAddress), standardPrincipalCV(address), noneCV()],
      senderKey,
      network: 'mainnet',
      postConditionMode: 'allow',
    });

    const broadcastResponse: any = await broadcastTransaction({ transaction });

    if (broadcastResponse && typeof broadcastResponse.txid === 'string') {
      return broadcastResponse.txid;
    }

    if (typeof broadcastResponse === 'string') {
      return broadcastResponse;
    }

    throw new Error(`Failed to broadcast sBTC transfer: ${JSON.stringify(broadcastResponse)}`);
  }

  async transferNFT(nft: NftInfo, address: string): Promise<string> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');
    assert(address, 'Recipient address is required');
    assert(validateStacksAddress(address), 'Recipient address is invalid');

    const [contractAddress, contractName] = nft.contractAddress.split('.');
    assert(contractAddress && contractName, `Incorrect Stacks contract identifier for NFT: ${nft.contractAddress}`);

    const senderKey = this._sdkWallet.accounts[this._accountNumber].stxPrivateKey;
    const senderAddress = await this.getOffchainReceiveAddress();

    // token ids come as strings in our types; ensure we can build a uint CV
    const tokenId = BigInt(nft.tokenId.replace(/^u/, ''));

    // SIP-009 NFTs commonly expose: (transfer (token-id uint) (sender principal) (recipient principal))
    const transaction = await makeContractCall({
      contractAddress,
      contractName,
      functionName: 'transfer',
      functionArgs: [uintCV(tokenId), standardPrincipalCV(senderAddress), standardPrincipalCV(address)],
      senderKey,
      network: 'mainnet',
      postConditionMode: 'allow',
    });

    const broadcastResponse: any = await broadcastTransaction({ transaction });

    if (broadcastResponse && typeof broadcastResponse.txid === 'string') {
      return broadcastResponse.txid;
    }

    if (typeof broadcastResponse === 'string') {
      return broadcastResponse;
    }

    throw new Error(`Failed to broadcast NFT transfer: ${JSON.stringify(broadcastResponse)}`);
  }

  /**
   * Static method to validate Stacks addresses
   * @param address The address to validate
   * @returns true if the address is valid, false otherwise
   */
  static isAddressValid(address: string): boolean {
    try {
      return validateStacksAddress(address);
    } catch (error) {
      return false;
    }
  }
}
