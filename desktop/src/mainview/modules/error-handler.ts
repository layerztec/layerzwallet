export const handleError = async function (
  _error: unknown,
  _context: string = "unknown",
): Promise<void> {};

globalThis.handleError = handleError;
