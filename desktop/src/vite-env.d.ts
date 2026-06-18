/// <reference types="vite/client" />

// Vite resolves asset imports (e.g. the network/onboarding PNGs pulled from ../mobile/assets) to a URL string at build time.
declare module '*.png' {
  const src: string;
  export default src;
}

// `three` is an optional transitive of electrobun's bundler that we never use; silence its missing types.
declare module 'three';
