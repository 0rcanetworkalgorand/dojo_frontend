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

  const calculatePenalty = (stakeAmountAlgo: bigint, durationDays: number) => {
    return {
      penaltyAtDay: (exitDay: number) => 
        (stakeAmountAlgo * BigInt(durationDays - exitDay)) / BigInt(durationDays),
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
        stakeAmountAlgo: stakeBigInt,
        durationDays: duration,
        commitmentLockAppId: Number(process.env.NEXT_PUBLIC_COMMITMENT_LOCK_APP_ID || "0"),
        dojoRegistryAppId: Number(process.env.NEXT_PUBLIC_DOJO_REGISTRY_APP_ID || "0"),
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
            <div className="px-8 pt-8 pb-6 flex items-center justify-between border-b border-white/5 bg-white/5">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Reputation Stake</h2>
                <p className="text-sm text-gray-400">Lock ALGO to list your agent in the marketplace</p>
              </div>
              <button
                onClick={() => setStakeModalOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              {success ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                    <Check size={40} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Stake Successful</h3>
                  <p className="text-gray-400 mb-8 max-w-xs">
                    Your agent identity is now on-chain and listed for active tasks.
                  </p>
                  <a 
                    href={`https://testnet.explorer.perawallet.app/tx/${txnId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-dojo-teal hover:text-dojo-gold font-medium transition-colors"
                  >
                    View Transaction <ArrowUpRight size={16} />
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      Commitment Duration
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {COMMITMENT_DURATIONS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d as 30 | 60 | 90)}
                          className={`py-3 px-4 rounded-xl font-bold transition-all border-2 ${
                            duration === d
                              ? "bg-dojo-teal/20 border-dojo-teal text-dojo-teal shadow-[0_0_15px_rgba(45,212,191,0.3)]"
                              : "bg-white/5 border-white/5 text-gray-400 hover:border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {d} Days
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="flex justify-between mb-4">
                      <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                        Stake Amount (ALGO)
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black/30 border-2 border-white/10 rounded-2xl px-6 py-4 text-2xl font-bold text-white focus:border-dojo-teal focus:outline-none transition-all"
                        min="0"
                        step="1"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 font-bold uppercase japan-tracking">
                        ALGO
                      </div>
                    </div>
                  </div>

                  {parseFloat(amount) > 0 && (
                    <div className="mb-8 p-6 bg-black/40 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2 mb-4 text-amber-400">
                        <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Info size={16} /> Early Withdrawal Penalty</span>
                      </div>
                      
                      <div className="space-y-4">
                        {[10, 20, duration - 1].map((day) => (
                          <div key={day} className="flex justify-between items-center group">
                            <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                              Exit at Day {day}
                            </span>
                            <div className="text-right">
                              <div className="text-sm font-bold text-red-400/80">
                                -{formatAlgo(penalty.penaltyAtDay(day))}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Refund: {stakeBigInt > penalty.penaltyAtDay(day) ? formatAlgo(stakeBigInt - penalty.penaltyAtDay(day)) : "0.00 ALGO"}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                          <span className="text-sm font-bold text-dojo-teal">
                            Maturity (Day {duration})
                          </span>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500" />
                            <span className="text-sm font-bold text-white">
                              {formatAlgo(stakeBigInt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                    className="w-full relative group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-dojo-teal to-dojo-gold opacity-0 group-hover:opacity-10 transition-opacity" />
                    <div className="w-full bg-dojo-teal text-black h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 group-active:scale-[0.98] transition-all">
                      {isSubmitting ? (
                        <>Processing...</>
                      ) : (
                        <>Confirm & Stake <ArrowUpRight size={20} /></>
                      )}
                    </div>
                  </button>
                  
                  <p className="mt-4 text-center text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                    Secured by Algorand CommitmentLock Protocol
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
