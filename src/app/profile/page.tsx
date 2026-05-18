'use client';

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { SwarmParticles } from "@/components/SwarmParticles";
import { formatAlgoDisplay, formatNumber, truncateAddress } from "@/lib/utils/format";
import { Award, TrendingUp, BarChart3, Clock, DollarSign, ChevronRight, Plus } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AgentCard } from "@/components/AgentCard";
import { fetchAgents, fetchStats } from "@/lib/api";
import { useWallet } from "@txnlab/use-wallet-react";
import { cn } from "@/lib/utils/index";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Agent } from "@/lib/types";

const TABS = [
  { id: "agents", label: "My Agents", icon: BarChart3 },
  { id: "income", label: "Earnings Log", icon: DollarSign },
  { id: "chart", label: "Performance", icon: TrendingUp },
  { id: "history", label: "History", icon: Clock },
];

const chartData = [
  { month: "Jan", earnings: 1.2 },
  { month: "Feb", earnings: 1.8 },
  { month: "Mar", earnings: 1.5 },
  { month: "Apr", earnings: 2.2 },
  { month: "May", earnings: 2.8 },
  { month: "Jun", earnings: 3.2 },
  { month: "Jul", earnings: 2.9 },
  { month: "Aug", earnings: 3.5 },
];

export default function ProfilePage() {
  const { activeAccount } = useWallet();
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();
  const [activeTab, setActiveTab] = useState("agents");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!activeAccount?.address) return;
      try {
        setLoading(true);
        const [agentsData, statsData] = await Promise.all([
          fetchAgents(undefined, activeAccount.address),
          fetchStats(activeAccount.address)
        ]);
        setAgents(agentsData);
        setStats(statsData);
      } catch (err) {
        console.error("Profile data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (isAuthenticated) loadData();
  }, [activeAccount?.address, isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <SwarmParticles className="opacity-20" />
      <Navigation />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        {/* Header */}
        <div className="mb-12">
          <div className="card p-8 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Award size={32} className="text-accent" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-1">
                    {truncateAddress(activeAccount?.address || "", 6)}
                  </h1>
                  <p className="text-sm text-muted">Sensei Profile</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{formatNumber(stats?.tasksToday || 0)}</p>
                  <p className="text-xs text-muted mt-1">Total Tasks</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{Math.round((stats?.successRate || 0) * 100)}%</p>
                  <p className="text-xs text-muted mt-1">Success Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{formatAlgoDisplay(stats?.totalVolume || 0)}</p>
                  <p className="text-xs text-muted mt-1">Swarm Yield</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-accent text-white"
                    : "bg-black/[0.03] text-muted hover:bg-black/[0.06] hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === "agents" && (
              <motion.div
                key="agents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} isOwner />
                  ))}
                  <Link
                    href="/build"
                    className="card p-8 flex flex-col items-center justify-center text-center min-h-[200px] border-dashed border-2 border-black/[0.08] hover:border-accent/30 transition-colors group"
                  >
                    <Plus size={24} className="text-muted group-hover:text-accent mb-3 transition-colors" />
                    <span className="text-sm font-medium text-muted group-hover:text-foreground">Deploy New Agent</span>
                  </Link>
                </div>
              </motion.div>
            )}

            {activeTab === "income" && (
              <motion.div
                key="income"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card p-8 text-center"
              >
                <p className="text-muted">Transaction records will appear here.</p>
              </motion.div>
            )}

            {activeTab === "chart" && (
              <motion.div
                key="chart"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card p-8"
              >
                <h3 className="text-lg font-bold text-foreground mb-6">Yield Trajectory</h3>
                <div className="h-64 flex items-end justify-between gap-2">
                  {chartData.map((data, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-accent/20 rounded-t-lg transition-all hover:bg-accent/30"
                        style={{ height: `${(data.earnings / 4) * 100}%` }}
                      />
                      <span className="text-xs text-muted">{data.month}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card p-8 text-center"
              >
                <p className="text-muted">Historical data will appear here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
