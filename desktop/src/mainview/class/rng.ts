import { ICsprng } from '@shared/types/ICsprng';

export const Csprng: ICsprng = {
  async randomBytes(size: number): Promise<Uint8Array> {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  },
};
