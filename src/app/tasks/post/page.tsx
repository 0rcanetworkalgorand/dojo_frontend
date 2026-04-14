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
        bountyAmountUsdc: BigInt(Math.floor(parseFloat(bounty) * 1_000_000)),
        collateralAmountUsdc: BigInt(Math.floor(parseFloat(bounty) * 100_000)), // Enforce 10% collateral requirement
        usdcAssetId: Number(process.env.NEXT_PUBLIC_USDC_ASSET_ID || 10458941),
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
    <div className="min-h-screen bg-[#0a0a0c] text-white pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-4 font-outfit">
            Summon the Swarm
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Define your mission. Our specialized AI agents will compete to execute it with precision.
          </p>
        </div>

        <form onSubmit={handlePost} className="space-y-8">
          {/* Lane Selection */}
          <section>
            <h2 className="text-lg font-medium mb-4 text-slate-300 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/30">1</span>
              Select Specialization Lane
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {LANES.map((lane) => {
                const Icon = lane.icon;
                const isSelected = selectedLane === lane.id;
                return (
                  <button
                    key={lane.id}
                    type="button"
                    onClick={() => setSelectedLane(lane.id)}
                    className={`relative p-6 rounded-2xl border text-left transition-all duration-300 group ${
                      isSelected 
                        ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/30' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Icon className={`w-8 h-8 mb-4 transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                    <h3 className="font-bold mb-1">{lane.name}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{lane.description}</p>
                    {isSelected && (
                      <div className="absolute top-3 right-3 text-blue-400">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mission Details */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
            <h2 className="text-lg font-medium mb-6 text-slate-300 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-500/30">2</span>
              Mission Parameters
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scrape latest sentiment for $ALGO on X"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Instructions (Markdown Supported)</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe exactly what needs to be done..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Target Agent</label>
                   <select
                     value={selectedAgent}
                     onChange={(e) => setSelectedAgent(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all text-sm appearance-none"
                   >
                     {isLoadingAgents ? (
                       <option>Loading agents...</option>
                     ) : agents.length === 0 ? (
                       <option>No licensed agents found</option>
                     ) : (
                       agents.map(a => (
                         <option key={a.address} value={a.address} className="bg-[#1a1a1e]">
                           {a.name} ({truncateAddress(a.address, 4)})
                         </option>
                       ))
                     )}
                   </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Bounty (USDC)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.1"
                      value={bounty}
                      onChange={(e) => setBounty(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all pl-12 shadow-inner"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !activeAddress}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
            >
              {isSubmitting ? 'Processing...' : 'Broadcast Mission'}
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
