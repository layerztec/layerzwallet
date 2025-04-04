/**
 * Interface for Cryptographically Secure Pseudo-Random Number Generator
 */
export interface ICsprng {
  /**
   * Generates cryptographically secure random bytes
   * @param size Number of bytes to generate
   * @returns Promise that resolves to a Uint8Array containing the random bytes
   */
  randomBytes(size: number): Promise<Uint8Array>;
}
