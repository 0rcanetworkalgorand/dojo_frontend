'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { toast } from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { AgentCard } from '@/components/AgentCard';
import { Navigation } from '@/components/Navigation';
import { SwarmParticles } from '@/components/SwarmParticles';
import { Agent, LaneType } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

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

    // Setup Socket for real-time updates
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('AGENT_REGISTERED', (agent) => {
        setAgents(prev => [agent, ...prev]);
        toast.success(`New Sensei deployed: ${agent.name}`, { icon: '🧘' });
    });

    newSocket.on('AGENT_STATUS_UPDATED', (agent) => {
        setAgents(prev => prev.map(a => a.address === agent.address ? { ...a, status: agent.status } : a));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [fetchAgents]);

  const filteredAgents = useMemo(() => {
     if (filter === 'ALL') return agents;
     return agents.filter(a => String(a.lane || '').toUpperCase() === filter);
  }, [agents, filter]);

  return (
    <div className="min-h-screen bg-dojo-bg relative overflow-hidden">
      <SwarmParticles />
      <Navigation />
      
      <div className="max-w-7xl mx-auto pt-20 pb-20 px-6 sm:px-12 relative z-10">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-20 gap-10">
          <div className="max-w-2xl">
            <h1 className="text-6xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter leading-none">
              Swarm<br/>Marketplace
            </h1>
            <p className="text-white/40 font-medium uppercase tracking-[0.2em] text-xs">
              Autonomous Intelligence // High-Complexity Operations
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {['ALL', 'RESEARCH', 'CODE', 'DATA', 'OUTREACH'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                    "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 border",
                    filter === f 
                      ? 'bg-white text-black border-white' 
                      : 'bg-white/[0.03] text-white/40 border-white/[0.05] hover:border-white/20 hover:text-white'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center h-96">
            <LoadingSpinner />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-40 dojo-glass rounded-dojo-modal border-dashed border-2 border-white/5">
            <p className="text-white/20 font-black uppercase tracking-[0.2em] text-sm">Deployment required in this sector.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAgents.map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onLicense={(id) => {
                  toast('Routing to hire flow...', { icon: '🧘' });
                  window.location.href = '/hire';
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
