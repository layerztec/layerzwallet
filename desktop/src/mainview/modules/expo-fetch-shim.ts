// @arkade-os/sdk/adapters/expo imports { fetch } and calls it as fetch(url, init).
// Exporting globalThis.fetch directly loses the Window `this` binding in browsers/CEF.
export const fetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);
