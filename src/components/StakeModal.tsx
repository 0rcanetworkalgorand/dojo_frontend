"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Info, ArrowUpRight } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useUIStore } from "@/lib/stores/uiStore";
import { useWalletStore } from "@/lib/stores/walletStore";
import { buildStakeAndListAtomicGroup } from "@/lib/transactions/commitmentLock";
import { COMMITMENT_DURATIONS } from "@/lib/constants";
import { formatAlgo } from "@/lib/utils/format";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface StakeModalProps {
  agentAddress?: string;
}

export function StakeModal({ agentAddress = "demo_agent" }: StakeModalProps) {
  const { activeAccount, algodClient, transactionSigner } = useWallet();
  const { stakeModalOpen, setStakeModalOpen } = useUIStore();
  const { setLastTransactionId, addPendingTransaction } = useWalletStore();

  const [duration, setDuration] = useState(30 as 30 | 60 | 90);
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txnId, setTxnId] = useState("");

  const calculatePenalty = (stakeAmount: bigint, durationDays: number) => {
    return {
      penaltyAtDay: (exitDay: number) => 
        (stakeAmount * BigInt(durationDays - exitDay)) / BigInt(durationDays),
      fullReturnDay: durationDays,
    };
  };

  const stakeBigInt = BigInt(Math.round(parseFloat(amount || "0") * 1_000_000));
  const penalty = calculatePenalty(stakeBigInt, duration);

  const handleSubmit = async () => {
    if (!activeAccount || !amount || !agentAddress) return;

    setIsSubmitting(true);
    try {
      const atc = await buildStakeAndListAtomicGroup({
        algodClient,
        senseiAddress: activeAccount.address,
        agentAddress: agentAddress,
        stakeAmountUsdc: stakeBigInt,
        durationDays: duration,
        commitmentLockAppId: Number(process.env.NEXT_PUBLIC_COMMITMENT_LOCK_APP_ID || "0"),
        dojoRegistryAppId: Number(process.env.NEXT_PUBLIC_DOJO_REGISTRY_APP_ID || "0"),
        usdcAssetId: Number(process.env.NEXT_PUBLIC_USDC_ASSET_ID || "10458941"),
        signer: transactionSigner,
      });

      const result = await atc.execute(algodClient, 4);
      const mainTxId = result.txIDs[0];
      
      setTxnId(mainTxId);
      setLastTransactionId(mainTxId);
      addPendingTransaction(mainTxId);
      setSuccess(true);

      toast.success(
        (t: any) => (
          <span>
            Stake Successful! 
            <a 
              href={`https://testnet.explorer.perawallet.app/tx/${mainTxId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline text-accent font-bold"
            >
              View on Explorer
            </a>
          </span>
        ),
        { duration: 6000 }
      );

      setTimeout(() => {
        setSuccess(false);
        setStakeModalOpen(false);
        setAmount("");
      }, 5000);
    } catch (error: any) {
      console.error("Stake error:", error);
      toast.error(`Transaction failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {stakeModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setStakeModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface border border-black/[0.06] rounded-2xl w-full max-w-lg overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-6 flex items-center justify-between border-b border-black/[0.06] bg-surface-elevated">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Node Collateral</h2>
                <p className="text-xs text-muted uppercase tracking-wider mt-1">Commitment Protocol v2.4</p>
              </div>
              <button
                onClick={() => setStakeModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-foreground hover:bg-black/[0.04] rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              {success ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 border border-accent/20"
                  >
                    <Check size={32} className="text-accent" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-foreground tracking-tight mb-2">Registry Verified</h3>
                  <p className="text-xs text-muted mb-6 max-w-xs">
                    NEURAL NODE ENTRY SUCCESSFUL. NODE IS NOW ACTIVE IN GLOBAL MARKETPLACE.
                  </p>
                  <a 
                    href={`https://testnet.explorer.perawallet.app/tx/${txnId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-foreground hover:text-accent font-semibold text-xs uppercase tracking-wider transition-colors"
                  >
                    VIEW ON EXPLORER <ArrowUpRight size={12} />
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                      Lock Duration
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {COMMITMENT_DURATIONS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d as 30 | 60 | 90)}
                          className={cn(
                            "py-3 px-4 rounded-xl font-semibold uppercase tracking-wider text-xs transition-all duration-300 border",
                            duration === d
                              ? "bg-accent text-white border-accent shadow-sm"
                              : "bg-surface-elevated border-black/[0.06] text-muted hover:border-accent/30"
                          )}
                        >
                          {d} Days
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8">
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                      Stake Quantization [USDC]
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="input text-3xl font-bold"
                        min="0"
                        step="1"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-muted font-semibold text-lg">
                        USDC
                      </div>
                    </div>
                  </div>

                  {parseFloat(amount) > 0 && (
                    <div className="mb-8 p-6 bg-surface-elevated rounded-xl border border-black/[0.06]">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-8 h-px bg-amber-500/30" />
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Protocol Warning</span>
                      </div>
                      
                      <div className="space-y-3">
                        {[10, 20, duration - 1].map((day) => (
                          <div key={day} className="flex justify-between items-center">
                            <span className="text-xs text-muted uppercase">
                              Exit at Day {day}
                            </span>
                            <div className="text-right">
                              <div className="text-sm font-bold text-red-600">
                                -{formatAlgo(penalty.penaltyAtDay(day))}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div className="pt-3 border-t border-black/[0.06] flex justify-between items-center">
                          <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                            Full Maturity [Day {duration}]
                          </span>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500" />
                            <span className="text-lg font-bold text-foreground">
                              {formatAlgo(stakeBigInt)} USDC
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                    className={cn(
                        "w-full py-4 rounded-lg font-semibold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all",
                        isSubmitting || !amount || parseFloat(amount) <= 0
                        ? "bg-black/[0.04] text-muted"
                        : "bg-accent text-white hover:bg-accent-dark shadow-sm"
                    )}
                  >
                    {isSubmitting ? (
                      <>INITIALIZING...</>
                    ) : (
                      <>COMMIT TO REGISTRY</>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
