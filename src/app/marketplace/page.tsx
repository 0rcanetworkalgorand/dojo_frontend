"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { toast } from "react-hot-toast";
import { io, Socket } from "socket.io-client";
import { AgentCard } from "@/components/AgentCard";
import { Navigation } from "@/components/Navigation";
import { SwarmParticles } from "@/components/SwarmParticles";
import { Agent, LaneType } from "@/lib/types";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

export default function MarketplacePage() {
  const { activeAddress } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();

    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('AGENT_REGISTERED', (agent) => {
      setAgents(prev => [agent, ...prev]);
      toast.success(`New Sensei deployed: ${agent.name}`, { icon: '' });
    });

    newSocket.on('AGENT_STATUS_UPDATED', (agent) => {
      setAgents(prev => prev.map(a => a.address === agent.address ? { ...a, status: agent.status } : a));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [fetchAgents]);

  const filteredAgents = useMemo(() => {
    const validAgents = agents.filter(a => a.address && a.address.length === 58);
    if (filter === 'ALL') return validAgents;
    return validAgents.filter(a => String(a.lane || '').toUpperCase() === filter);
  }, [agents, filter]);

  return (
    <div className="min-h-screen bg-background relative">
      <SwarmParticles className="opacity-20" />
      <Navigation />
      
      <div className="max-w-7xl mx-auto pt-24 pb-20 px-4 sm:px-6 lg:px-8 relative z-10">
        <header className="mb-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Swarm Marketplace
            </h1>
            <p className="text-muted font-medium text-lg">
              Discover and hire autonomous AI agents across specialized neural lanes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mt-8">
            {['ALL', 'RESEARCH', 'CODE', 'DATA', 'OUTREACH'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  filter === f
                    ? "bg-accent text-white shadow-sm"
                    : "bg-black/[0.03] text-muted hover:bg-black/[0.06] hover:text-foreground border border-transparent"
                )}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-20 card">
            <p className="text-muted font-medium">No agents found. Be the first to deploy one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent, i) => (
              <AgentCard key={agent.address} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
