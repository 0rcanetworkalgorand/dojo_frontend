import { create } from "zustand";

interface UIState {
  stakeModalOpen: boolean;
  setStakeModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  stakeModalOpen: false,
  setStakeModalOpen: (open) => set({ stakeModalOpen: open }),
}));
