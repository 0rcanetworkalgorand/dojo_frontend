"use client";

import { useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { truncateAddress } from "@/lib/utils/format";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function WalletButton() {
  const { activeWallet, activeAccount, wallets } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

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

  if (!connectedWallet || !activeAccount) {
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
        className="flex items-center gap-2 bg-dojo-surface border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-dojo-heading hover:border-dojo-teal transition-colors"
        aria-label="Wallet menu"
        aria-expanded={showDropdown}
      >
        <div className="w-2 h-2 rounded-full bg-dojo-teal" />
        {displayAddress}
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-dojo-surface border border-gray-200 rounded-2xl shadow-dojo-hover z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Connected via</p>
              <p className="text-sm font-medium text-dojo-heading">
                {walletName}
              </p>
            </div>

            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Address</p>
              <p className="text-sm font-mono text-gray-700 break-all">
                {activeAccount.address}
              </p>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Disconnect wallet"
            >
              <LogOut size={16} />
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
