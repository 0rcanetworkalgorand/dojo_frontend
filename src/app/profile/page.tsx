"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { SwarmParticles } from "@/components/SwarmParticles";
import { formatAlgoDisplay, formatNumber, truncateAddress } from "@/lib/utils/format";
import { RANK_TIERS } from "@/lib/constants/index";
import { Award, TrendingUp, BarChart3, Clock, DollarSign, ShieldCheck, Zap, Diamond, ChevronRight, Settings, Wallet, ArrowRight, Plus } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AgentCard } from "@/components/AgentCard";
import { Button } from "@/components/Button";
import { fetchAgents, fetchStats } from "@/lib/api";
import { useWallet } from "@txnlab/use-wallet-react";
import { cn } from "@/lib/utils/index";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import algosdk from "algosdk";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

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
  const { activeAccount, transactionSigner } = useWallet();
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();
  const { earnings: liveEvents } = useLiveFeed();
  const [activeTab, setActiveTab] = useState("agents");
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [algoBalance, setAlgoBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadProfile = async (silent = false) => {
    if (!activeAccount?.address) return;
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      
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
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadProfile();
  }, [activeAccount?.address, isAuthenticated]);

  // Handle Real-time updates from WebSocket
  useEffect(() => {
    if (liveEvents.length > 0) {
      const lastEvent = liveEvents[0];
      // Refresh if it's a settlement event or status update relevant to us
      if (["TASK_SETTLED", "AGENT_REGISTERED", "TASK_STATUS"].includes(lastEvent.type)) {
        console.log("[Profile] Real-time event detected, refreshing stats...");
        loadProfile(true); 
      }
    }
  }, [liveEvents]);

  if (authLoading || (loading && !stats)) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  const rankInfo = RANK_TIERS["apprentice"]; // Default to apprentice or compute from stats

  return (
    <div className="min-h-screen bg-dojo-bg relative overflow-hidden">
      <SwarmParticles />
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 sm:px-12 py-20 relative z-10">
        {/* Profile Header */}
        <div className="dojo-card p-12 mb-16 relative overflow-hidden group">
          <div className="absolute -right-20 -bottom-20 p-8 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Award size={480} className="text-white" />
          </div>
          
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12 relative z-10">
            <div className="relative">
              <div className="w-40 h-40 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center relative overflow-hidden group/avatar">
                <div className="absolute inset-0 bg-gradient-to-br from-dojo-teal/10 to-transparent opacity-50 group-hover/avatar:opacity-100 transition-opacity" />
                <Award size={80} className="text-white/20 relative z-10 group-hover/avatar:text-dojo-teal transition-colors duration-500" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-dojo-teal text-black p-2.5 rounded-full shadow-[0_0_15px_rgba(0,245,212,0.4)] border border-white/20">
                <ShieldCheck size={24} />
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-8">
                <h1 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">
                  Sensei <span className="text-dojo-teal">{activeAccount?.address ? truncateAddress(activeAccount.address, 6) : "Unknown"}</span>
                </h1>
                <div className="px-5 py-1.5 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl mx-auto lg:mx-0">
                  {rankInfo.label}
                </div>
              </div>
              
              <div className="flex flex-wrap justify-center lg:justify-start gap-12 mt-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/[0.05] rounded-2xl text-dojo-teal">
                    <Zap size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Total Tasks</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{formatNumber(stats?.tasksToday || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/[0.05] rounded-2xl text-dojo-success">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Success Rate</p>
                    <p className="text-2xl font-bold text-dojo-success tracking-tight">100%</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/[0.05] rounded-2xl text-dojo-gold">
                    <Diamond size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Swarm Yield</p>
                    <p className="text-2xl font-bold text-dojo-gold tracking-tight">{formatAlgoDisplay(stats?.usdcVolume || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button variant="outline" className="!px-10 group/btn" asChild>
                <a href="https://bank.testnet.algorand.network/" target="_blank" rel="noopener noreferrer">
                  GET TESTNET ALGO <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs System */}
        <div className="mb-20">
          <div className="flex flex-wrap gap-2 mb-12 w-fit mx-auto lg:mx-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 border",
                    isActive 
                      ? "bg-white text-black border-white shadow-xl" 
                      : "bg-white/[0.03] text-white/40 border-white/[0.05] hover:border-white/20 hover:text-white"
                  )}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab === "agents" && (
                <motion.div
                  key="agents"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                  <Link href="/build" className="group h-full">
                    <div className="h-full dojo-card-hover border-2 border-dashed border-white/10 rounded-dojo-modal flex flex-col items-center justify-center p-12 text-center bg-white/[0.01] transition-all duration-500">
                      <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-dojo-teal/10 transition-all">
                        <Plus className="text-white/20 group-hover:text-dojo-teal" />
                      </div>
                      <h3 className="font-black text-white uppercase tracking-tighter text-lg">Deploy Next Agent</h3>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mt-2">Expand Hive Capability</p>
                    </div>
                  </Link>
                </motion.div>
              )}

              {activeTab === "income" && (
                <motion.div
                  key="income"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="dojo-card overflow-hidden"
                >
                  <div className="p-40 text-center">
                    <p className="text-white/20 font-black uppercase tracking-[0.2em] text-sm">No transaction records detected.</p>
                  </div>
                  <button className="w-full py-6 text-[10px] font-black uppercase tracking-widest text-dojo-teal hover:bg-white/[0.03] border-t border-white/[0.05] transition-all flex items-center justify-center gap-3">
                    Sync Ledger Data <ChevronRight size={14} />
                  </button>
                </motion.div>
              )}

              {activeTab === "chart" && (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="dojo-card p-12"
                >
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                    <div>
                        <p className="text-[10px] font-black text-dojo-teal uppercase tracking-[0.3em] mb-4">Performance Metrics</p>
                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Yield Trajectory</h3>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-5xl font-black text-dojo-teal tracking-tighter mb-1">+184%</p>
                      <p className="text-[10px] font-black text-dojo-success uppercase tracking-[0.2em]">Sustained Growth</p>
                    </div>
                  </div>
                  
                  <div className="h-[450px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00F5D4" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#00F5D4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900, textAnchor: 'middle' }}
                          dy={20}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900 }}
                          tickFormatter={(val) => `$${val}K`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0A0A0A', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '20px',
                            color: '#fff',
                            padding: '20px',
                            backdropFilter: 'blur(20px)'
                          }}
                          itemStyle={{ color: '#00F5D4', fontWeight: 900, textTransform: 'uppercase', fontSize: '12px' }}
                          formatter={(value) => [`$${value}k`, "Earnings"]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="earnings" 
                          stroke="#00F5D4" 
                          strokeWidth={6} 
                          fillOpacity={1} 
                          fill="url(#colorEarnings)" 
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="dojo-card p-32 text-center"
                >
                  <div className="w-24 h-24 bg-white/[0.03] border border-white/[0.05] rounded-full flex items-center justify-center mx-auto mb-8">
                    <Clock className="text-white/10" size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Historical Gap</h3>
                  <p className="text-white/30 max-w-sm mx-auto text-sm font-medium leading-relaxed uppercase tracking-widest text-xs">
                    Commit agents to long-term operations to populate swarm logs.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
