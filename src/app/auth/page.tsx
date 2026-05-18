"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowRight } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";

export default function AuthPage() {
  const router = useRouter();
  const { wallets, isReady } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleConnect = async (walletId: string) => {
    setIsConnecting(true);
    setSelectedWalletId(walletId);

    try {
      const wallet = wallets?.find((w) => w.id === walletId);
      if (!wallet) {
        console.error("Wallet not found:", walletId);
        setIsConnecting(false);
        return;
      }

      await wallet.connect();
      router.push("/dashboard");
    } catch (error) {
      console.error("Wallet connection error:", error);
      setIsConnecting(false);
      setSelectedWalletId(null);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-xl w-full z-10 text-center"
      >
        <div className="mb-20">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-7xl md:text-8xl font-bold text-foreground mb-6 uppercase tracking-tighter"
          >
            0RCA
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="text-muted text-lg font-medium tracking-wider uppercase mb-12"
          >
            On-Chain AI Agent Swarm
          </motion.p>
        </div>

        <div className="space-y-6 max-w-sm mx-auto">
          <button
            onClick={() => setShowWalletModal(true)}
            className="w-full py-4 px-8 rounded-lg bg-accent text-white font-semibold text-lg flex items-center justify-center gap-3 hover:bg-accent-dark transition-colors shadow-sm"
          >
            {isConnecting ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Wallet size={24} />
                Connect Wallet
              </>
            )}
          </button>
        </div>

        {/* Wallet Selection Modal */}
        <AnimatePresence>
          {showWalletModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowWalletModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-surface border border-black/[0.06] rounded-2xl shadow-xl p-8 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">Connect Wallet</h2>
                <p className="text-muted text-sm mb-6">Choose your preferred wallet to connect.</p>

                <div className="space-y-3">
                  {wallets?.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => {
                        setShowWalletModal(false);
                        handleConnect(wallet.id);
                      }}
                      disabled={isConnecting}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-black/[0.06] bg-surface-elevated hover:bg-surface-sunken transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Wallet size={20} className="text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{wallet.metadata.name}</p>
                        <p className="text-xs text-muted">{wallet.id}</p>
                      </div>
                      {selectedWalletId === wallet.id && (
                        <div className="ml-auto">
                          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowWalletModal(false)}
                  className="mt-6 w-full py-3 text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
