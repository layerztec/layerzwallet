import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import WebView from 'react-native-webview';

export type OnrampProps = {
  address: string; // bitcoin address to receive coins to
};

const Onramp: React.FC = () => {
  const params = useLocalSearchParams<OnrampProps>();
  const { address } = params;

  // @see https://docs.onramper.com/docs/integrating-in-webviews
  return (
    <WebView
      originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
      allowsInlineMediaPlayback={true}
      style={{ flex: 1 }}
      source={{ uri: `https://layerztec.github.io/website/onramp/?address=${address}` }}
    />
  );
};

export default Onramp;
