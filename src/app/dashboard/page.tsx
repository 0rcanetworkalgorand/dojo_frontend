"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { AgentCard } from "@/components/AgentCard";
import { LiveFeed } from "@/components/LiveFeed";
import { SwarmParticles } from "@/components/SwarmParticles";
import { LANE_LABELS, Lane } from "@/lib/constants";
import { formatNumber, formatAlgoDisplay, truncateAddress } from "@/lib/utils/format";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { fetchAgents, fetchStats } from "@/lib/api";
import { motion } from "framer-motion";
import { Plus, Zap, TrendingUp, ShieldCheck, Diamond, ArrowRight } from "lucide-react";
import { Button } from "@/components/Button";
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
        treasuryAddress: "W6LEUYW6TMZ64QE7UKT4R66I6I6K6WJSYNY54IQUK7RHLREWCUKYMEG2TM", // Treasury from env or constant
        feeAmountAlgo: BigInt(50 * 1_000_000), // 50 ALGO fixed for now
        signer: transactionSigner
      });

      const result = await atc.execute(algodClient, 3);
      const txId = result.txIDs[0];

      // Notify backend
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
      // Optionally refresh stats or agents
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
        stakeAmountUsdc: BigInt(10 * 1_000_000),
        durationDays: 30,
        commitmentLockAppId: Number(process.env.NEXT_PUBLIC_COMMITMENT_LOCK_APP_ID),
        dojoRegistryAppId: Number(process.env.NEXT_PUBLIC_DOJO_REGISTRY_APP_ID),
        usdcAssetId: Number(process.env.NEXT_PUBLIC_USDC_ASSET_ID || 10458941),
        signer: transactionSigner
      });

      await atc.execute(algodClient, 4);
      
      toast.success("Agent staked and listed successfully!", { id: tid });
      // Refresh data
      const agentsData = await fetchAgents(selectedLane === "all" ? undefined : selectedLane);
      setAgents(agentsData);
    } catch (err: any) {
      console.error("Staking error:", err);
      toast.error(`Staking failed: ${err.message}`, { id: tid });
    }
  };

  if (authLoading || (loading && !stats)) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayName = activeAccount?.address
    ? truncateAddress(activeAccount.address, 6)
    : "Sensei";

  const myAgents = agents.filter(a => a.senseiAddress === activeAccount?.address);

  return (
    <div className="min-h-screen bg-dojo-bg relative overflow-hidden">
      <SwarmParticles />
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-12 relative z-10">
        {/* Hero Section */}
        <div className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl font-heading font-bold mb-4 tracking-tight">
              Welcome to the Dojo, <span className="text-dojo-teal">Sensei {displayName}</span>
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl font-medium leading-relaxed">
              Your command center for premium AI swarms. Monitor performance, 
              deploy new agents, and manage your decentralized workspace.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {[
              { label: "Active Agents", value: stats?.totalAgents || 0, icon: Zap, color: "text-dojo-teal" },
              { label: "Daily Tasks", value: stats?.tasksToday || 0, icon: TrendingUp, color: "text-dojo-success" },
              { label: "Swarm Volume", value: formatAlgoDisplay(stats?.usdcVolume || 0), icon: Diamond, color: "text-dojo-gold" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.3 }}
                className="dojo-card p-8 flex items-center justify-between group cursor-default"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2 font-heading">
                    {stat.label}
                  </p>
                  <p className={stat.color + " text-3xl font-heading font-bold"}>
                    {stat.value}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-dojo-teal/5 transition-colors">
                  <stat.icon className={stat.color} size={28} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Content: Agents Grid */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold text-dojo-heading">Top Ranked Agents</h2>
              <div className="flex gap-2 p-1 bg-white rounded-xl border border-black/5 shadow-sm">
                {lanes.map((lane) => (
                  <button
                    key={lane}
                    onClick={() => setSelectedLane(lane)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      selectedLane === lane
                        ? "bg-dojo-teal text-white shadow-md shadow-dojo-teal/20"
                        : "text-gray-400 hover:text-dojo-teal hover:bg-gray-50"
                    }`}
                  >
                    {lane === "all" ? "All" : lane}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <AgentCard 
                  key={agent.id} 
                  agent={agent} 
                  onLicense={handleLicense}
                  onStake={handleStake}
                  isOwner={agent.senseiAddress === activeAccount?.address}
                />
              ))}
              {agents.length === 0 && (
                <div className="col-span-2 py-20 text-center text-gray-400 font-heading">
                  No active agents matching these criteria.
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            {/* Live Feed Panel */}
            <div className="h-[500px] dojo-card overflow-hidden flex flex-col">
              <LiveFeed />
            </div>

            {/* My Active Agents Quick View */}
            <div className="dojo-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading font-bold text-dojo-heading">My Active Agents</h3>
                <Link href="/profile" className="text-xs font-bold text-dojo-teal uppercase tracking-wider hover:underline">
                  View All
                </Link>
              </div>
              <div className="space-y-4">
                {myAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-lg bg-dojo-bg flex items-center justify-center font-bold text-gray-400">
                      {agent.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-dojo-heading group-hover:text-dojo-teal transition-colors">{agent.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{agent.lane}</p>
                    </div>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-dojo-teal" />
                  </div>
                ))}
                <Link href="/build">
                  <button className="w-full mt-4 flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-dojo-teal hover:text-dojo-teal hover:bg-dojo-teal/5 transition-all text-sm font-bold">
                    <Plus size={18} /> Deploy New Agent
                  </button>
                </Link>
              </div>
            </div>

            {/* Stake Shortcut */}
            <div className="bg-gradient-to-br from-dojo-teal/10 to-dojo-teal/5 p-8 rounded-dojo-modal shadow-lg border border-dojo-teal/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShieldCheck size={120} className="text-dojo-teal" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-heading font-bold text-dojo-heading mb-2">Commit & Secure</h3>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed font-medium">
                  Stake ALGO to increase your Sensei rank and unlock higher task tiers.
                </p>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" className="w-full border-dojo-teal text-dojo-teal hover:bg-dojo-teal hover:text-white" asChild>
                    <a href="https://bank.testnet.algorand.network/" target="_blank" rel="noopener noreferrer">
                      Get TestNet ALGO
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
