import type { IRgbWallet } from '../types/rgb-adapter';

/**
 * Present an SDK `UTEXOWallet` facade as the `IRgbWallet` the shared code
 * speaks: `overrides` replace or add members (old method names, cloud-backup
 * shims), everything else passes straight through to the facade.
 *
 * Two facade details make a naive `Reflect.get(target, prop, receiver)` break:
 *  - it keeps its engine in a `#private` field, so a getter (`protocol`,
 *    `capabilities`) or prototype method run with `this` = proxy throws a
 *    TypeError — read on the wallet itself and bind prototype methods to it;
 *  - engine extensions (`exportBackupToFile`, `getBfaCapabilities`, …) are
 *    read-only, non-configurable own properties, and a Proxy must return
 *    exactly such a property's value — they are closures already, so they are
 *    returned untouched (and cannot be overridden).
 */
export function proxyRgbFacade(wallet: object, overrides: Record<string, unknown>): IRgbWallet {
  return new Proxy(wallet as IRgbWallet, {
    get(target, prop) {
      if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(overrides, prop)) return overrides[prop];
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function' || Object.prototype.hasOwnProperty.call(target, prop)) return value;
      return value.bind(target);
    },
  });
}
