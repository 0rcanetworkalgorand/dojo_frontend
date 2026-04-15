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
      // ... rest of toast logic ...

      toast.success(
        (t: any) => (
          <span>
            Stake Successful! 
            <a 
              href={`https://testnet.explorer.perawallet.app/tx/${mainTxId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline text-dojo-teal font-bold"
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setStakeModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dojo-surface border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-10 pt-10 pb-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Node Collateral</h2>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-2">Commitment Protocol v2.4</p>
              </div>
              <button
                onClick={() => setStakeModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                <X size={24} strokeWidth={3} />
              </button>
            </div>

            <div className="p-10">
              {success ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-24 h-24 rounded-full bg-dojo-teal/20 flex items-center justify-center mb-8 border border-dojo-teal/50"
                  >
                    <Check size={48} className="text-dojo-teal" strokeWidth={3} />
                  </motion.div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Registry Verified</h3>
                  <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-10 max-w-xs leading-relaxed">
                    NEURAL NODE ENTRY SUCCESSFUL. NODE IS NOW ACTIVE IN GLOBAL MARKETPLACE.
                  </p>
                  <a 
                    href={`https://testnet.explorer.perawallet.app/tx/${txnId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-white hover:text-dojo-teal font-black uppercase tracking-widest text-[10px] transition-colors border-b border-white/10 pb-1"
                  >
                    VIEW ON EXPLORER <ArrowUpRight size={14} />
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-10">
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-6">
                      Lock Duration
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {COMMITMENT_DURATIONS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d as 30 | 60 | 90)}
                          className={cn(
                            "py-5 px-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-500 border",
                            duration === d
                              ? "bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                              : "bg-white/[0.02] border-white/5 text-white/40 hover:border-white/20"
                          )}
                        >
                          {d} Days
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-10">
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-6">
                      Stake Quantization [USDC]
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="dojo-input !bg-white/[0.02] !border-white/10 !text-white px-8 py-6 rounded-2xl text-4xl font-black tracking-tighter focus:!border-dojo-teal transition-all placeholder:opacity-10"
                        min="0"
                        step="1"
                      />
                      <div className="absolute right-8 top-1/2 -translate-y-1/2 text-white/10 font-black text-xl uppercase tracking-tighter">
                        USDC
                      </div>
                    </div>
                  </div>

                  {parseFloat(amount) > 0 && (
                    <div className="mb-10 p-8 bg-black/40 rounded-3xl border border-white/5 space-y-6">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="w-8 h-px bg-amber-500/30" />
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Protocol Warning</span>
                      </div>
                      
                      <div className="space-y-6">
                        {[10, 20, duration - 1].map((day) => (
                          <div key={day} className="flex justify-between items-center group">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest group-hover:text-white/40 transition-colors">
                              Exit at Day {day}
                            </span>
                            <div className="text-right">
                              <div className="text-xs font-black text-red-500/80 tracking-widest">
                                -{formatAlgo(penalty.penaltyAtDay(day))}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[10px] font-black text-dojo-teal uppercase tracking-[0.3em]">
                            Full Maturity [Day {duration}]
                          </span>
                          <div className="flex items-center gap-3">
                            <Check size={16} className="text-emerald-500" strokeWidth={3} />
                            <span className="text-lg font-black text-white tracking-tighter">
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
                    className="w-full relative group"
                  >
                    <div className={cn(
                        "w-full h-18 rounded-full font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 transition-all duration-500",
                        isSubmitting || !amount || parseFloat(amount) <= 0
                        ? "bg-white/5 text-white/20"
                        : "bg-white text-black hover:bg-dojo-teal hover:shadow-[0_0_30px_rgba(0,245,212,0.4)] group-active:scale-[0.98]"
                    )}>
                      {isSubmitting ? (
                        <>INITIALIZING PKI...</>
                      ) : (
                        <>COMMIT TO REGISTRY [→]</>
                      )}
                    </div>
                  </button>
                  
                  <p className="mt-8 text-center text-[10px] text-white/10 uppercase tracking-[0.3em] font-black">
                    EVM CO-PROCESSOR // ALGORAND STANDARD ASSET
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
