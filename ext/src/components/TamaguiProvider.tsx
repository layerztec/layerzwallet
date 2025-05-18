import React from 'react';
import { TamaguiProvider as Provider } from 'tamagui';
import config from '../../tamagui.config';

type TamaguiProviderProps = {
  children: React.ReactNode;
};

export const TamaguiProvider: React.FC<TamaguiProviderProps> = ({ children }) => {
  return <Provider config={config}>{children}</Provider>;
};

export default TamaguiProvider;
