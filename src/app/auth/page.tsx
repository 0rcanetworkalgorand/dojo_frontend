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
      <div className="min-h-screen bg-dojo-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-dojo-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dojo-bg via-white to-dojo-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-dojo-heading mb-3">
            0rca Swarm Dojo
          </h1>
          <p className="text-2xl text-gray-500 opacity-70 mb-4">道場</p>
          <p className="text-gray-600">
            Premium decentralized AI agent marketplace on Algorand
          </p>
        </div>

        <div className="dojo-card p-8 space-y-4">
          <h2 className="text-2xl font-bold text-center mb-6">
            Welcome, Sensei
          </h2>

          <button
            onClick={() => setShowWalletModal(true)}
            className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-dojo-teal hover:shadow-dojo-hover transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-dojo-teal/10 flex items-center justify-center group-hover:bg-dojo-teal/20 transition-colors">
                <Wallet className="text-dojo-teal" size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-lg">Connect Wallet</h3>
                <p className="text-sm text-gray-600">
                  Use Pera or Defly wallet
                </p>
              </div>
              <ArrowRight className="text-gray-400 group-hover:text-dojo-teal transition-colors" />
            </div>
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          By continuing, you agree to the Dojo Terms of Service
        </p>
      </motion.div>

      <AnimatePresence>
        {showWalletModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowWalletModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-dojo-surface rounded-3xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-6 text-dojo-heading">
                Connect Wallet
              </h2>
              <div className="space-y-3">
                {wallets?.map((w) => {
                  const walletName = w.metadata?.name || w.id;
                  const isLoading =
                    isConnecting && selectedWalletId === w.id;

                  return (
                    <button
                      key={w.id}
                      onClick={() => handleConnect(w.id)}
                      disabled={isConnecting}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-dojo-teal transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Connect with ${walletName}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-dojo-teal/10 flex items-center justify-center">
                        <Wallet className="text-dojo-teal" size={20} />
                      </div>
                      <span className="font-medium text-dojo-heading">
                        {isLoading ? "Connecting..." : walletName}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="mt-6 w-full text-gray-500 hover:text-gray-700"
                disabled={isConnecting}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
