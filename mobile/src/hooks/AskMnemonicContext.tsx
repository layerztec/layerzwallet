import React, { createContext, ReactNode, useState, useCallback, useContext } from 'react';
import { useRouter } from 'expo-router';

interface IAskMnemonicContext {
  askMnemonic: () => Promise<string>;
  handleMnemonicSubmit: (result: string | Error) => void;
}

export const AskMnemonicContext = createContext<IAskMnemonicContext>({
  askMnemonic: (): Promise<string> => Promise.reject('askMnemonic: this should never happen'),
  handleMnemonicSubmit: (): void => {},
});

// Custom hook to use the AskMnemonic context
export const useAskMnemonic = () => {
  const context = useContext(AskMnemonicContext);
  if (!context) {
    throw new Error('useAskMnemonic must be used within AskMnemonicContextProvider');
  }
  return context;
};

type ResolverFunction = (resolveValue: string) => void;
type RejecterFunction = (error: Error) => void;

/**
 * This provider provides an async function `askMnemonic()` that navigates to a modal screen asking for a user password,
 * handles mnemonic decryption internally, and resolves to the decrypted mnemonic string.
 */
export const AskMnemonicContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [resolverFunc, setResolverFunc] = useState<ResolverFunction>(() => () => {});
  const [rejecterFunc, setRejecterFunc] = useState<RejecterFunction>(() => () => {});
  const router = useRouter();

  const askMnemonic = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      setResolverFunc(() => resolve);
      setRejecterFunc(() => reject);
      // Navigate to the mnemonic screen
      router.push('/AskMnemonic');
    });
  }, [router]);

  // Function to be called from the mnemonic screen
  const handleMnemonicSubmit = useCallback(
    (result: string | Error) => {
      if (result instanceof Error) {
        rejecterFunc(result);
      } else {
        resolverFunc(result);
      }
      setResolverFunc(() => () => {});
      setRejecterFunc(() => () => {});
    },
    [resolverFunc, rejecterFunc]
  );

  return <AskMnemonicContext.Provider value={{ askMnemonic, handleMnemonicSubmit }}>{props.children}</AskMnemonicContext.Provider>;
};
