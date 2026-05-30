import { randomBytes } from "node:crypto";

import type { ICsprng } from "../mainview/shared-link/types/ICsprng";

export const Csprng: ICsprng = {
  async randomBytes(size: number): Promise<Uint8Array> {
    return new Uint8Array(randomBytes(size));
  },
};
