'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { toast } from 'react-hot-toast';
import { Navigation } from '@/components/Navigation';
import { LaneBadge } from '@/components/LaneBadge';
import { matchAgents, createTask, fetchTask, analyzeWithRei, startReiSessionWithStakes, approveReiSession, rejectReiSession, getReiSessionStatus, releaseTaskPayment, slashTask, ReiSelectedAgent, ReiRecommendation } from '@/lib/api';
import { ensureKeyPair, getStoredPrivateKey, getStoredPublicKey, decryptWithPrivateKey, KeyPair } from '@/lib/crypto';
import { initX402Client, isX402Ready, getFetchWithPayment } from '@/lib/x402Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, CheckCircle, Users, Diamond, ArrowRight, ArrowLeft, Zap, Shield, Loader2, FileText, Brain, CircleDot, ThumbsUp, ThumbsDown, X, Bot, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { truncateAddress } from '@/lib/utils/format';
import algosdk from 'algosdk';
import { io } from 'socket.io-client';

type Step = 'describe' | 'match' | 'confirm' | 'processing' | 'awaiting-approval' | 'result' | 'rei-recommendation' | 'rei-staking' | 'rei-working' | 'rei-complete';

interface MatchedAgent {
  id: string;
  address: string;
  senseiAddress: string;
  name: string;
  lane: string;
  status: string;
  taskCount: number;
  successRate: number;
  totalEarned: number;
  commitmentExpiry: number;
  isPrimaryMatch: boolean;
}

interface MatchResult {
  detectedLane: string;
  confidence: number;
  scores: Record<string, number>;
  agents: MatchedAgent[];
}

const laneColors: Record<string, string> = {
  RESEARCH: 'from-indigo-500 to-violet-600',
  CODE: 'from-emerald-500 to-teal-600',
  DATA: 'from-sky-500 to-blue-600',
  OUTREACH: 'from-amber-500 to-orange-600',
};

const laneBadgeColors: Record<string, string> = {
  RESEARCH: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  CODE: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  DATA: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  OUTREACH: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
};

export default function HirePage() {
  const { activeAccount, transactionSigner } = useWallet();
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [bounty, setBounty] = useState('1');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleMatch = async () => {
    if (!description.trim()) {
      toast.error('Please enter a task description');
      return;
    }
    setIsLoading(true);
    try {
      const result = await matchAgents(description);
      setMatchResult(result);
      setStep('match');
    } catch (error) {
      toast.error('Failed to match agents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!activeAccount?.address) {
      toast.error('Please connect your wallet');
      return;
    }
    if (selectedAgents.length === 0) {
      toast.error('Please select at least one agent');
      return;
    }
    setProcessing(true);
    try {
      const task = await createTask({
        title,
        description,
        lane: matchResult?.detectedLane || 'RESEARCH',
        bountyUsdc: BigInt(parseFloat(bounty) * 1_000_000).toString(),
        clientAddress: activeAccount.address,
      });
      toast.success('Task created successfully');
      setStep('processing');
    } catch (error) {
      toast.error('Failed to create task');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative z-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-4">
            {['describe', 'match', 'confirm'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s ? 'bg-accent text-foreground' : 
                  ['match', 'confirm'].includes(step) && i < ['describe', 'match', 'confirm'].indexOf(step) ? 'bg-accent/20 text-accent' : 
                  'bg-black/[0.05] text-muted'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-medium ${
                  step === s ? 'text-foreground' : 'text-muted'
                }`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
                {i < 2 && <div className="w-12 h-px bg-black/[0.1]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Describe */}
        {step === 'describe' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="card-elevated p-8">
              <h1 className="text-3xl font-bold text-foreground mb-4">Describe Your Task</h1>
              <p className="text-muted mb-8">Tell us what you need, and we will match you with the best agents.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Task Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Research on Solana DeFi protocols"
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what you need in detail..."
                    rows={6}
                    className="input resize-none"
                  />
                </div>
                
                <button
                  onClick={handleMatch}
                  disabled={isLoading || !description.trim()}
                  className="btn-primary w-full"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Matching...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search size={18} />
                      Find Agents
                    </span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Match */}
        {step === 'match' && matchResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Matched Agents</h2>
              <p className="text-muted">
                Detected lane: <span className="font-semibold text-accent">{matchResult.detectedLane}</span> 
                (Confidence: {Math.round(matchResult.confidence * 100)}%)
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {matchResult.agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => {
                    if (selectedAgents.includes(agent.id)) {
                      setSelectedAgents(prev => prev.filter(id => id !== agent.id));
                    } else {
                      setSelectedAgents(prev => [...prev, agent.id]);
                    }
                  }}
                  className={`card p-6 cursor-pointer transition-all ${
                    selectedAgents.includes(agent.id) 
                      ? 'ring-2 ring-accent shadow-md' 
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-foreground">{agent.name}</h3>
                    {selectedAgents.includes(agent.id) && (
                      <CheckCircle size={20} className="text-accent" />
                    )}
                  </div>
                  <p className="text-sm text-muted mb-4">{agent.lane}</p>
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span>{agent.taskCount} tasks</span>
                    <span>{Math.round(agent.successRate * 100)}% success</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-4">
              <button onClick={() => setStep('describe')} className="btn-secondary">
                Back
              </button>
              <button 
                onClick={() => setStep('confirm')} 
                disabled={selectedAgents.length === 0}
                className="btn-primary"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm & Stake */}
        {step === 'confirm' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="card-elevated p-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">Confirm & Stake</h2>
              
              <div className="space-y-6 mb-8">
                <div className="flex justify-between py-3 border-b border-black/[0.06]">
                  <span className="text-muted">Task</span>
                  <span className="font-medium text-foreground">{title || 'Untitled'}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-black/[0.06]">
                  <span className="text-muted">Lane</span>
                  <span className="font-medium text-foreground">{matchResult?.detectedLane}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-black/[0.06]">
                  <span className="text-muted">Agents</span>
                  <span className="font-medium text-foreground">{selectedAgents.length}</span>
                </div>
              </div>
              
              <div className="mb-8">
                <label className="block text-sm font-medium text-foreground mb-2">Bounty (USDC)</label>
                <input
                  type="number"
                  value={bounty}
                  onChange={(e) => setBounty(e.target.value)}
                  min="1"
                  step="0.1"
                  className="input"
                />
              </div>
              
              <div className="flex gap-4">
                <button onClick={() => setStep('match')} className="btn-secondary">
                  Back
                </button>
                <button 
                  onClick={handleCreateTask}
                  disabled={processing}
                  className="btn-primary"
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 size={48} className="animate-spin text-accent mb-6" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Processing...</h2>
            <p className="text-muted">Your task is being executed by the selected agents.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
