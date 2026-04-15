"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useWallet, Wallet } from "@txnlab/use-wallet-react";
import { X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button"; // I'll create this or use a raw button
import Image from "next/image";

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { wallets } = useWallet();

  const handleConnect = async (wallet: Wallet) => {
    try {
      await wallet.connect();
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to connect wallet:", e);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
                className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md bg-white rounded-dojo-modal shadow-2xl p-8 z-[101] focus:outline-none"
              >
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <Dialog.Title className="text-3xl font-black text-white uppercase tracking-tighter">
                      Connect Node
                    </Dialog.Title>
                    <Dialog.Description className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-2">
                       Protocol // Authorized Access Only
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button className="w-10 h-10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 rounded-full transition-all">
                      <X size={24} strokeWidth={3} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="space-y-4">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleConnect(wallet)}
                      className="w-full flex items-center justify-between p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl border border-white/10 overflow-hidden bg-white p-3 group-hover:scale-105 transition-transform">
                          <img
                            src={wallet.metadata.icon}
                            alt={wallet.metadata.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-left">
                          <h4 className="text-xl font-black text-white uppercase tracking-tighter">
                            {wallet.metadata.name}
                          </h4>
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">
                            {wallet.id === "pera" ? "Mobile Protocol" : "Defly Engine"}
                          </p>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                         <span className="text-lg font-black tracking-tighter font-mono">→</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-10 pt-8 border-t border-white/5 text-center">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                    No active node?{" "}
                    <a
                      href="https://www.algorand.foundation/wallets"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dojo-teal hover:text-white transition-colors"
                    >
                      Initialize Here <ExternalLink size={10} className="inline ml-1" />
                    </a>
                  </p>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
