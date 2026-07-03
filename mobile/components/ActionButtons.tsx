import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActionPopupButton } from './ActionPopupButton';
import HomeActionButton from './HomeActionButton';
import { ThemedText } from './ThemedText';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { USDT_TOKENS } from '@shared/models/token-list';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_RGB, NETWORK_RGB_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_USDT, Networks } from '@shared/types/networks';
import { ReceiveTokenProps } from '@/app/Receive';
import { SendTokenEvmProps } from '@/app/SendTokenEvm';
import { SendParams } from '@/app/send';

export const Action = ({ network, text }: { network?: Networks; text: string }) => {
  const networkImage = network ? getNetworkImageAsset(network) : null;
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.actionIconImage} contentFit="contain" /> : null;
  return (
    <View style={styles.action}>
      {networkIconContent && <View style={styles.actionIcon}>{networkIconContent}</View>}
      <ThemedText style={styles.actionText}>{text}</ThemedText>
    </View>
  );
};

interface ActionButtonsProps {
  onFundPress: () => void;
  /** When true, draws a breathing glow on the Receive button (new-user CTA). */
  highlightReceive?: boolean;
  /** Called when the user engages the Receive button — used to dismiss the new-user CTA. */
  onReceivePress?: () => void;
}

export default function ActionButtons({ onFundPress, highlightReceive = false, onReceivePress }: ActionButtonsProps) {
  const router = useRouter();
  const { network } = useContext(NetworkContext);

  const canBuyWithFiat = fiatOnRamp?.[network]?.canBuyWithFiat;

  const handleSend = () => {
    switch (network) {
      case NETWORK_LIGHTNING:
      case NETWORK_LIGHTNING_TESTNET:
        router.push('/send/send-address-lightning');
        break;
      default:
        router.push('/send');
    }
  };

  // RGB send action sheet: on-chain RGB invoice (existing /send flow) vs
  // USDT-over-Lightning (new /send-rgb-ln flow). LN entry only appears on
  // signet — mainnet stays hidden until UTEXO publishes prod constants.
  const handleSendRgbLn = () => router.push('/send-rgb-ln');
  const rgbSendActions = [
    { children: <Action network={network} text="Send via RGB on-chain" />, onClick: handleSend },
    ...(network === NETWORK_RGB_TESTNET ? [{ children: <Action network={network} text="Send USDT over Lightning" />, onClick: handleSendRgbLn }] : []),
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  const handleReceive = () => {
    onReceivePress?.();
    router.push('/Receive');
  };

  const handleFund = () => {
    onFundPress();
  };

  const handleReceiveOnLightningAddress = () => {
    onReceivePress?.();
    router.push('/ReceiveOnLightningAddress');
  };

  const handleSendUSDTViaRootstock = (contractAddress: string) => () => {
    const params: SendTokenEvmProps = { contractAddress, network: NETWORK_ROOTSTOCK };
    router.push({ pathname: '/SendTokenEvm', params });
  };

  const handleSendUSDTViaLiquid = () => {
    const params: SendParams = { token: USDT_TOKENS[NETWORK_LIQUID][0], network: NETWORK_LIQUID };
    router.push({ pathname: '/send', params });
  };

  const handleSendUSDBViaSpark = () => {
    const params: SendParams = { token: USDT_TOKENS[NETWORK_SPARK][0], network: NETWORK_SPARK };
    router.push({ pathname: '/send', params });
  };

  // USDT send and receive actions
  const usdtSendActions = [
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send USDT via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][0]) },
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send USDT0 via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][1]) },
    { children: <Action network={NETWORK_ROOTSTOCK} text="Send rUSDT via Rootstock" />, onClick: handleSendUSDTViaRootstock(USDT_TOKENS[NETWORK_ROOTSTOCK][2]) },
    { children: <Action network={NETWORK_LIQUID} text="Send USDT via Liquid" />, onClick: handleSendUSDTViaLiquid },
    { children: <Action network={NETWORK_SPARK} text="Send USDB via Spark" />, onClick: handleSendUSDBViaSpark },
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  const handleReceiveTokenViaRootstock = () => {
    const params: ReceiveTokenProps = { network: NETWORK_ROOTSTOCK };
    router.push({ pathname: '/Receive', params });
  };

  const handleReceiveTokenViaLiquid = () => {
    const params: ReceiveTokenProps = { network: NETWORK_LIQUID };
    router.push({ pathname: '/Receive', params });
  };

  const handleReceiveTokenViaSpark = () => {
    const params: ReceiveTokenProps = { network: NETWORK_SPARK };
    router.push({ pathname: '/Receive', params });
  };

  const usdtReceiveActions = [
    { children: <Action network={NETWORK_ROOTSTOCK} text="Receive via Rootstock" />, onClick: handleReceiveTokenViaRootstock },
    { children: <Action network={NETWORK_LIQUID} text="Receive via Liquid" />, onClick: handleReceiveTokenViaLiquid },
    { children: <Action network={NETWORK_SPARK} text="Receive via Spark" />, onClick: handleReceiveTokenViaSpark },
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  // RGB has two distinct receive flavors: a plain bech32m address for BTC sats
  // (handled by the existing /Receive screen) and an RGB invoice for assets
  // (new /receive-rgb-token screen). Surface both via the popup pattern that
  // USDT already uses.
  const handleReceiveRgbToken = () => router.push('/receive-rgb-token');
  // Only show the LN-receive option on signet (rgb_testnet) — mainnet stays
  // hidden until the LSP URL + USDT asset id come back from UTEXO.
  const handleReceiveRgbLn = () => router.push('/receive-rgb-ln');
  const rgbReceiveActions = [
    { children: <Action network={network} text="Receive sats" />, onClick: handleReceive },
    { children: <Action network={network} text="Receive RGB asset" />, onClick: handleReceiveRgbToken },
    ...(network === NETWORK_RGB_TESTNET ? [{ children: <Action network={network} text="Receive USDT over Lightning" />, onClick: handleReceiveRgbLn }] : []),
    { children: <Action text="Cancel" />, onClick: () => {} },
  ];

  // Render Send button
  const renderSendButton = () => {
    if (network === NETWORK_USDT) {
      return (
        <ActionPopupButton actions={usdtSendActions} title="Choose network to send">
          <HomeActionButton title="Send" icon={{ name: 'call-made', type: 'material', size: 24 }} onPress={() => {}} testID="SendButton" />
        </ActionPopupButton>
      );
    }

    if (network === NETWORK_RGB_TESTNET) {
      return (
        <ActionPopupButton actions={rgbSendActions} title="How to send">
          <HomeActionButton title="Send" icon={{ name: 'call-made', type: 'material', size: 24 }} onPress={() => {}} testID="SendButton" />
        </ActionPopupButton>
      );
    }

    return <HomeActionButton title="Send" icon={{ name: 'call-made', type: 'material', size: 24 }} onPress={handleSend} testID="SendButton" />;
  };

  // Render Receive button
  const renderReceiveButton = () => {
    if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
      // Default to Lightning Address receive on tap (as per master behavior)
      return <HomeActionButton title="Receive" icon={{ name: 'call-received', type: 'material', size: 24 }} onPress={handleReceiveOnLightningAddress} glow={highlightReceive} testID="ReceiveButton" />;
    }

    if (network === NETWORK_USDT) {
      return (
        <ActionPopupButton actions={usdtReceiveActions} title="Layer to receive">
          <HomeActionButton title="Receive" icon={{ name: 'call-received', type: 'material', size: 24 }} onPress={() => onReceivePress?.()} glow={highlightReceive} testID="ReceiveButton" />
        </ActionPopupButton>
      );
    }

    if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
      return (
        <ActionPopupButton actions={rgbReceiveActions} title="What to receive">
          <HomeActionButton title="Receive" icon={{ name: 'call-received', type: 'material', size: 24 }} onPress={() => {}} glow={highlightReceive} testID="ReceiveButton" />
        </ActionPopupButton>
      );
    }

    return <HomeActionButton title="Receive" icon={{ name: 'call-received', type: 'material', size: 24 }} onPress={handleReceive} glow={highlightReceive} testID="ReceiveButton" />;
  };

  // Render Fund button (only if canBuyWithFiat is true)
  const renderFundButton = () => {
    if (!canBuyWithFiat) {
      return null;
    }

    return <HomeActionButton title="Fund" icon={{ name: 'add', type: 'ionicons', size: 24 }} onPress={handleFund} testID="FundButton" />;
  };

  // RGB-only: lets the user mint a NIA asset directly from the wallet so they
  // can self-fund test assets without depending on a counterparty.
  const renderIssueButton = () => {
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return null;
    return <HomeActionButton title="Issue" icon={{ name: 'add-circle-outline', type: 'material', size: 24 }} onPress={() => router.push('/issue-asset')} testID="IssueButton" />;
  };

  // RGB-only debug surface: list colorable UTXOs, allocations attached to
  // each output, and create more on demand. Helpful when InsufficientAllocationSlots
  // shows up unexpectedly or a pending blind-receive is holding a slot.
  const renderUtxosButton = () => {
    if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return null;
    return <HomeActionButton title="UTXOs" icon={{ name: 'view-list', type: 'material', size: 24 }} onPress={() => router.push('/utxo-manager')} testID="UtxosButton" />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonsRow}>
        {renderReceiveButton()}
        {renderSendButton()}
        {renderFundButton()}
        {renderIssueButton()}
        {renderUtxosButton()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    width: '100%',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    color: 'white',
  },
  actionIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconImage: {
    width: 24,
    height: 24,
    color: 'white',
  },
});
