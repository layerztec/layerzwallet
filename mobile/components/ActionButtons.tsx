import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActionPopupButton } from './ActionPopupButton';
import LiquidGlassButton from './LiquidGlassButton';
import { ThemedText } from './ThemedText';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { USDT_TOKENS } from '@shared/models/token-list';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_USDT, Networks } from '@shared/types/networks';
import { ReceiveTokenProps } from '@/app/Receive';
import { SendTokenEvmProps } from '@/app/SendTokenEvm';
import { SendParams } from '@/app/send';

const Action = ({ network, text }: { network?: Networks; text: string }) => {
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
}

export default function ActionButtons({ onFundPress }: ActionButtonsProps) {
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

  const handleReceive = () => {
    router.push('/Receive');
  };

  const handleFund = () => {
    onFundPress();
  };

  const handleReceiveOnLightningAddress = () => {
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

  // Render Send button
  const renderSendButton = () => {
    if (network === NETWORK_USDT) {
      return (
        <ActionPopupButton actions={usdtSendActions} title="Choose network to send">
          <LiquidGlassButton title="Send" icon={{ name: 'call-made', type: 'material', size: 24 }} onPress={() => {}} testID="SendButton" />
        </ActionPopupButton>
      );
    }

    return <LiquidGlassButton title="Send" icon={{ name: 'call-made', type: 'material', size: 24 }} onPress={handleSend} testID="SendButton" />;
  };

  // Render Receive button
  const renderReceiveButton = () => {
    if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
      // Default to Lightning Address receive on tap (as per master behavior)
      return <LiquidGlassButton title="Receive" icon={{ name: 'call-received', type: 'material', size: 24 }} onPress={handleReceiveOnLightningAddress} testID="ReceiveButton" />;
    }

    if (network === NETWORK_USDT) {
      return (
        <ActionPopupButton actions={usdtReceiveActions} title="Layer to receive">
          <LiquidGlassButton title="Receive" icon={{ name: 'call-received', type: 'material', size: 24 }} onPress={() => {}} testID="ReceiveButton" />
        </ActionPopupButton>
      );
    }

    return <LiquidGlassButton title="Receive" icon={{ name: 'call-received', type: 'material', size: 24 }} onPress={handleReceive} testID="ReceiveButton" />;
  };

  // Render Fund button (only if canBuyWithFiat is true)
  const renderFundButton = () => {
    if (!canBuyWithFiat) {
      return null;
    }

    return <LiquidGlassButton title="Fund" icon={{ name: 'add', type: 'ionicons', size: 24 }} onPress={handleFund} testID="FundButton" />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonsRow}>
        {renderReceiveButton()}
        {renderSendButton()}
        {renderFundButton()}
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
