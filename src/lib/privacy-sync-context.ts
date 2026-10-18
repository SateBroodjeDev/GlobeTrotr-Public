import { createContext, useContext } from "react";
export const PrivacySyncContext = createContext<{ ready: boolean; save: (preferences: boolean, analytics: boolean) => Promise<void> }>({
  ready: false, save: async () => {},
});
export const usePrivacySync = () => useContext(PrivacySyncContext);
