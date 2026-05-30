import React from "react";

import { Networks } from "@shared/types/networks";
import { getNetworkImageUrl } from "../utils/network-assets";

import "./ActionPopupAction.css";

/** Web port of mobile `Action` rows inside action popups. */
export const ActionPopupAction: React.FC<{
  network?: Networks;
  text: string;
  testID?: string;
}> = ({ network, text, testID }) => {
  const iconUrl = network ? getNetworkImageUrl(network) : null;

  return (
    <div className="action-popup-action" data-testid={testID}>
      {iconUrl ? (
        <span className="action-popup-action-icon" aria-hidden>
          <img src={iconUrl} alt="" />
        </span>
      ) : null}
      <span className="action-popup-action-text">{text}</span>
    </div>
  );
};
