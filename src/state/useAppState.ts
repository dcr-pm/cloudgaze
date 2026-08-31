import { useContext } from 'react';
import { AppStateContext, type AppStateValue } from './AppStateProvider';

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used inside <AppStateProvider>');
  }
  return ctx;
}

/**
 * For screens that only render once a household exists. Narrows away the nulls
 * so every consumer doesn't repeat the same guard.
 */
export function useHousehold() {
  const app = useAppState();
  if (!app.state || !app.deviceParentId || !app.deviceParent || !app.otherParent) {
    throw new Error('useHousehold used before the household was ready');
  }
  return {
    ...app,
    state: app.state,
    household: app.state.household,
    entries: app.state.entries,
    deviceParentId: app.deviceParentId,
    deviceParent: app.deviceParent,
    otherParent: app.otherParent,
  };
}
