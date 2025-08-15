/**
 * Sleep for a given number of milliseconds
 * @param ms - The number of milliseconds to sleep
 * @returns A promise that resolves after the given number of milliseconds
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
