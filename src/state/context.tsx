import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { PolicyState } from '@/types/policy';
import type { PolicyAction } from './actions';
import { policyReducer, initialState } from './reducer';

interface PolicyContextValue {
  state: PolicyState;
  dispatch: React.Dispatch<PolicyAction>;
}

const PolicyContext = createContext<PolicyContextValue | null>(null);

interface PolicyProviderProps {
  children: ReactNode;
  initial?: PolicyState;
  onStateChange?: (state: PolicyState) => void;
}

export function PolicyProvider({ children, initial, onStateChange }: PolicyProviderProps) {
  const [state, dispatch] = useReducer(policyReducer, initial ?? initialState);

  // Notify parent when state changes (for multi-page sync)
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  return (
    <PolicyContext.Provider value={{ state, dispatch }}>
      {children}
    </PolicyContext.Provider>
  );
}

export function usePolicyContext(): PolicyContextValue {
  const ctx = useContext(PolicyContext);
  if (!ctx) {
    throw new Error('usePolicyContext must be used within a PolicyProvider');
  }
  return ctx;
}
