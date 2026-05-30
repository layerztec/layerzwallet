import { capitalizeFirstLetter } from "@shared/modules/string-utils";
import { Networks } from "@shared/types/networks";

import { getNetworkImageUrl } from "../utils/network-assets";

type NetworkDropdownLabelProps = {
  network: Networks;
};

export function NetworkDropdownLabel({ network }: NetworkDropdownLabelProps) {
  const iconUrl = getNetworkImageUrl(network);

  return (
    <span className="dropdown-network-option">
      {iconUrl ? (
        <span className="dropdown-network-option-icon" aria-hidden>
          <img src={iconUrl} alt="" />
        </span>
      ) : null}
      <span className="dropdown-network-option-label">
        {capitalizeFirstLetter(network)}
      </span>
    </span>
  );
}
