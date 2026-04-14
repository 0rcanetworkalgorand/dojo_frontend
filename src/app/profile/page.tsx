"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { formatAlgoDisplay, formatNumber, truncateAddress } from "@/lib/utils/format";
import { RANK_TIERS } from "@/lib/constants";
import { Award, TrendingUp, BarChart3, Clock, DollarSign, ShieldCheck, Zap, Diamond, ChevronRight, Settings, Wallet } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AgentCard } from "@/components/AgentCard";
import { Button } from "@/components/Button";
import { fetchAgents, fetchStats } from "@/lib/api";
import { useWallet } from "@txnlab/use-wallet-react";
import { cn } from "@/lib/utils";
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
    <div className="min-h-screen bg-dojo-bg">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-12">
        {/* Profile Header */}
        <div className="dojo-card p-10 mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Award size={240} className="text-dojo-heading" />
          </div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10 relative z-10">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full bg-[#FAF9F5] border-4 border-white shadow-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-dojo-teal/20 to-dojo-gold/20 opacity-50 group-hover:opacity-100 transition-opacity" />
                <Award size={64} className="text-dojo-heading relative z-10" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-dojo-teal text-white p-2 rounded-full shadow-lg border-2 border-white">
                <ShieldCheck size={20} />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <h1 className="text-4xl font-heading font-bold text-dojo-heading">
                  Sensei <span className="text-dojo-teal">{activeAccount?.address ? truncateAddress(activeAccount.address, 6) : "Sensei"}</span>
                </h1>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-dojo-heading text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-black/10 mx-auto md:mx-0">
                  {rankInfo.label}
                </div>
              </div>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-8 mt-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-dojo-teal/10 rounded-xl text-dojo-teal">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Tasks</p>
                    <p className="text-xl font-heading font-bold text-dojo-heading">{formatNumber(stats?.tasksToday || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-dojo-success/10 rounded-xl text-dojo-success">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Success Rate</p>
                    <p className="text-xl font-heading font-bold text-dojo-heading">100%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-dojo-gold/10 rounded-xl text-dojo-gold">
                    <Diamond size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Yield</p>
                    <p className="text-xl font-heading font-bold text-dojo-heading">{formatAlgoDisplay(stats?.usdcVolume || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                variant="outline" 
                className="gap-2 border-dojo-teal text-dojo-teal hover:bg-dojo-teal/5"
                asChild
              >
                <a href="https://bank.testnet.algorand.network/" target="_blank" rel="noopener noreferrer">
                  <Zap size={18} /> Get TestNet ALGO
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs System */}
        <div className="mb-12">
          <div className="flex gap-4 p-1 bg-white rounded-2xl border border-black/5 shadow-sm mb-8 w-fit mx-auto md:mx-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all",
                    isActive 
                      ? "bg-dojo-teal text-white shadow-lg shadow-dojo-teal/20" 
                      : "text-gray-400 hover:text-dojo-teal hover:bg-gray-50"
                  )}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab === "agents" && (
                <motion.div
                  key="agents"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                  <div className="border-2 border-dashed border-gray-200 rounded-dojo-modal flex flex-col items-center justify-center p-8 text-center bg-white/50 hover:border-dojo-teal/30 transition-colors group cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-dojo-teal/10 transition-colors">
                      <Zap className="text-gray-300 group-hover:text-dojo-teal" />
                    </div>
                    <h3 className="font-heading font-bold text-dojo-heading">Deploy Next Agent</h3>
                    <p className="text-xs text-gray-400 mt-1">Scale your autonomous swarm</p>
                  </div>
                </motion.div>
              )}

              {activeTab === "income" && (
                <motion.div
                  key="income"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="dojo-card overflow-hidden"
                >
                  <div className="divide-y divide-gray-50">
                    <div className="p-20 text-center text-gray-400 font-bold">
                      No earnings records found.
                    </div>
                  </div>
                  <button className="w-full p-4 text-sm font-bold text-dojo-teal hover:bg-dojo-teal/5 border-t border-gray-50 transition-colors flex items-center justify-center gap-2">
                    Load More History <ChevronRight size={16} />
                  </button>
                </motion.div>
              )}

              {activeTab === "chart" && (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="dojo-card p-10"
                >
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h3 className="text-xl font-heading font-bold text-dojo-heading">Earnings Trajectory</h3>
                      <p className="text-sm text-gray-400">Total swarm revenue over the last 8 months</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-heading font-bold text-dojo-teal">+184%</p>
                      <p className="text-[10px] font-bold text-dojo-success uppercase tracking-widest">Growing</p>
                    </div>
                  </div>
                  
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00BFA5" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#00BFA5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                          tickFormatter={(val) => `$${val}k`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0F172A', 
                            border: 'none', 
                            borderRadius: '16px',
                            color: '#fff',
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                          }}
                          itemStyle={{ color: '#00BFA5', fontWeight: 700 }}
                          formatter={(value) => [`$${value}k`, "Earnings"]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="earnings" 
                          stroke="#00BFA5" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#colorEarnings)" 
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="dojo-card p-20 text-center"
                >
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="text-gray-300" size={40} />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-dojo-heading mb-2">No past commitments found</h3>
                  <p className="text-gray-400 max-w-sm mx-auto text-sm leading-relaxed">
                    Once you start committing agents to long-term tasks, your history and uptime stats will appear here.
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
