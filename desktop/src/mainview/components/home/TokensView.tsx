import React, {
  forwardRef,
  memo,
  useCallback,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { AccountNumberContext } from "@shared/hooks/AccountNumberContext";
import { NetworkContext } from "@shared/hooks/NetworkContext";
import { useTokenDiscovery } from "@shared/hooks/useTokenDiscovery";
import { CachedTokenInfo } from "@shared/types/token-info";

import { LayerzStorage } from "../../class/layerz-storage";
import { BackgroundCaller } from "../../modules/background-caller";

import { SectionContainer } from "./SectionContainer";
import { TokenRow } from "./TokenRow";

import "./HomeSections.css";
import "./SectionContainer.css";

type TokensViewProps = {
  onTokenPress?: (token: CachedTokenInfo) => void;
  selectedToken?: string;
};

export const TokensView = memo(
  forwardRef<{ refresh: () => void }, TokensViewProps>(
    ({ onTokenPress, selectedToken }, ref) => {
      const { network } = useContext(NetworkContext);
      const { accountNumber } = useContext(AccountNumberContext);
      const { tokenList, error, mutate } = useTokenDiscovery(
        network,
        accountNumber,
        BackgroundCaller,
        LayerzStorage,
      );
      const [hasVisibleTokens, setHasVisibleTokens] = useState(false);
      const prevContextRef = useRef({ network, accountNumber });

      if (
        prevContextRef.current.network !== network ||
        prevContextRef.current.accountNumber !== accountNumber
      ) {
        prevContextRef.current = { network, accountNumber };
        if (hasVisibleTokens) {
          setHasVisibleTokens(false);
        }
      }

      const handleTokenVisible = useCallback(
        (isVisible: boolean) => {
          if (isVisible && !hasVisibleTokens) {
            setHasVisibleTokens(true);
          }
        },
        [hasVisibleTokens],
      );

      useImperativeHandle(ref, () => ({
        refresh: () => {
          void mutate();
        },
      }));

      if (tokenList.length === 0) {
        return null;
      }

      return (
        <>
          <SectionContainer
            title="Tokens"
            className={!hasVisibleTokens ? "home-section-hidden" : undefined}
          >
            <div className="home-tokens-list">
              {tokenList.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  onPress={onTokenPress}
                  selected={selectedToken === token.id}
                  onVisible={handleTokenVisible}
                />
              ))}
            </div>
          </SectionContainer>
          {error ? (
            <p className="home-section-error">Error: {error.message}</p>
          ) : null}
        </>
      );
    },
  ),
);

TokensView.displayName = "TokensView";
