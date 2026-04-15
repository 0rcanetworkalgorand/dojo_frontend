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
    <div className="min-h-screen bg-dojo-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-dojo-teal/10 rounded-full blur-[120px] pointer-events-none" />
      
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
            className="text-7xl md:text-8xl font-black text-white mb-6 uppercase tracking-tighter"
          >
            0RCA<br/>DOJO
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="text-white text-lg font-medium tracking-widest uppercase mb-12"
          >
            Premium AI Swarm Infrastructure
          </motion.p>
        </div>

        <div className="space-y-6 max-w-sm mx-auto">
          <button
            onClick={() => setShowWalletModal(true)}
            className="dojo-button w-full flex items-center justify-center gap-3"
          >
            <Wallet size={20} />
            Connect Wallet
          </button>
          
          <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">
            Enter the Dojo as a Sensei
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showWalletModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowWalletModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="dojo-glass rounded-dojo-modal p-10 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-3xl font-bold mb-8 text-white tracking-tight">
                Connect Wallet
              </h2>
              <div className="space-y-4">
                {wallets?.map((w) => {
                  const walletName = w.metadata?.name || w.id;
                  const isLoading = isConnecting && selectedWalletId === w.id;

                  return (
                    <button
                      key={w.id}
                      onClick={() => handleConnect(w.id)}
                      disabled={isConnecting}
                      className="w-full p-5 bg-white/[0.05] border border-white/10 rounded-2xl hover:bg-white/[0.08] hover:border-dojo-teal/50 transition-all flex items-center justify-between group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center group-hover:bg-dojo-teal/20 transition-colors">
                          <Wallet className="text-dojo-teal" size={20} />
                        </div>
                        <span className="font-bold text-lg text-white">
                          {isLoading ? "Connecting..." : walletName}
                        </span>
                      </div>
                      <ArrowRight className="text-gray-600 group-hover:text-dojo-teal transition-all group-hover:translate-x-1" />
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setShowWalletModal(false)}
                className="mt-8 w-full text-gray-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
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
