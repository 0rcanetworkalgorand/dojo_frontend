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
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <Dialog.Title className="text-2xl font-heading font-bold text-dojo-heading">
                      Connect Wallet
                    </Dialog.Title>
                    <Dialog.Description className="text-gray-500 mt-1">
                      Choose your preferred Algorand wallet
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="space-y-3">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleConnect(wallet)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-gray-100 hover:border-dojo-teal hover:bg-dojo-teal/5 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl border border-gray-100 overflow-hidden bg-white p-2">
                          <img
                            src={wallet.metadata.icon}
                            alt={wallet.metadata.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-left">
                          <h4 className="font-heading font-semibold text-dojo-heading">
                            {wallet.metadata.name}
                          </h4>
                          <p className="text-xs text-gray-400">
                            {wallet.id === "pera" ? "Pera Wallet App" : "Defly App"}
                          </p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-dojo-teal group-hover:text-white transition-colors">
                        <motion.span
                          initial={{ x: -2, opacity: 0.5 }}
                          whileHover={{ x: 0, opacity: 1 }}
                        >
                          →
                        </motion.span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                  <p className="text-sm text-gray-500">
                    New to Algorand?{" "}
                    <a
                      href="https://www.algorand.foundation/wallets"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dojo-teal font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Get a wallet <ExternalLink size={14} />
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
