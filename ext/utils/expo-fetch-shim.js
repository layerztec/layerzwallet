// Alias expo/fetch to use with @arkade-os/sdk/adapters/expo.
// Must bind: importing { fetch } and calling fetch(url) otherwise throws Illegal invocation.
export const fetch = globalThis.fetch.bind(globalThis);
