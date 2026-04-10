import React, { createContext, useContext } from 'react';
import { View } from 'react-native';

type BlurTargetRef = React.RefObject<View | null> | null;

const BlurTargetContext = createContext<BlurTargetRef>(null);

export const BlurTargetContextProvider: React.FC<{ children: React.ReactNode; blurTargetRef: React.RefObject<View | null> }> = ({ children, blurTargetRef }) => {
  return <BlurTargetContext.Provider value={blurTargetRef}>{children}</BlurTargetContext.Provider>;
};

export const useBlurTargetRef = () => useContext(BlurTargetContext);
