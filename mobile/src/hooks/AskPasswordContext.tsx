import React, { createContext, ReactNode, useState, useCallback, useContext } from 'react';
import { useRouter } from 'expo-router';

interface IAskPasswordContext {
  askPassword: () => Promise<string>;
  handlePasswordSubmit: (password: string) => void;
}

export const AskPasswordContext = createContext<IAskPasswordContext>({
  askPassword: (): Promise<string> => Promise.reject('askPassword: this should never happen'),
  handlePasswordSubmit: (): void => {},
});

// Custom hook to use the AskPassword context
export const useAskPassword = () => {
  const context = useContext(AskPasswordContext);
  if (!context) {
    throw new Error('useAskPassword must be used within AskPasswordContextProvider');
  }
  return context;
};

type ResolverFunction = (resolveValue: string) => void;

/**
 * This provider provides an async function `askPassword()` that navigates to a modal screen asking for a user password,
 * and resolves to a string that the user typed.
 */
export const AskPasswordContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [resolverFunc, setResolverFunc] = useState<ResolverFunction>(() => () => {});
  const router = useRouter();

  const askPassword = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      setResolverFunc(() => resolve);
      // Navigate to the password screen
      router.push('/AskPassword');
    });
  }, [router]);

  // Function to be called from the password screen
  const handlePasswordSubmit = useCallback(
    (password: string) => {
      resolverFunc(password);
      setResolverFunc(() => () => {});
    },
    [resolverFunc]
  );

  return <AskPasswordContext.Provider value={{ askPassword, handlePasswordSubmit }}>{props.children}</AskPasswordContext.Provider>;
};
