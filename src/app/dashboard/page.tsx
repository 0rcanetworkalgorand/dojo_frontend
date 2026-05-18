"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { AgentCard } from "@/components/AgentCard";
import { LiveFeed } from "@/components/LiveFeed";
import { SwarmParticles } from "@/components/SwarmParticles";
import { LANE_LABELS, Lane } from "@/lib/constants/index";
import { formatNumber, formatAlgoDisplay, truncateAddress } from "@/lib/utils/format";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { fetchAgents, fetchStats } from "@/lib/api";
import { motion } from "framer-motion";
import { Plus, Zap, TrendingUp, ShieldCheck, Diamond, ArrowRight } from "lucide-react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils/index";
import Link from "next/link";
import { toast } from "react-hot-toast";
import algosdk from "algosdk";
import { buildLicensingPaymentGroup } from "@/lib/transactions/payoutSplitter";
import { buildStakeAndListAtomicGroup } from "@/lib/transactions/commitmentLock";

const lanes: (Lane | "all")[] = ["all", "research", "code", "data", "outreach"];

export default function DashboardPage() {
  const { activeAccount, transactionSigner, algodClient } = useWallet();
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();
  const [selectedLane, setSelectedLane] = useState<Lane | "all">("all");
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!activeAccount?.address) return;
      try {
        setLoading(true);
        const [agentsData, statsData] = await Promise.all([
          fetchAgents(selectedLane === "all" ? undefined : selectedLane),
          fetchStats(activeAccount.address)
        ]);
        setAgents(agentsData);
        setStats(statsData);
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (isAuthenticated) loadData();
  }, [activeAccount?.address, isAuthenticated, selectedLane]);

  const handleLicense = async (agentId: string) => {
    if (!activeAccount?.address || !transactionSigner) {
      toast.error("Please connect your wallet");
      return;
    }

    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    if (agent.senseiAddress === activeAccount.address) {
      toast.error("You cannot license your own agent");
      return;
    }

    const tid = toast.loading(`Licensing ${agent.name}...`);

    try {
      const atc = await buildLicensingPaymentGroup({
        algodClient,
        licenseeAddress: activeAccount.address,
        senseiAddress: agent.senseiAddress,
        treasuryAddress: "W6LEUYW6TMZ64QE7UKT4R66I6I6K6WJSYNY54IQUK7RHLREWCUKYMEG2TM",
        feeAmountAlgo: BigInt(50 * 1_000_000),
        signer: transactionSigner
      });

      const result = await atc.execute(algodClient, 3);
      const txId = result.txIDs[0];

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/licenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress: agent.address,
          licenseeAddress: activeAccount.address,
          txId,
          feeUsdc: 50000000
        })
      });

      if (!response.ok) throw new Error("Failed to record license on backend");

      toast.success("License acquired successfully!", { id: tid });
    } catch (err: any) {
      console.error("Licensing error:", err);
      toast.error(`Licensing failed: ${err.message}`, { id: tid });
    }
  };

  const handleStake = async (agentId: string) => {
    if (!activeAccount?.address || !transactionSigner) {
      toast.error("Please connect your wallet");
      return;
    }

    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const tid = toast.loading(`Staking 10 USDC for ${agent.name}...`);

    try {
      const atc = await buildStakeAndListAtomicGroup({
        algodClient,
        senseiAddress: activeAccount.address,
        agentAddress: agent.address,
        usdcAssetId: parseInt(process.env.NEXT_PUBLIC_USDC_ASSET_ID || "0"),
        stakeAmountUsdc: BigInt(10 * 1_000_000),
        durationDays: 30,
        commitmentLockAppId: parseInt(process.env.NEXT_PUBLIC_COMMITMENT_LOCK_APP_ID || "0"),
        dojoRegistryAppId: parseInt(process.env.NEXT_PUBLIC_DOJO_REGISTRY_APP_ID || "0"),
        signer: transactionSigner
      });

      const result = await atc.execute(algodClient, 3);
      const txId = result.txIDs[0];

      toast.success("Stake successful!", { id: tid });
    } catch (err: any) {
      console.error("Staking error:", err);
      toast.error(`Staking failed: ${err.message}`, { id: tid });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <SwarmParticles className="opacity-30" />
      <Navigation />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome to the Dojo
            </h1>
            <span className="text-sm text-muted font-medium">
              {truncateAddress(activeAccount?.address || "", 6)}
            </span>
          </div>
          <p className="text-muted max-w-2xl text-base leading-relaxed">
            Your command center for managing agents, monitoring tasks, and tracking performance across all lanes.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Active Agents", value: agents.filter(a => a.status === "ACTIVE").length, icon: <Zap size={18} /> },
            { label: "Daily Tasks", value: stats?.dailyTasks || 0, icon: <TrendingUp size={18} /> },
            { label: "Swarm Volume", value: `${formatAlgoDisplay(stats?.totalVolume || 0)} ALGO`, icon: <ShieldCheck size={18} /> }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  {stat.icon}
                </div>
                <span className="text-sm font-medium text-muted">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {stat.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Agent Grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Active Agents</h2>
              <div className="flex gap-2">
                {lanes.map((lane) => (
                  <button
                    key={lane}
                    onClick={() => setSelectedLane(lane)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      selectedLane === lane
                        ? "bg-accent text-white"
                        : "bg-black/[0.03] text-muted hover:text-foreground hover:bg-black/[0.06]"
                    )}
                  >
                    {lane === "all" ? "All" : LANE_LABELS[lane]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent, i) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AgentCard
                    agent={agent}
                    onLicense={handleLicense}
                    onStake={handleStake}
                    isOwner={agent.senseiAddress === activeAccount?.address}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap size={16} className="text-accent" /> Live Activity
              </h3>
              <LiveFeed />
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Quick Deploy</h3>
              <p className="text-xs text-muted mb-4">
                Deploy a new AI agent to the swarm marketplace.
              </p>
              <Link href="/build">
                <Button variant="primary" size="sm" className="w-full">
                  <Plus size={16} /> Deploy Agent
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
