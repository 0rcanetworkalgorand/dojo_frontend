'use client';

import { useState, useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { truncateAddress } from "@/lib/utils/format";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function WalletButton() {
  const { activeWallet, activeAccount, wallets } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const connectedWallet = wallets.find((w) => w.isConnected);

  const handleDisconnect = async () => {
    try {
      if (connectedWallet) {
        await connectedWallet.disconnect();
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
    setShowDropdown(false);
  };

  if (!mounted || !connectedWallet || !activeAccount) {
    return null;
  }

  const walletName = activeWallet?.metadata?.name || connectedWallet.metadata?.name || "Wallet";
  const displayAddress = activeAccount.address
    ? truncateAddress(activeAccount.address, 6)
    : "";

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 bg-black/[0.05] border border-black/[0.1] rounded-full px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-foreground hover:bg-black/[0.08] hover:border-accent/50 transition-all duration-300"
        aria-label="Wallet menu"
        aria-expanded={showDropdown}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(44,74,92,0.8)]" />
        {displayAddress}
        <ChevronDown size={12} className="text-muted" />
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-4 w-72 dojo-glass rounded-dojo-modal shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-black/[0.05]">
              <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-2">Connected via</p>
              <p className="text-lg font-bold text-foreground tracking-tight">
                {walletName}
              </p>
            </div>

            <div className="px-6 py-5 border-b border-black/[0.05]">
              <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-2">Address</p>
              <p className="text-xs font-mono text-muted break-all leading-relaxed">
                {activeAccount.address}
              </p>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-3 px-6 py-5 text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors"
              aria-label="Disconnect wallet"
            >
              <LogOut size={14} />
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
