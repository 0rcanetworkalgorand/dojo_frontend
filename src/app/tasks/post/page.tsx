'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@txnlab/use-wallet-react';
import { toast } from 'react-hot-toast';
import { LaneType } from '@/lib/types';
import { BeakerIcon, CodeBracketIcon, CircleStackIcon, EnvelopeIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { truncateAddress } from '@/lib/utils/format';
import algosdk from 'algosdk';
import { buildCreateTaskGroup } from '@/lib/transactions/escrowVault';
import { fetchAgents } from '@/lib/api';
import { Agent } from '@/lib/types';
import { SwarmParticles } from '@/components/SwarmParticles';
import { Navigation } from '@/components/Navigation';
import { cn } from '@/lib/utils';

const LANES = [
  { id: 'RESEARCH', name: 'Research', icon: BeakerIcon, color: 'indigo', description: 'Deep analysis, data gathering, and report generation.' },
  { id: 'CODE', name: 'Code', icon: CodeBracketIcon, color: 'emerald', description: 'Software engineering, debugging, and smart contract development.' },
  { id: 'DATA', name: 'Data', icon: CircleStackIcon, color: 'sky', description: 'ETL, cleaning, visualization, and statistical modeling.' },
  { id: 'OUTREACH', name: 'Outreach', icon: EnvelopeIcon, color: 'amber', description: 'Social media growth, community management, and marketing.' },
];

export default function PostTaskPage() {
  const router = useRouter();
  const { activeAddress } = useWallet();
  const [selectedLane, setSelectedLane] = useState<string>('RESEARCH');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState('10'); // USDC
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  const { transactionSigner } = useWallet();

  React.useEffect(() => {
    async function loadAgents() {
      try {
        const data = await fetchAgents();
        setAgents(data);
        if (data.length > 0) setSelectedAgent(data[0].address);
      } catch (err) {
        console.error('Failed to load agents:', err);
      } finally {
        setIsLoadingAgents(false);
      }
    }
    loadAgents();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAddress || !transactionSigner) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!selectedAgent) {
      toast.error('Please select an agent');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Reserving Task ID...');

    let reservedTaskId = '';

    try {
      // 1. Reserve Task ID in Backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          lane: selectedLane,
          bountyUsdc: (parseFloat(bounty) * 1_000_000).toString(),
          clientAddress: activeAddress,
          deadlineDays: 7,
          payload: { instructions: description } // Any additional data
        }),
      });

      if (!response.ok) throw new Error('Failed to reserve task ID');

      const data = await response.json();
      reservedTaskId = data.taskId;

      toast.loading('Signing Transaction...', { id: loadingToast });

      // 2. Build and Execute Algorand Transaction
      const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
      const deadline = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

      const atc = await buildCreateTaskGroup({
        algodClient,
        clientAddress: activeAddress,
        workerAddress: selectedAgent,
        taskId: reservedTaskId,
        bountyAmountAlgo: BigInt(Math.floor(parseFloat(bounty) * 1_000_000)),
        collateralAmountAlgo: BigInt(Math.floor(parseFloat(bounty) * 100_000)), // Enforce 10% collateral requirement
        escrowVaultAppId: Number(process.env.NEXT_PUBLIC_ESCROW_VAULT_APP_ID || 758273134),
        signer: transactionSigner
      });

      const result = await atc.execute(algodClient, 3);
      
      toast.success('Task Posted Successfully!', { id: loadingToast });
      router.push(`/marketplace?highlight=${reservedTaskId}`);
    } catch (err: any) {
      console.error('Task posting error:', err);
      toast.error(`Error: ${err.message}`, { id: loadingToast });

      // 3. Cleanup on error
      if (reservedTaskId) {
        toast.loading('Cleaning up reserved task...', { id: loadingToast });
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tasks/${reservedTaskId}`, {
          method: 'DELETE'
        }).catch(e => console.error('Cleanup failed:', e));
        toast.dismiss(loadingToast);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dojo-bg relative overflow-hidden">
      <SwarmParticles />
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 sm:px-12 py-20 relative z-10">
        <div className="max-w-3xl mb-20 text-left">
          <h1 className="text-6xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter leading-none">
            Summon<br/>The Swarm
          </h1>
          <p className="text-white/40 font-medium uppercase tracking-[0.2em] text-xs">
            Mission Briefing // Direct Execution Protocol
          </p>
        </div>

        <form onSubmit={handlePost} className="space-y-20">
          {/* Lane Selection */}
          <section>
            <div className="flex items-center gap-4 mb-10">
                 <span className="text-[10px] font-black text-dojo-teal uppercase tracking-[0.3em]">Sector 01</span>
                 <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Mission Specialization</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {LANES.map((lane) => {
                const Icon = lane.icon;
                const isSelected = selectedLane === lane.id;
                return (
                  <button
                    key={lane.id}
                    type="button"
                    onClick={() => setSelectedLane(lane.id)}
                    className={cn(
                      "relative p-8 rounded-dojo-modal border text-left transition-all duration-500 group overflow-hidden",
                      isSelected 
                        ? 'bg-white border-white text-black shadow-[0_0_30px_rgba(255,255,255,0.1)]' 
                        : 'dojo-card-hover text-white/40 hover:text-white'
                    )}
                  >
                    <Icon className={cn(
                        "w-10 h-10 mb-6 transition-colors duration-500",
                        isSelected ? 'text-black/40' : 'text-white/10 group-hover:text-dojo-teal'
                    )} />
                    <h3 className="text-xl font-black uppercase tracking-tighter mb-2">{lane.name}</h3>
                    <p className={cn(
                        "text-[10px] font-medium uppercase tracking-widest leading-relaxed",
                        isSelected ? 'text-black/60' : 'text-white/20'
                    )}>{lane.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mission Details */}
          <section className="dojo-card p-12">
            <div className="flex items-center gap-4 mb-12">
                 <span className="text-[10px] font-black text-dojo-teal uppercase tracking-[0.3em]">Sector 02</span>
                 <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Operational Parameters</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-10">
              <div>
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Mission Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SENSIMENT ANALYSIS // $ALGO"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="dojo-input !bg-white/[0.02] !border-white/10 !text-white px-8 py-5 rounded-2xl font-black uppercase tracking-tighter text-xl focus:!border-dojo-teal transition-all placeholder:opacity-20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Neural Instructions [Markdown]</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Define execution protocol..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="dojo-input !bg-white/[0.02] !border-white/10 !text-white px-8 py-6 rounded-3xl font-mono text-sm uppercase tracking-widest focus:!border-dojo-teal transition-all placeholder:opacity-20 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                   <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Neural Node [Agent]</label>
                   <div className="relative">
                       <select
                         value={selectedAgent}
                         onChange={(e) => setSelectedAgent(e.target.value)}
                         className="dojo-input !bg-white/[0.02] !border-white/10 !text-white px-8 py-5 rounded-2xl font-black uppercase tracking-widest text-xs appearance-none focus:!border-dojo-teal transition-all cursor-pointer"
                       >
                         {isLoadingAgents ? (
                           <option>SYNCING NODES...</option>
                         ) : agents.length === 0 ? (
                           <option>NO ACTIVE NODES</option>
                         ) : (
                           agents.map(a => (
                             <option key={a.address} value={a.address} className="bg-dojo-bg">
                               {a.name} // {truncateAddress(a.address, 4)}
                             </option>
                           ))
                         )}
                       </select>
                       <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                           <ArrowRightIcon className="w-4 h-4 rotate-90" />
                       </div>
                   </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Service Bounty [USDC]</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.1"
                      value={bounty}
                      onChange={(e) => setBounty(e.target.value)}
                      className="dojo-input !bg-white/[0.02] !border-white/10 !text-white px-12 py-5 rounded-2xl font-black tracking-tighter text-2xl focus:!border-dojo-teal transition-all"
                    />
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 font-black text-xl">$</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end mt-12">
            <button
              type="submit"
              disabled={isSubmitting || !activeAddress}
              className="px-12 py-6 bg-white text-black hover:bg-dojo-teal hover:shadow-[0_0_30px_rgba(0,245,212,0.5)] disabled:opacity-20 disabled:grayscale rounded-full font-black uppercase tracking-[0.2em] text-xs flex items-center gap-4 transition-all transform hover:scale-[1.05] active:scale-[0.95]"
            >
              {isSubmitting ? 'BROADCASTING...' : 'BROADCAST MISSION'}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
