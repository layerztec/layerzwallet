// vm is not available in the renderer; avoid pulling in vm-browserify (uses CommonJS `exports`).
export function runInNewContext() {
  throw new Error('vm is not available in the desktop renderer');
}

export function runInThisContext() {
  throw new Error('vm is not available in the desktop renderer');
}

export function createContext() {
  throw new Error('vm is not available in the desktop renderer');
}

const vm = {
  runInNewContext,
  runInThisContext,
  createContext,
};

export default vm;
