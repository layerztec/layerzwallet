export const withRetry = async <T>(fn: () => Promise<T>, maxAttempts: number = 10, backoffMs: number = 1000): Promise<T> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt)); // Exponential backoff
    }
  }
  throw new Error('Should not reach here');
};
