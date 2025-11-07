import React, { createContext, ReactElement, useContext, useState, useCallback } from 'react';

export interface ActionPopupItem {
  onClick: () => void;
  children: ReactElement;
}

interface ActionPopupContextType {
  setActions: (actions: ActionPopupItem[], title?: string) => void;
  getActions: () => { actions: ActionPopupItem[]; title?: string };
  clearActions: () => void;
}

const ActionPopupContext = createContext<ActionPopupContextType | undefined>(undefined);

export const ActionPopupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [actionsData, setActionsData] = useState<{ actions: ActionPopupItem[]; title?: string }>({
    actions: [],
    title: undefined,
  });

  const setActions = useCallback((actions: ActionPopupItem[], title?: string) => {
    console.debug('[ActionPopupContext] Setting actions:', actions.length, 'title:', title);
    setActionsData({ actions, title });
  }, []);

  const getActions = useCallback(() => {
    console.debug('[ActionPopupContext] Getting actions:', actionsData.actions.length);
    return actionsData;
  }, [actionsData]);

  const clearActions = useCallback(() => {
    setActionsData({ actions: [], title: undefined });
  }, []);

  return <ActionPopupContext.Provider value={{ setActions, getActions, clearActions }}>{children}</ActionPopupContext.Provider>;
};

export const useActionPopup = () => {
  const context = useContext(ActionPopupContext);
  if (!context) {
    throw new Error('useActionPopup must be used within ActionPopupProvider');
  }
  return context;
};
