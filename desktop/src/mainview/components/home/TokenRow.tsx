import React, { memo, useContext, useEffect } from "react";

import { AccountNumberContext } from "@shared/hooks/AccountNumberContext";
import { NetworkContext } from "@shared/hooks/NetworkContext";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useTokenExchangeRate } from "@shared/hooks/useTokenExchangeRate";
import { getTokenIconColor } from "@shared/models/token-list";
import { formatBalance, formatFiatBalance } from "@shared/modules/string-utils";
import { CachedTokenInfo } from "@shared/types/token-info";

import { BackgroundCaller } from "../../modules/background-caller";

import "./HomeSections.css";

const LOCAL_TOKEN_ICONS: Record<string, string> = {
  USDT: "https://tether.to/images/tetherTokenWhite.svg",
  "USD₮0": "https://tether.to/images/tetherTokenWhite.svg",
};

type TokenRowProps = {
  token: CachedTokenInfo;
  onPress?: (token: CachedTokenInfo) => void;
  selected?: boolean;
  onVisible?: (isVisible: boolean) => void;
};

export const TokenRow = memo(
  ({ token, onPress, selected, onVisible }: TokenRowProps) => {
    const { network } = useContext(NetworkContext);
    const { accountNumber } = useContext(AccountNumberContext);
    const { balance } = useTokenBalance(
      network,
      accountNumber,
      token.id,
      BackgroundCaller,
    );
    const { tokenExchangeRate } = useTokenExchangeRate(
      network,
      token.id,
      "USD",
    );

    const effectiveBalance = balance ?? token.balance ?? "0";
    let decimalPlaces = token.decimals;
    if (token.name.includes("USD")) {
      decimalPlaces = 2;
    }
    const formattedBalance = formatBalance(
      effectiveBalance,
      token.decimals,
      Math.min(decimalPlaces, 8),
    );
    const hasBalance = +formattedBalance > 0;

    useEffect(() => {
      onVisible?.(hasBalance);
    }, [hasBalance, onVisible]);

    if (!hasBalance) {
      return null;
    }

    const iconColor = getTokenIconColor(token?.name);
    const localIcon =
      LOCAL_TOKEN_ICONS[token?.symbol?.toUpperCase()] ||
      LOCAL_TOKEN_ICONS[token?.name?.toUpperCase()];
    const fiatLabel =
      balance && tokenExchangeRate && tokenExchangeRate > 0
        ? "$" + formatFiatBalance(balance, token.decimals, tokenExchangeRate)
        : null;

    const RowTag = onPress ? "button" : "div";

    return (
      <RowTag
        type={onPress ? "button" : undefined}
        className={[
          "home-token-row",
          onPress ? "home-token-row--clickable" : "",
          selected ? "home-token-row--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onPress ? () => onPress(token) : undefined}
        data-testid={`token-row-${token.id}`}
      >
        <div className="home-token-icon" style={{ backgroundColor: iconColor }}>
          {localIcon ? (
            <img src={localIcon} alt="" />
          ) : token.logoURI ? (
            <img src={token.logoURI} alt="" />
          ) : (
            <span className="home-token-icon-fallback">
              {token?.symbol?.charAt(0) || "?"}
            </span>
          )}
        </div>
        <span className="home-token-name">{token?.name}</span>
        <div className="home-token-amounts">
          <span
            className="home-token-amount"
            data-testid={`token-amount-${token.id}`}
          >
            <span className="home-token-balance">{formattedBalance}</span>
            <span className="home-token-symbol">{token?.symbol}</span>
          </span>
          <span className="home-token-price">{fiatLabel}</span>
        </div>
      </RowTag>
    );
  },
);

TokenRow.displayName = "TokenRow";
