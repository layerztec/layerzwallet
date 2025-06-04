import { Address, MetaMaskProvider, ProviderConnectInfo, ProviderMessage, ProviderRpcError, RequestArguments } from '../types/eip1193';
import { Eip1193CustomEventCallback, Eip1193CustomEventRequest, Eip1193CustomEventResponse } from '../types/eip1193-custom-event';

type Listener =
  | ((info: ProviderConnectInfo) => void)
  | ((error: ProviderRpcError) => void)
  | ((error: Error) => void)
  | ((chainId: string) => void)
  | ((networkId: string) => void)
  | ((accounts: Address[]) => void)
  | ((message: ProviderMessage) => void)
  | ((payload: ProviderMessage) => void)
  | ((...args: unknown[]) => void);

interface CallbacksHashmap {
  [dynamicKey: string]: Listener[]; // there can be more than one subscriber to an event
}

/**
 * @see https://eips.ethereum.org/EIPS/eip-1193
 * @see https://eips.ethereum.org/EIPS/eip-6963
 * @see https://docs.metamask.io/wallet/reference/provider-api/
 */
export class Provider implements MetaMaskProvider {
  private _chainId = '0x1';
  private _eventSubscriptions: CallbacksHashmap = {};
  private _requestId = 0;

  private async backgroundRPC(args: RequestArguments): Promise<unknown> {
    const id = this._requestId++;
    return new Promise((resolve, reject) => {
      // setting up a listener for events and waiting for a response for OUR event from content script
      document.addEventListener('LayerzWalletExtension', function (e) {
        // @ts-ignore e.detail actually exists
        const event = JSON.parse(e.detail) as Eip1193CustomEventResponse;

        if (event.for !== 'webpage' || event.id !== id) {
          return; // ignoring
        }

        if (event.error) {
          console.log('rejecting promise.................. error=', event.error);
          reject(event.error);
          return;
        }

        console.log('resolving promise.................. response=', event.response);
        resolve(event.response);
      });

      // sending the event, it should be received by OUR CONTENT SCRIPT...
      document.dispatchEvent(
        new CustomEvent('LayerzWalletExtension', {
          // stringifying for better compatibility with firefox (avoids some security violation)
          detail: JSON.stringify({ ...args, for: 'contentScript', id, from: window.location.hostname } as Eip1193CustomEventRequest),
        })
      );
    });
  }

  // @ts-ignore some ts bullshit
  request(args: RequestArguments): Promise<unknown> {
    return this.backgroundRPC(args);
  }

  constructor() {
    const that = this;
    console.log('setting up a listener for callback events::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::');
    document.addEventListener('LayerzWalletExtension', function (e) {
      // @ts-ignore e.detail actually exists
      const event = JSON.parse(e.detail) as Eip1193CustomEventCallback;

      if (event.type !== 'eventCallback') {
        return; // these are not the droids you are looking for
      }

      console.log('got event callback!', event);

      const callbacks = that._eventSubscriptions[event.event] ?? [];
      console.log('we have', callbacks.length, 'to notify');
      for (const cb of callbacks) {
        console.log('actually triggering the callback with the event payload');
        cb(event.arg);
      }
    });
  }

  on(event: 'connect' | 'disconnect' | 'close' | 'chainChanged' | 'networkChanged' | 'accountsChanged' | 'message' | 'notification', listener: Listener): this {
    console.log('Dapp subscribes to an event', event);

    if (event === 'connect') {
      // throwing event back on the spot since we are kind of connected
      // @ts-ignore
      setTimeout(() => listener({ chainId: this._chainId } as ProviderConnectInfo), 1000);
      return this;
    }

    this._eventSubscriptions[event] = this._eventSubscriptions[event] || [];
    this._eventSubscriptions[event].push(listener);
    return this;
  }

  removeListener() {
    // TODO
  }

  // @ts-ignore
  send(arg: { method: string; params: any }, arg2?: any): unknown {
    if (arg.method) {
      return this.request(arg);
    }

    if (typeof arg === 'string') {
      return this.request({ method: arg, params: arg2 });
    }

    return undefined;
  }

  sendAsync(request: object, callback: Function): void {}

  _metamask = {
    isUnlocked: function () {
      return Promise.resolve(true);
    },
  };

  get chainId(): string {
    return this._chainId;
  }

  isMetaMask: true = true;
  networkVersion: string = '?';
  selectedAddress: string = '???';

  enable(): Promise<string[]> {
    alert('enable');
    return Promise.resolve([]);
  }

  isConnected(): boolean {
    return true;
  }

  /**
   * having the following members makes injected provider a bit more discoverable by older Dapps that
   * are searching for metamask
   */
  _events = {};
  _eventsCount = 0;
  _maxListeners = 0;
  _log = {};
  _state = {};
  _handleAccountsChanged = () => {};
  _handleConnect = () => {};
  _handleChainChanged = () => {};
  _handleDisconnect = () => {};
  _handleUnlockStateChanged = () => {};
  _rpcRequest = () => {};
  _rpcEngine = {};
  _handleStreamDisconnect = () => {};
  _jsonRpcConnection = {};
  _sentWarnings = {};
  _sendSync = () => {};
  _warnOfDeprecation = () => {};
}
