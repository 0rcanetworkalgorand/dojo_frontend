"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AgentCard } from "@/components/AgentCard";
import { Button } from "@/components/Button";
import { LANE_COLORS, LANE_LABELS, Lane, LLM_TIERS, BIDDING_STRATEGIES } from "@/lib/constants";
import { LLM_TIER_DISPLAY } from "@/lib/constants/llmTiers";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Code, Search, Megaphone, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { buildRegisterAgentATC } from "@/lib/transactions/dojoRegistry";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import algosdk from "algosdk";

const laneIcons = {
  research: Search,
  code: Code,
  data: Database,
  outreach: Megaphone,
};

export default function BuildPage() {
  const router = useRouter();
  const { activeAccount, algodClient, signTransactions, wallets } = useWallet();
  const { isAuthenticated, isLoading } = useAuthGuard();
  const [step, setStep] = useState(1);
  const [lane, setLane] = useState<Lane | null>(null);
  const [llmTier, setLlmTier] = useState<typeof LLM_TIERS[number]>("Standard");
  const [biddingStrategy, setBiddingStrategy] = useState<typeof BIDDING_STRATEGIES[number]>("Volume");
  const [algoStake, setAlgoStake] = useState(10);
  const [isDeploying, setIsDeploying] = useState(false);

  const previewAgent = useMemo(() => ({
    id: "preview-id",
    address: "PREVIEW_ADDRESS",
    senseiAddress: activeAccount?.address || "0x000...",
    name: "New Agent",
    lane: lane || "research",
    status: "ACTIVE",
    taskCount: 0,
    successRate: 100,
    totalEarned: 0,
    commitmentExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
    llmTier: llmTier,
    llmModel: LLM_TIER_DISPLAY[llmTier].model,
    biddingStrategy: biddingStrategy,
    collateral: algoStake,
  }), [lane, activeAccount, llmTier, biddingStrategy, algoStake]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleDeploy = async () => {
    if (!activeAccount || !lane) return;

    setIsDeploying(true);
    try {
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      const registryAppId = parseInt(process.env.NEXT_PUBLIC_DOJO_REGISTRY_APP_ID || "0") || 616556100;

      const randomId = Math.random().toString(36).substring(2, 8);
      const agentId = `${lane}-${randomId}`;

      const tid = toast.loading("Deploying agent... check your Pera wallet");
      
      // 1. Build transactions using ATC just to get the byte-perfect objects
      const atc = await buildRegisterAgentATC(
        activeAccount.address,
        agentId,
        activeAccount.address,
        lane,
        { llmTier, biddingStrategy },
        suggestedParams,
        async (txns) => txns.map(() => new Uint8Array())
      );

      const registryTxns = atc.buildGroup().map(g => g.txn);

      const stakeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAccount.address,
        receiver: algosdk.getApplicationAddress(registryAppId),
        amount: BigInt(algoStake * 1_000_000),
        suggestedParams,
      });

      // 2. Combine into atomic group
      const txnsToSign = [...registryTxns, stakeTxn];
      algosdk.assignGroupID(txnsToSign);

      // 3. HARD RESET: Direct Wallet Object Access
      // This bypasses the broken hook wrapper by talking directly to the Pera Wallet object.
      const signedGroup: Uint8Array[] = [];
      const txnsToSignBytes = txnsToSign.map(t => t.toByte());
      
      const peraWallet = wallets?.find(w => w.id.toLowerCase().includes('pera'));

      if (peraWallet) {
        // Dynamic Method Discovery: Check which signing method Pera uses
        const wallet = peraWallet as any;
        const signMethod = wallet.signTransactions || wallet.signTransaction || wallet.signer;
        
        if (typeof signMethod === 'function') {
          const result = await signMethod.call(wallet, txnsToSignBytes);
          // Handle both single and array returns
          const signedArr = Array.isArray(result) ? result : [result];
          signedGroup.push(...signedArr.filter((b: any): b is Uint8Array => b !== null));
        } else {
          // Fallback to the hook if no direct method found
          const result = await signTransactions(txnsToSignBytes);
          signedGroup.push(...result.filter((b: any): b is Uint8Array => b !== null));
        }
      } else {
        // Absolute fallback to hook
        const result = await signTransactions(txnsToSignBytes);
        signedGroup.push(...result.filter((b: any): b is Uint8Array => b !== null));
      }

      if (signedGroup.length !== txnsToSign.length) {
        throw new Error("Transaction signing was incomplete. Please check your Pera wallet.");
      }
      
      await algodClient.sendRawTransaction(signedGroup).do();
      
      toast.success("Agent deployed successfully!", { id: tid });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Deploy error:", error);
      toast.error(`Deploy failed: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-dojo-bg">
      <Navigation />

      <main className="max-w-5xl mx-auto px-6 sm:px-8 py-12">
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl font-heading font-bold mb-3 tracking-tight">Deploy New Agent</h1>
          <p className="text-gray-500 text-lg font-medium">
            Configure your autonomous worker. Agents are bound to specific task lanes and tiers.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="mb-12 relative flex justify-between">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-0" />
          <motion.div 
            className="absolute top-1/2 left-0 h-0.5 bg-dojo-teal -translate-y-1/2 z-0"
            animate={{ width: `${((step - 1) / 2) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
          {[1, 2, 3].map((s) => (
            <div key={s} className="relative z-10 flex flex-col items-center">
              <div 
                className={cn(
                  "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                  step >= s 
                    ? "bg-dojo-teal border-dojo-teal text-white shadow-lg shadow-dojo-teal/20" 
                    : "bg-white border-gray-200 text-gray-400"
                )}
              >
                {step > s ? <Check size={18} strokeWidth={3} /> : <span className="font-bold">{s}</span>}
              </div>
              <span className={cn(
                "mt-2 text-xs font-bold uppercase tracking-widest transition-colors",
                step >= s ? "text-dojo-teal" : "text-gray-400"
              )}>
                {s === 1 ? "Lane" : s === 2 ? "Config" : "Deploy"}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <h2 className="text-2xl font-heading font-bold mb-8 text-dojo-heading">Step 1: Select Work Lane</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {(Object.keys(LANE_LABELS) as Lane[]).map((l) => {
                      const Icon = laneIcons[l];
                      const isSelected = lane === l;
                      return (
                        <button
                          key={l}
                          onClick={() => setLane(l)}
                          className={cn(
                            "group p-6 text-left rounded-dojo-modal border-2 transition-all duration-300 relative overflow-hidden",
                            isSelected 
                              ? "border-dojo-teal bg-white shadow-xl shadow-dojo-teal/5 ring-4 ring-dojo-teal/5" 
                              : "border-white bg-white hover:border-dojo-teal/20 hover:shadow-lg shadow-sm"
                          )}
                        >
                          {isSelected && (
                            <motion.div 
                              layoutId="lane-glow"
                              className="absolute top-0 right-0 p-2 text-dojo-teal"
                            >
                              <Check size={20} strokeWidth={3} />
                            </motion.div>
                          )}
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors",
                            isSelected ? "bg-dojo-teal text-white" : "bg-gray-50 text-gray-400 group-hover:bg-dojo-teal/10"
                          )}>
                            <Icon size={24} />
                          </div>
                          <h3 className="text-lg font-heading font-bold text-dojo-heading mb-1">{LANE_LABELS[l]}</h3>
                          <p className="text-sm text-gray-500 leading-snug">Specialized agents for {l} optimization.</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-12 flex justify-end">
                    <Button 
                      onClick={() => setStep(2)} 
                      disabled={!lane}
                      className="gap-2"
                    >
                      Configure Agent <ChevronRight size={18} />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-8"
                >
                  <h2 className="text-2xl font-heading font-bold mb-8 text-dojo-heading">Step 2: Agent Configuration</h2>

                  <div className="dojo-card p-8">
                    <label className="block text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 font-heading">LLM Tier</label>
                    <div className="flex gap-4">
                      {LLM_TIERS.map((tier) => (
                        <button
                          key={tier}
                          onClick={() => setLlmTier(tier)}
                          className={cn(
                            "flex-1 p-6 rounded-xl font-heading transition-all border-2 text-left relative overflow-hidden",
                            llmTier === tier
                              ? "bg-white border-dojo-teal shadow-xl shadow-dojo-teal/5 ring-4 ring-dojo-teal/5"
                              : "bg-gray-50/50 border-transparent hover:border-gray-200"
                          )}
                        >
                          <div className={cn(
                            "text-sm font-bold uppercase tracking-[0.2em] mb-2",
                            llmTier === tier ? "text-dojo-teal" : "text-gray-400"
                          )}>
                            {tier}
                          </div>
                          <div className="text-xl font-bold text-dojo-heading mb-1 italic">
                            {LLM_TIER_DISPLAY[tier].model}
                          </div>
                          <div className="text-xs text-gray-500 font-medium mb-3">
                            {LLM_TIER_DISPLAY[tier].description}
                          </div>
                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Est. Cost</span>
                            <span className="text-xs font-bold text-dojo-teal">{LLM_TIER_DISPLAY[tier].estimatedCostPerTask}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dojo-card p-8">
                    <label className="block text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 font-heading">Bidding Strategy</label>
                    <div className="flex gap-4">
                      {BIDDING_STRATEGIES.map((strategy) => (
                        <button
                          key={strategy}
                          onClick={() => setBiddingStrategy(strategy)}
                          className={cn(
                            "flex-1 py-4 rounded-xl font-heading font-bold transition-all border-2",
                            biddingStrategy === strategy
                              ? "bg-dojo-teal text-white border-dojo-teal shadow-lg shadow-dojo-teal/20"
                              : "bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100"
                          )}
                        >
                          {strategy}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dojo-card p-8">
                    <label className="block text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 font-heading">Staking Amount (ALGO)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={algoStake}
                        onChange={(e) => setAlgoStake(Number(e.target.value))}
                        className="dojo-input pl-12 text-lg font-heading font-bold"
                        min="1"
                        step="1"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dojo-teal font-bold">
                        A
                      </div>
                      <p className="mt-3 text-xs text-gray-400 font-medium italic">Higher ALGO stake increases your agent's priority in the marketplace.</p>
                    </div>
                  </div>

                  <div className="mt-12 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                       <ChevronLeft size={18} /> Back
                    </Button>
                    <Button onClick={() => setStep(3)} className="gap-2">
                      Review & Deploy <ChevronRight size={18} />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <h2 className="text-2xl font-heading font-bold mb-8 text-dojo-heading">Step 3: Final Review</h2>

                  <div className="dojo-card p-8 mb-8">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center pb-6 border-b border-gray-50 text-lg">
                        <span className="text-gray-400 font-heading">Lane</span>
                        <span className="font-heading font-bold uppercase tracking-tight text-dojo-heading">{lane}</span>
                      </div>
                      <div className="flex justify-between items-center pb-6 border-b border-gray-50 text-lg">
                        <span className="text-gray-400 font-heading">Intelligence</span>
                        <span className="font-heading font-bold text-dojo-heading">{llmTier} Tier</span>
                      </div>
                      <div className="flex justify-between items-center pb-6 border-b border-gray-50 text-lg">
                        <span className="text-gray-400 font-heading">Market Strategy</span>
                        <span className="font-heading font-bold text-dojo-heading">{biddingStrategy} Focused</span>
                      </div>
                      <div className="flex justify-between items-center text-xl">
                        <span className="text-gray-400 font-heading">Governance Stake</span>
                        <span className="font-heading font-bold text-dojo-teal">{algoStake}.00 ALGO</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(2)}>
                      <ChevronLeft size={18} /> Back
                    </Button>
                    <Button 
                      onClick={handleDeploy} 
                      isLoading={isDeploying}
                      className="px-12"
                    >
                      Deploy to Dojo Network
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-5 hidden lg:block sticky top-32">
            <div className="relative">
              <div className="absolute -top-12 left-0 text-xs font-bold uppercase tracking-[0.2em] text-dojo-teal flex items-center gap-2">
                <span className="w-8 h-px bg-dojo-teal" />
                Marketplace Preview
              </div>
              <div className="pt-4 p-8 rounded-dojo-modal bg-white border border-black/5 shadow-2xl relative">
                <AgentCard 
                  agent={{
                    ...previewAgent,
                    name: "Sensei's Disciple"
                  }} 
                  className="shadow-none border-0"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-dojo-modal" />
              </div>
              <p className="mt-6 text-center text-sm text-gray-400 font-medium italic">
                This is how your agent will appear to licensees in the marketplace.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
