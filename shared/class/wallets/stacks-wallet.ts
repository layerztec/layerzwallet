import assert from 'assert';
import { generateNewAccount, generateWallet, getStxAddress, Wallet as SdkWallet } from '@stacks/wallet-sdk';
import { createClient } from '@stacks/blockchain-api-client';
import { broadcastTransaction, makeContractCall, makeSTXTokenTransfer, noneCV, SignedTokenTransferOptions, standardPrincipalCV, uintCV } from '@stacks/transactions';

import { CachedTokenInfo } from '../../types/token-info';

const sbtcId = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token';

export class StacksWallet {
  private _accountNumber: number = 0;
  private _sdkWallet: SdkWallet | undefined = undefined;
  private secret: string = '';
  private _tokenBalances: CachedTokenInfo[] = [];

  async init() {
    assert(this.secret, 'Internal error: cant init Stacks wallet, secret is not set.');

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

  public async fetchTokenBalances() {
    const address = await this.getOffchainReceiveAddress();
    assert(address, 'Stacks address is missing');

    const client = createClient({ baseUrl: 'https://api.mainnet.hiro.so' });

    // tokens:
    const { data: ftBalances } = await client.GET('/extended/v2/addresses/{principal}/balances/ft', {
      params: {
        path: { principal: address },
        query: { limit: 100, offset: 0 },
      },
    });

    const tokens: CachedTokenInfo[] = [];
    for (const token of ftBalances?.results || []) {
      const nameParts = token.token.split('::');
      let name = nameParts[1] ? nameParts[1].replace('-token', '') : '?';
      if (name === 'sbtc') name = 'sBTC';
      tokens.push({
        id: token.token,
        balance: token.balance,
        chainId: 0, // N/A on stacks
        name,
        decimals: 8, // ???
        symbol: name,
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
      id: 'STX',
      balance: balance.balance,
      name: 'STX',
      chainId: 0, // N/A
      symbol: 'STX',
      decimals: 6,
    });

    this._tokenBalances = tokens;
  }

  public getTokenBalances() {
    // not showing sBTC as we treat it as native coin
    return this._tokenBalances.filter((t) => t.id !== sbtcId);
  }

  /**
   * returning sBTC balance, which is technically a token, NOT a native balance (STX)
   */
  public async getBalance() {
    const address = await this.getOffchainReceiveAddress();
    assert(address, 'Stacks address is missing');

    const client = createClient({
      baseUrl: 'https://api.mainnet.hiro.so', // or 'https://api.testnet.hiro.so' for testnet
    });

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
        return token.balance;
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
  async payStx(address: string, amount: number): Promise<string> {
    assert(this._sdkWallet, 'Stacks wallet is not initialized');
    assert(this._sdkWallet.accounts[this._accountNumber], 'Stacks account not found');

    const txOptions: SignedTokenTransferOptions = {
      recipient: address,
      amount: BigInt(amount),
      senderKey: this._sdkWallet.accounts[this._accountNumber].stxPrivateKey,
      network: 'mainnet',
      // memo: '',
      // nonce: 0n, // set a nonce manually if you don't want builder to fetch from a Stacks node
      // fee: 200n, // set a tx fee if you don't want the builder to estimate
    };

    const transaction = await makeSTXTokenTransfer(txOptions);

    // broadcasting transaction to the specified network
    const broadcastResponse = await broadcastTransaction({ transaction });
    return broadcastResponse.txid;
  }
}
