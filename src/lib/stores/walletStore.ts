import { create } from "zustand";
import { Agent } from "@/lib/types";

interface WalletState {
  lastTransactionId: string | null;
  setLastTransactionId: (id: string | null) => void;
  pendingTransactions: string[];
  addPendingTransaction: (id: string) => void;
  removePendingTransaction: (id: string) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  lastTransactionId: null,
  setLastTransactionId: (id) => set({ lastTransactionId: id }),
  pendingTransactions: [],
  addPendingTransaction: (id) =>
    set((state) => ({
      pendingTransactions: [...state.pendingTransactions, id],
    })),
  removePendingTransaction: (id) =>
    set((state) => ({
      pendingTransactions: state.pendingTransactions.filter((tx) => tx !== id),
    })),
}));
