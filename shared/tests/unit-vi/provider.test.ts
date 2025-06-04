import assert from 'assert';
import { vi as jest, beforeEach, afterEach, test } from 'vitest';

import { Provider } from '../../class/provider';
import { ProviderConnectInfo } from '../../types/eip1193';
import { Eip1193CustomEventResponse } from '../../types/eip1193-custom-event';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {
    // nop
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('Provider throws `connect` event', async () => {
  jest.spyOn(document, 'addEventListener').mockImplementation((type: string, cb: any) => {
    assert.strictEqual(type, 'LayerzWalletExtension');
    assert.strictEqual(typeof cb, 'function');
  });
  //////////////////////////////////////////////////////////// end setting up a mock
  const provider = new Provider();
  let connected = false;
  provider.on('connect', (arg: ProviderConnectInfo) => {
    connected = true;
    assert.strictEqual(arg.chainId, '0x1');
  });

  await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for setTimeout inside 'connect'
  assert.ok(connected);
});

test('Provider can request `eth_chainId` and get a response', async () => {
  let listenerRegistered: (message: any) => void;
  jest.spyOn(document, 'addEventListener').mockImplementation((type: string, cb: any) => {
    assert.strictEqual(type, 'LayerzWalletExtension');
    assert.strictEqual(typeof cb, 'function');
    listenerRegistered = cb;
  });

  jest.spyOn(document, 'dispatchEvent').mockImplementation((event: Event): boolean => {
    // @ts-ignore its actually there, dunno why its not in type definitions
    const detail = JSON.parse(event.detail);

    assert.strictEqual(event.type, 'LayerzWalletExtension');
    assert.strictEqual(detail.method, 'eth_chainId');
    assert.strictEqual(detail.for, 'contentScript');
    assert.strictEqual(detail.from, 'localhost'); // supposed to be parsed from hostname of open browser tab but okay
    assert.ok(Number.isInteger(detail.id)); // random each time, just check its present

    // ok we checked that the event with a request was sent to OUTER content script. lets pretend it was processed and
    // the event with a response was emitted - it should land in `listenerRegistered` we saved previously

    listenerRegistered(
      new CustomEvent('LayerzWalletExtension', {
        detail: JSON.stringify({ for: 'webpage', id: detail.id, response: '0x666' } as Eip1193CustomEventResponse),
      })
    );

    // now the Promise for `provider.request()` should be fulfilled

    return true;
  });

  //////////////////////////////////////////////////////////// end setting up a mock

  const provider = new Provider();
  const response = await provider.request({ method: 'eth_chainId' });
  assert.strictEqual(response, '0x666');
});
