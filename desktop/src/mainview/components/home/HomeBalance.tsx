import React, { useContext, useMemo } from "react";

import { NetworkContext } from "@shared/hooks/NetworkContext";
import { AccountNumberContext } from "@shared/hooks/AccountNumberContext";
import { useBalance } from "@shared/hooks/useBalance";
import { useExchangeRate } from "@shared/hooks/useExchangeRate";
import {
  getDecimalsByNetwork,
  getIsTestnet,
  getTickerByNetwork,
} from "@shared/models/network-getters";
import { formatBalance, formatFiatBalance } from "@shared/modules/string-utils";
import { ThemedText } from "../ThemedText";
import { BackgroundCaller } from "../../modules/background-caller";

/** Mobile-style centered balance block for the home screen. */
export const HomeBalance: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);
  const { exchangeRate } = useExchangeRate(network, "USD");
  const ticker = getTickerByNetwork(network);

  const [displayBalance, displaySubBalance] = useMemo(() => {
    const decimals = getDecimalsByNetwork(network);
    if (!balance) return ["—", "—"];
    const formattedBalance = formatBalance(balance, decimals);
    if (!exchangeRate) return [formattedBalance, "—"];
    return [
      formattedBalance,
      formatFiatBalance(balance, decimals, exchangeRate),
    ];
  }, [network, balance, exchangeRate]);

  return (
    <div className="home-balance" data-testid="LayerBalance">
      {getIsTestnet(network) ? (
        <div className="home-testnet-warning">
          <ThemedText style={{ fontSize: 12, color: "#F59E0B" }}>
            Warning: You are using a testnet, coins have no value
          </ThemedText>
        </div>
      ) : null}
      <div className="home-balance-amount" data-testid="LayerActualBalance">
        <span className="home-balance-value">{displayBalance}</span>
        <span className="home-balance-ticker">{ticker}</span>
      </div>
      <div className="home-balance-fiat">
        {displaySubBalance !== "—" ? `${displaySubBalance} USD` : "—"}
      </div>
    </div>
  );
};
