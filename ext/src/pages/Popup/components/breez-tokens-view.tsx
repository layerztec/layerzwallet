import type { AssetBalance } from '@breeztech/breez-sdk-liquid';
import React, { useContext, useEffect, useState } from 'react';

import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';
import { BackgroundCaller } from '../../../modules/background-caller';
import { getBreezNetwork } from '../../../modules/breeze-adapter';

const BreezTokensView: React.FC = () => {
  const network = useContext(NetworkContext).network as typeof NETWORK_BREEZ | typeof NETWORK_BREEZTESTNET;
  const { accountNumber } = useContext(AccountNumberContext);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchBreezAssetBalances = async () => {
      setAssetBalances([]);

      try {
        const mnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
        const bw = new BreezWallet(mnemonic, getBreezNetwork(network));
        const balances = await bw.getAssetBalances();
        setAssetBalances(balances);
      } catch (error) {
        console.error('Error fetching Breez asset balances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBreezAssetBalances();
  }, [network, accountNumber]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p>Loading assets...</p>
      </div>
    );
  }

  if (assetBalances.length === 0) {
    return null;
  }

  const getAssetName = (asset: AssetBalance): string => {
    return asset.ticker || asset.assetId.substring(0, 8) + '...';
  };

  return (
    <div style={{ padding: 10, marginTop: 10 }}>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>Assets</h2>
      <div>
        {assetBalances.map((item) => (
          <div
            key={item.assetId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 12,
              border: '1px solid #e0e0e0',
              borderRadius: 8,
              margin: '4px 8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{getAssetName(item)}</span>
              {item.name && <span style={{ marginLeft: 5, color: '#888', fontSize: 14 }}>({item.name})</span>}
            </div>

            <span style={{ fontSize: 14, marginLeft: 'auto', marginRight: 16 }}>{item.balance ? item.balance : item.balanceSat}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BreezTokensView;
