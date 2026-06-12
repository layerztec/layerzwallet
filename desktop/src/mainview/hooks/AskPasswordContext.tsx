import React, { createContext, ReactNode, useState } from 'react';
import { Button, Input, Modal } from '../pages/DesignSystem';

interface IAskPasswordContext {
  askPassword: () => Promise<string>;
}

export const AskPasswordContext = createContext<IAskPasswordContext>({
  askPassword: (): Promise<string> => Promise.reject('askPassword: this should never happen'),
});

type ResolverFunction = (resolveValue: string) => void;

/**
 * This provider provides an async function `askPassword()` that shows Dialog asking for a user password, and
 * resolved to a string that user typed.
 */
export const AskPasswordContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [isAskingPassword, setIsAskingPassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [resolverFunc, setResolverFunc] = React.useState<ResolverFunction>(() => () => {});

  const askPassword = (): Promise<string> => {
    setIsAskingPassword(true);

    return new Promise((resolve) => {
      setResolverFunc(() => resolve);
    });
  };

  const handlePasswordChange = (event: { target: { value: React.SetStateAction<string> } }) => {
    setPassword(event.target.value);
  };

  const onOkClick = async () => {
    resolverFunc(password);
    // cleanup:
    setPassword('');
    const passwordInput = document.getElementById('password-provider-input') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.value = '';
    }
    setIsAskingPassword(false);
  };

  return (
    <AskPasswordContext.Provider value={{ askPassword }}>
      {props.children}
      {isAskingPassword && (
        <Modal closable={false}>
          <h2>Unlock your wallet:</h2>
          <div style={{ width: '90%' }}>
            <Input
              id="password-provider-input"
              data-testid="password-provider-input"
              type="password"
              name="password"
              placeholder="Type password"
              onChange={handlePasswordChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOkClick();
              }}
            />
          </div>
          <Button onClick={onOkClick}>OK</Button>
        </Modal>
      )}
    </AskPasswordContext.Provider>
  );
};
