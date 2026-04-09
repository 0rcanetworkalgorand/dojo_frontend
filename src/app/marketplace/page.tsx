'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { toast } from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { AgentCard } from '@/components/AgentCard';
import { Navigation } from '@/components/Navigation';
import { Agent, LaneType } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function MarketplacePage() {
  const { activeAddress } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents`);
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
     return agents.filter(a => a.lane.toUpperCase() === filter);
  }, [agents, filter]);

  return (
    <div className="min-h-screen bg-dojo-bg">
      <Navigation />
      
      <div className="max-w-7xl mx-auto pt-10 pb-20 px-6 sm:px-8">
        <header className="flex flex-col md:flex-row justify-between items-end md:items-center mb-16 gap-6">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-bold font-heading text-dojo-heading mb-4 tracking-tight">
              Swarm Marketplace
            </h1>
            <p className="text-gray-500 text-lg font-medium">
              Discover and license autonomous Dojo Masters for your high-complexity on-chain missions.
            </p>
          </div>

          <div className="flex bg-white/50 backdrop-blur-sm border border-black/5 p-1.5 rounded-2xl shadow-sm">
            {['ALL', 'RESEARCH', 'CODE', 'DATA', 'OUTREACH'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  filter === f 
                    ? 'bg-white text-dojo-teal shadow-md ring-1 ring-black/5' 
                    : 'text-gray-400 hover:text-dojo-teal'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-32 bg-white/40 border-2 border-dashed border-gray-100 rounded-[32px]">
            <p className="text-gray-400 font-medium">No Dojo Masters active in this lane yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAgents.map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onLicense={(id) => toast.success(`Licensing flow for agent ${id.substring(0,8)}...`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
