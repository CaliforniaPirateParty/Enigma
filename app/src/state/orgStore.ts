import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_ORG_KEY = 'enigma:active-org';

export type OrgStoreState = {
  activeOrgId: string | null;
  setActiveOrg: (id: string) => void;
  clearActiveOrg: () => void;
  hydrate: () => Promise<void>;
};

export const useOrgStore = create<OrgStoreState>((set, get) => ({
  activeOrgId: null,

  setActiveOrg: (id: string) => {
    const lower = id.toLowerCase();
    if (get().activeOrgId === lower) {
      // idempotent — no-op
      return;
    }
    set({ activeOrgId: lower });
    AsyncStorage.setItem(ACTIVE_ORG_KEY, lower);
  },

  clearActiveOrg: () => {
    set({ activeOrgId: null });
    AsyncStorage.removeItem(ACTIVE_ORG_KEY);
  },

  hydrate: async () => {
    const stored = await AsyncStorage.getItem(ACTIVE_ORG_KEY);
    if (stored) {
      set({ activeOrgId: stored });
    }
  },
}));
