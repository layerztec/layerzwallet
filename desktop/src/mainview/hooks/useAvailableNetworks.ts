import { useMemo } from "react";

import { useAvailableNetworks as useSharedAvailableNetworks } from "@shared/hooks/useAvailableNetworks";
import { Networks } from "@shared/types/networks";

import { isDesktopOmittedNetwork } from "../utils/desktop-networks";

export function useAvailableNetworks(): Networks[] {
  const networks = useSharedAvailableNetworks();
  return useMemo(
    () => networks.filter((n) => !isDesktopOmittedNetwork(n)),
    [networks],
  );
}
