import assert from 'assert';
import { generateNewAccount, generateWallet, getStxAddress, Wallet as SdkWallet } from '@stacks/wallet-sdk';
import { createClient } from '@stacks/blockchain-api-client';
import { CachedTokenInfo } from '../../types/token-info';

export class StacksWallet {
  private _accountNumber: number = 0;
  private _sdkWallet: SdkWallet | undefined = undefined;
  private secret: string = '';
  private _tokenBalances: CachedTokenInfo[] = [];

  async init() {
    assert(this.secret, 'Internal error: cant init Spark wallet, secret is not set.');

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
    return this._tokenBalances;
  }

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
      if (token.token === 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token') {
        return token.balance;
      }
    }

    return 0;
  }
}
