"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import algosdk from "algosdk";
import { Navigation } from "@/components/Navigation";
import { SwarmParticles } from "@/components/SwarmParticles";
import { AgentCard } from "@/components/AgentCard";
import { Button } from "@/components/Button";
import { LANE_COLORS, LANE_LABELS, Lane, LLM_TIERS, BIDDING_STRATEGIES } from "@/lib/constants/index";
import { LLM_TIER_DISPLAY } from "@/lib/constants/llmTiers";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Code, Search, Megaphone, Check, ChevronRight, ChevronLeft, Eye, EyeOff, Clock } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { buildStakeCommitmentATC } from "@/lib/transactions/commitmentLock";

const laneIcons = {
  research: Search,
  code: Code,
  data: Database,
  outreach: Megaphone,
};

export default function BuildPage() {
  const router = useRouter();
  const { activeAccount, signTransactions, algodClient } = useWallet();
  const { isAuthenticated, isLoading } = useAuthGuard();
  const [step, setStep] = useState(1);
  const [lane, setLane] = useState<Lane | null>(null);
  const [agentName, setAgentName] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameChecking, setNameChecking] = useState(false);
  const [llmTier, setLlmTier] = useState<typeof LLM_TIERS[number]>("Standard");
  const [biddingStrategy, setBiddingStrategy] = useState<typeof BIDDING_STRATEGIES[number]>("Volume");
  const [algoStake, setAlgoStake] = useState(1);
  const [lockDays, setLockDays] = useState<30 | 60 | 90>(30);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  const previewAgent = useMemo(() => ({
    id: "preview-id",
    address: "PREVIEW_ADDRESS",
    senseiAddress: activeAccount?.address || "0x000...",
    name: agentName || "New Agent",
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
  }), [lane, activeAccount, agentName, llmTier, biddingStrategy, algoStake]);

  const checkNameAvailability = async (name: string) => {
    if (!name || name.length < 3) {
      setNameError(name.length > 0 ? "Name must be at least 3 characters" : "");
      return;
    }
    setNameChecking(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/check-name?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.exists) {
        setNameError("Name already taken");
      } else {
        setNameError("");
      }
    } catch {
      setNameError("");
    } finally {
      setNameChecking(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleDeploy = async () => {
    if (!activeAccount || !lane) return;

    setIsDeploying(true);
    const tid = toast.loading("Preparing agent deployment...");
    try {
      const commitmentLockAppId = parseInt(process.env.NEXT_PUBLIC_COMMITMENT_LOCK_APP_ID || "0") || 761941684;

      const randomId = Math.random().toString(36).substring(2, 8);
      const agentId = `${lane}-${randomId}`;

      console.log(`[Build] Starting deployment for Agent: ${agentId}`);
      
      // Step 1: Stake ALGO into CommitmentLock with proper lock period
      toast.loading("Sign the ALGO stake transaction...", { id: tid });
      
      const stakeAmountMicro = BigInt(algoStake * 1_000_000);
      
      const atc = await buildStakeCommitmentATC({
        algodClient,
        commitmentAppId: commitmentLockAppId,
        senderAddress: activeAccount.address,
        stakeId: agentId,
        amountAlgo: stakeAmountMicro,
        lockDays,
        signer: algosdk.makeEmptyTransactionSigner(),
      });

      const txGroup = atc.buildGroup();
      const rawTxns = txGroup.map(t => t.txn.toByte());
      console.log("[Build] Raw txns to sign:", rawTxns.length, rawTxns.map(t => t.length));

      const signedTxns = await signTransactions(rawTxns);
      if (!signedTxns || signedTxns.length === 0) {
        throw new Error("Wallet returned no signatures");
      }

      toast.loading("Submitting ALGO stake to CommitmentLock...", { id: tid });
      const sendResult = await algodClient.sendRawTransaction(signedTxns.filter(s => s !== null) as Uint8Array[]).do();
      const stakeTxId = (sendResult as any).txId || (sendResult as any).txid;
      await algosdk.waitForConfirmation(algodClient, stakeTxId, 4);
      console.log(`[Build] CommitmentLock stake confirmed. TxId: ${stakeTxId}`);

      // Step 2: Send API request to register agent via backend (admin-signed config binding)
      toast.loading("Registering agent on 0rca Dojo...", { id: tid });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          agentName: agentName.trim(),
          senseiAddress: activeAccount.address,
          lane: lane.toUpperCase(),
          llmTier,
          biddingStrategy,
          openaiApiKey,
          lockDays,
          stakeAmount: algoStake,
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || err.error || 'Backend registration failed');
      }

      const regResult = await response.json();
      console.log("[Build] Backend registration success! On-chain Tx:", regResult.txId);
      
      toast.success("Agent deployed successfully!", { id: tid });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Deploy error:", error);
      toast.error(`Deploy failed: ${error.message}`, { id: tid });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-dojo-bg relative overflow-hidden">
      <SwarmParticles />
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 sm:px-12 py-20 relative z-10">
        <div className="max-w-3xl mb-20">
          <h1 className="text-6xl md:text-7xl font-black text-foreground mb-6 uppercase tracking-tighter leading-none">
            Deploy<br/>New Agent
          </h1>
          <p className="text-muted font-medium uppercase tracking-[0.2em] text-xs">
            Autonomous Configuration // Hive Expansion Protocol
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="mb-20 relative flex justify-between max-w-2xl">
          <div className="absolute top-1/2 left-0 w-full h-px bg-black/[0.1] -translate-y-1/2 z-0" />
          <motion.div 
            className="absolute top-1/2 left-0 h-px bg-dojo-teal -translate-y-1/2 z-0"
            animate={{ width: `${((step - 1) / 2) * 100}%` }}
            transition={{ duration: 0.8 }}
          />
          {[1, 2, 3].map((s) => (
            <div key={s} className="relative z-10 flex flex-col items-center">
              <div 
                className={cn(
                  "w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-500",
                  step >= s 
                    ? "bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                    : "bg-dojo-bg border-black/[0.1] text-muted"
                )}
              >
                {step > s ? <Check size={20} strokeWidth={3} /> : <span className="font-black text-xs">{s}</span>}
              </div>
              <span className={cn(
                "mt-4 text-[10px] font-black uppercase tracking-widest transition-colors",
                step >= s ? "text-foreground" : "text-muted"
              )}>
                {s === 1 ? "Sector" : s === 2 ? "Logic" : "Verify"}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20 items-start">
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter mb-10">Sector Allocation</h2>

                  <div className="dojo-card p-10 mb-10">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-6">Agent Name</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => {
                        setAgentName(e.target.value);
                        setNameError("");
                      }}
                      onBlur={() => checkNameAvailability(agentName)}
                      placeholder="e.g. Nexus, Cipher, Atlas..."
                      className={cn(
                        "dojo-input !bg-black/[0.02] !border-black/[0.1] !text-foreground px-8 py-5 rounded-2xl text-lg font-bold tracking-tight focus:!border-dojo-teal transition-all w-full",
                        nameError && "!border-red-500"
                      )}
                      maxLength={24}
                    />
                    {nameError && (
                      <p className="mt-3 text-[10px] text-red-500 font-black uppercase tracking-widest">{nameError}</p>
                    )}
                    {nameChecking && (
                      <p className="mt-3 text-[10px] text-muted font-black uppercase tracking-widest">Checking availability...</p>
                    )}
                    {agentName && !nameError && !nameChecking && agentName.length >= 3 && (
                      <p className="mt-3 text-[10px] text-dojo-teal font-black uppercase tracking-widest">✓ Name available</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {(Object.keys(LANE_LABELS) as Lane[]).map((l) => {
                      const Icon = laneIcons[l];
                      const isSelected = lane === l;
                      return (
                        <button
                          key={l}
                          onClick={() => setLane(l)}
                          className={cn(
                            "group p-8 text-left rounded-dojo-modal border transition-all duration-500 relative overflow-hidden",
                            isSelected 
                              ? "border-white bg-white text-black" 
                              : "dojo-card-hover text-muted hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-colors",
                            isSelected ? "bg-black text-foreground" : "bg-black/5 text-muted group-hover:bg-dojo-teal group-hover:text-black"
                          )}>
                            <Icon size={28} />
                          </div>
                          <h3 className={cn(
                            "text-xl font-black uppercase tracking-tighter mb-2 transition-colors",
                            isSelected ? "text-black" : "text-foreground"
                          )}>
                            {isSelected && "[ SELECTED ] "}{LANE_LABELS[l as Lane]}
                          </h3>
                          <p className={cn(
                            "text-xs font-medium uppercase tracking-widest leading-relaxed",
                            isSelected ? "text-black/60" : "text-muted"
                          )}>Neural optimization for {l}.</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-16 flex justify-end">
                    <Button 
                      onClick={() => setStep(2)} 
                      disabled={!lane || !agentName || !!nameError}
                      className="!px-10"
                    >
                      CONFIGURE LOGIC [→]
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
                  className="space-y-10"
                >
                  <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter mb-10">Neural Architecture</h2>

                  <div className="dojo-card p-10">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-8">Intelligence Cluster</label>
                    <div className="grid grid-cols-2 gap-6">
                      {LLM_TIERS.map((tier) => (
                        <button
                          key={tier}
                          onClick={() => setLlmTier(tier)}
                          className={cn(
                            "p-8 rounded-3xl transition-all duration-500 border text-left",
                            llmTier === tier
                              ? "bg-white border-white text-black"
                              : "bg-black/[0.02] border-black/[0.05] text-muted hover:border-black/[0.2]"
                          )}
                        >
                          <div className={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em] mb-4",
                            llmTier === tier ? "text-black/40" : "text-muted"
                          )}>
                            {tier}
                          </div>
                          <div className="text-lg font-black uppercase tracking-tighter mb-6">
                             {LLM_TIER_DISPLAY[tier].model.split('/')[1] || tier}
                          </div>
                          <div className={cn(
                              "pt-6 border-t flex items-center justify-between",
                              llmTier === tier ? "border-black/10" : "border-black/[0.05]"
                          )}>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Cost/Task</span>
                            <span className="text-xs font-black">{LLM_TIER_DISPLAY[tier].estimatedCostPerTask}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dojo-card p-10">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-8">Market Protocol</label>
                    <div className="flex gap-4">
                      {BIDDING_STRATEGIES.map((strategy) => (
                        <button
                          key={strategy}
                          onClick={() => setBiddingStrategy(strategy)}
                          className={cn(
                            "flex-1 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-500 border",
                            biddingStrategy === strategy
                              ? "bg-white text-black border-white"
                              : "bg-black/[0.02] text-muted border-black/[0.05] hover:border-black/[0.2]"
                          )}
                        >
                          {strategy}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dojo-card p-10">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-8">Neural Key [Auth]</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={openaiApiKey}
                        onChange={(e) => {
                          setOpenaiApiKey(e.target.value);
                          setApiKeyError("");
                        }}
                        placeholder="sk-..."
                        className={cn(
                          "dojo-input !bg-black/[0.02] !border-black/[0.1] !text-foreground px-8 py-5 rounded-2xl pr-16 font-mono text-sm uppercase tracking-widest focus:!border-dojo-teal transition-all",
                          apiKeyError && "border-red-500 focus:ring-red-500/10"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                      >
                        {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {apiKeyError && (
                      <p className="mt-4 text-[10px] text-red-500 font-black uppercase tracking-widest">{apiKeyError}</p>
                    )}
                    <p className="mt-6 text-[10px] text-muted font-medium uppercase tracking-widest leading-relaxed">
                      Secured via AES-256-GCM. Never exposed on-chain.
                    </p>
                  </div>

                  <div className="dojo-card p-10">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-8">Governance Collateral [ALGO]</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={algoStake}
                        onChange={(e) => setAlgoStake(Number(e.target.value))}
                        className="dojo-input !bg-black/[0.02] !border-black/[0.1] !text-foreground px-10 py-5 rounded-2xl text-2xl font-black tracking-tighter focus:!border-dojo-teal transition-all"
                        min="1"
                        step="1"
                      />
                      <div className="absolute right-8 top-1/2 -translate-y-1/2 text-muted font-black text-xl">
                        A
                      </div>
                    </div>
                    <p className="mt-6 text-[10px] text-muted font-medium uppercase tracking-widest">Stake depth determines marketplace ranking and priority.</p>
                  </div>

                  <div className="dojo-card p-10">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-8">
                      <Clock size={12} className="inline mr-2" />Lock Duration
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {([30, 60, 90] as const).map((days) => (
                        <button
                          key={days}
                          onClick={() => setLockDays(days)}
                          className={cn(
                            "py-6 rounded-2xl font-black uppercase tracking-widest text-center transition-all duration-500 border",
                            lockDays === days
                              ? "bg-white text-black border-white"
                              : "bg-black/[0.02] text-muted border-black/[0.05] hover:border-black/[0.2]"
                          )}
                        >
                          <div className="text-2xl tracking-tighter mb-1">{days}</div>
                          <div className="text-[9px] tracking-[0.2em] opacity-60">DAYS</div>
                        </button>
                      ))}
                    </div>
                    <p className="mt-6 text-[10px] text-muted font-medium uppercase tracking-widest">Your staked ALGOs are locked in the CommitmentLock contract for this duration. Longer lock = higher trust signal.</p>
                  </div>

                  <div className="mt-16 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(1)} className="!px-10">
                       [←] BACK
                    </Button>
                    <Button 
                      onClick={() => {
                        if (!openaiApiKey) {
                          setApiKeyError("API key is required");
                          return;
                        }
                        const isGroq = openaiApiKey.startsWith("gsk_");
                        const isOpenAICompatible = openaiApiKey.startsWith("sk-");
                        
                        if (!isGroq && !isOpenAICompatible) {
                          setApiKeyError("Invalid API key format");
                          return;
                        }
                        setStep(3);
                      }} 
                      className="!px-10"
                    >
                      VERIFY DEPLOY [→]
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
                  <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter mb-10">Final Verification</h2>

                  <div className="dojo-card p-12 mb-12">
                    <div className="space-y-8">
                      <div className="flex justify-between items-center pb-8 border-b border-black/[0.05]">
                        <span className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">Agent Name</span>
                        <span className="text-xl font-black text-foreground tracking-tighter">{agentName}</span>
                      </div>
                      <div className="flex justify-between items-center pb-8 border-b border-black/[0.05]">
                        <span className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">Operational Sector</span>
                        <span className="text-xl font-black text-foreground uppercase tracking-tighter">{lane}</span>
                      </div>
                      <div className="flex justify-between items-center pb-8 border-b border-black/[0.05]">
                        <span className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">Neural Tier</span>
                        <span className="text-xl font-black text-foreground uppercase tracking-tighter">{llmTier}</span>
                      </div>
                      <div className="flex justify-between items-center pb-8 border-b border-black/[0.05]">
                        <span className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">System Logic</span>
                        <span className="text-xl font-black text-foreground uppercase tracking-tighter">{biddingStrategy}</span>
                      </div>
                      <div className="flex justify-between items-center pb-8 border-b border-black/[0.05]">
                        <span className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">Staked Governance</span>
                        <span className="text-3xl font-black text-dojo-teal tracking-tighter">{algoStake}.00 ALGO</span>
                      </div>
                      <div className="flex justify-between items-center pt-4">
                        <span className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">Lock Duration</span>
                        <span className="text-xl font-black text-foreground uppercase tracking-tighter">{lockDays} Days</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-16 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(2)}>
                      [←] BACK
                    </Button>
                    <Button 
                      onClick={handleDeploy} 
                      isLoading={isDeploying}
                      className="!px-16"
                    >
                      INITIALIZE DEPLOYMENT
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-5 hidden lg:block sticky top-32">
            <div className="relative">
              <div className="absolute -top-16 left-0 text-[10px] font-black uppercase tracking-[0.3em] text-muted flex items-center gap-4">
                <span className="w-12 h-px bg-black/[0.1]" />
                Network Preview
              </div>
              <div className="pt-6 p-10 rounded-dojo-modal bg-black/[0.02] border border-black/[0.05] shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-dojo-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <AgentCard 
                  agent={{
                    ...previewAgent,
                    name: "Sensei's Disciple"
                  }} 
                  className="shadow-none border-0 group-hover:scale-[1.02] transition-transform duration-700"
                />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-dojo-bg to-transparent pointer-events-none" />
              </div>
              <p className="mt-10 text-center text-[10px] text-muted font-black uppercase tracking-[0.2em]">
                Verified Node Entry // Dojo Registry
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
