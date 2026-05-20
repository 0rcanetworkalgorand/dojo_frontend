'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { toast } from 'react-hot-toast';
import { Navigation } from '@/components/Navigation';
import { LaneBadge } from '@/components/LaneBadge';
import { matchAgents, createTask, fetchTask, analyzeWithRei, startReiSessionWithStakes, approveReiSession, rejectReiSession, getReiSessionStatus, releaseTaskPayment, slashTask, refundEscrow, ReiSelectedAgent, ReiRecommendation } from '@/lib/api';
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
import { buildCreateTaskGroup } from '@/lib/transactions/escrowVault';

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
  const { activeAccount, signTransactions, algodClient } = useWallet();
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [bounty, setBounty] = useState('1');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reiLoading, setReiLoading] = useState(false);
  const [reiRecommendation, setReiRecommendation] = useState<ReiRecommendation | null>(null);
  const [reiSessionId, setReiSessionId] = useState<string | null>(null);
  const [reiCurrentAgent, setReiCurrentAgent] = useState<ReiSelectedAgent | null>(null);
  const [reiResults, setReiResults] = useState<Array<{ agent: ReiSelectedAgent; taskId: string; approved: boolean; validationScore?: number }>>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [decryptedOutput, setDecryptedOutput] = useState<string | null>(null);
  const [validationScore, setValidationScore] = useState<number | null>(null);
  const [reiTaskReady, setReiTaskReady] = useState(false);
  const [reiDecryptedOutput, setReiDecryptedOutput] = useState<string | null>(null);
  const [reiValidationScore, setReiValidationScore] = useState<number | null>(null);
  const reiPollRef = useRef<NodeJS.Timeout | null>(null);
  const [reiStakeError, setReiStakeError] = useState<string | null>(null);
  const reiStakedRef = useRef<{ agents: ReiSelectedAgent[]; stakeTxIds: string[]; keyPair: KeyPair } | null>(null);

  // Poll REI current agent's task for completion
  useEffect(() => {
    if (step !== 'rei-working' || !reiCurrentAgent?.taskId) return;
    setReiTaskReady(false);
    setReiDecryptedOutput(null);
    setReiValidationScore(null);

    const poll = setInterval(async () => {
      try {
        const task = await fetchTask(reiCurrentAgent.taskId!);
        if (task.state === 'SUBMITTED') {
          clearInterval(poll);
          setReiValidationScore(task.validationScore ?? null);
          if (task.encryptedResult) {
            const privKey = getStoredPrivateKey();
            if (privKey) {
              try {
                const decrypted = await decryptWithPrivateKey(task.encryptedResult, privKey);
                setReiDecryptedOutput(decrypted);
              } catch { setReiDecryptedOutput('[Decryption failed]'); }
            } else {
              setReiDecryptedOutput('[No private key — cannot decrypt]');
            }
          } else {
            setReiDecryptedOutput(task.result || '[No output]');
          }
          setReiTaskReady(true);
        } else if (task.state === 'SLASHED') {
          clearInterval(poll);
          setReiDecryptedOutput('[Task failed]');
          setReiTaskReady(true);
        }
      } catch {}
    }, 3000);
    reiPollRef.current = poll;
    return () => clearInterval(poll);
  }, [step, reiCurrentAgent]);

  const handleReiTakeover = async () => {
    if (!description.trim()) {
      toast.error('Please enter a task description');
      return;
    }
    setReiLoading(true);
    try {
      const recommendation = await analyzeWithRei(description);
      setReiRecommendation(recommendation);
      setStep('rei-recommendation');
    } catch (error: any) {
      toast.error(error.message || 'REI analysis failed');
    } finally {
      setReiLoading(false);
    }
  };

  const handleReiStart = async () => {
    if (!activeAccount?.address || !reiRecommendation || !signTransactions) return;
    setStep('rei-staking');
    setReiStakeError(null);
    
    let keyPair: KeyPair;
    try {
      keyPair = await ensureKeyPair();
    } catch (err: any) {
      toast.error('Failed to generate encryption keys');
      setStep('rei-recommendation');
      return;
    }

    const escrowAppId = Number(process.env.NEXT_PUBLIC_ESCROW_VAULT_APP_ID || '761941677');
    const bountyPerAgent = BigInt(Math.round(parseFloat(bounty) * 1_000_000));
    const stakeTxIds: string[] = [];
    const agents = reiRecommendation.selectedAgents;

    // Sign escrow for each agent
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      if (!agent.taskId || agent.taskId.length < 5) {
        agent.taskId = `T-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }
      toast.loading(`Signing escrow ${i + 1}/${agents.length} (${agent.lane})...`, { id: 'rei-stake' });
      try {
        const sp = await algodClient.getTransactionParams().do();
        const appAddr = algosdk.getApplicationAddress(escrowAppId);
        const abi = new algosdk.ABIInterface({
          name: 'EscrowVault',
          methods: [{ name: 'lock_bounty', args: [
            { type: 'string', name: 'task_id' },
            { type: 'address', name: 'client' },
            { type: 'address', name: 'worker' },
            { type: 'address', name: 'sensei' },
            { type: 'uint64', name: 'bounty_amount' },
            { type: 'pay', name: 'bounty_txn' }
          ], returns: { type: 'bool' } }]
        });
        const method = abi.getMethodByName('lock_bounty');

        const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAccount.address,
          receiver: appAddr.toString(),
          amount: bountyPerAgent,
          suggestedParams: sp,
        });
        const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
          sender: activeAccount.address,
          appIndex: escrowAppId,
          appArgs: [
            method.getSelector(),
            algosdk.ABIType.from('string').encode(agent.taskId),
            algosdk.ABIType.from('address').encode(activeAccount.address),
            algosdk.ABIType.from('address').encode(agent.agentAddress),
            algosdk.ABIType.from('address').encode(agent.senseiAddress),
            algosdk.ABIType.from('uint64').encode(bountyPerAgent),
          ],
          boxes: [{ appIndex: escrowAppId, name: new Uint8Array(Buffer.from(agent.taskId)) }],
          suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
          onComplete: algosdk.OnApplicationComplete.NoOpOC,
        });

        const txns = algosdk.assignGroupID([payTxn, appCallTxn]);
        const rawTxns = txns.map(t => t.toByte());
        const signedTxns = await signTransactions(rawTxns);
        if (!signedTxns || signedTxns.length === 0) throw new Error('Wallet returned no signatures');
        const sendResult = await algodClient.sendRawTransaction(signedTxns.filter(Boolean) as Uint8Array[]).do();
        const txId = (sendResult as any).txId || (sendResult as any).txid || 'confirmed';
        await algosdk.waitForConfirmation(algodClient, txId, 4);
        stakeTxIds.push(txId);
      } catch (err: any) {
        toast.error(`Escrow ${i + 1} failed: ${err.message || 'Rejected'}`, { id: 'rei-stake' });
        setStep('rei-recommendation');
        return;
      }
    }
    toast.success(`All ${agents.length} escrow stakes locked!`, { id: 'rei-stake' });

    // Save staked data for retry
    reiStakedRef.current = { agents, stakeTxIds, keyPair };

    // Start session
    await startReiSession(agents, stakeTxIds, keyPair);
  };

  const startReiSession = async (agents: ReiSelectedAgent[], stakeTxIds: string[], keyPair: KeyPair) => {
    if (!activeAccount?.address) return;
    setReiStakeError(null);
    try {
      const result = await startReiSessionWithStakes(
        activeAccount.address,
        description,
        agents,
        stakeTxIds,
        keyPair.publicKey
      );
      setReiSessionId(result.sessionId);
      setReiCurrentAgent(result.firstAgent);
      setStep('rei-working');
    } catch (error: any) {
      console.error('[REI] Session start failed:', error);
      setReiStakeError(error.message || 'Failed to start session');
    }
  };

  const handleReiRetry = async () => {
    if (!reiStakedRef.current) return;
    const { agents, stakeTxIds, keyPair } = reiStakedRef.current;
    await startReiSession(agents, stakeTxIds, keyPair);
  };

  const handleReiRefund = async () => {
    if (!reiStakedRef.current || !activeAccount?.address) return;
    const { agents } = reiStakedRef.current;
    toast.loading('Refunding escrow...', { id: 'refund' });
    for (const agent of agents) {
      if (agent.taskId) {
        try { await refundEscrow(agent.taskId, activeAccount.address); } catch {}
      }
    }
    toast.success('Escrow refunded!', { id: 'refund' });
    reiStakedRef.current = null;
    setStep('rei-recommendation');
  };

  const handleReiApprove = async () => {
    if (!reiSessionId) return;
    try {
      const res = await approveReiSession(reiSessionId);
      setReiResults(prev => [...prev, { agent: reiCurrentAgent!, taskId: res.taskId, approved: true, validationScore: res.validationScore ?? undefined }]);
      if (res.sessionComplete) {
        setStep('rei-complete');
      } else if (res.nextAgent) {
        setReiCurrentAgent(res.nextAgent);
      }
    } catch (error: any) {
      toast.error(error.message || 'Approval failed');
    }
  };

  const handleReiReject = async () => {
    if (!reiSessionId) return;
    try {
      const res = await rejectReiSession(reiSessionId);
      setReiResults(prev => [...prev, { agent: reiCurrentAgent!, taskId: res.taskId, approved: false, validationScore: res.validationScore ?? undefined }]);
      if (res.sessionComplete) {
        setStep('rei-complete');
      } else if (res.nextAgent) {
        setReiCurrentAgent(res.nextAgent);
      }
    } catch (error: any) {
      toast.error(error.message || 'Rejection failed');
    }
  };

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
    if (!signTransactions) {
      toast.error('Wallet signer not available');
      return;
    }
    if (selectedAgents.length === 0) {
      toast.error('Please select at least one agent');
      return;
    }
    setProcessing(true);
    try {
      // 1. Ensure encryption key pair exists
      const keyPair = await ensureKeyPair();

      // 2. Generate task ID for on-chain box
      const onChainTaskId = `T-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const selectedAgent = matchResult?.agents.find(a => a.id === selectedAgents[0]);
      if (!selectedAgent) throw new Error('Agent not found');

      const bountyMicroAlgo = BigInt(Math.round(parseFloat(bounty) * 1_000_000));

      // 3. Sign escrow staking transaction (lock_bounty)
      toast.loading('Sign the escrow transaction...', { id: 'stake' });
      const escrowAppId = Number(process.env.NEXT_PUBLIC_ESCROW_VAULT_APP_ID || '761941677');
      const sp = await algodClient.getTransactionParams().do();
      const appAddr = algosdk.getApplicationAddress(escrowAppId);

      // Build payment txn
      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAccount.address,
        receiver: appAddr.toString(),
        amount: bountyMicroAlgo,
        suggestedParams: sp,
      });

      // Build app call txn (lock_bounty)
      const abi = new algosdk.ABIInterface({
        name: 'EscrowVault',
        methods: [{ name: 'lock_bounty', args: [
          { type: 'string', name: 'task_id' },
          { type: 'address', name: 'client' },
          { type: 'address', name: 'worker' },
          { type: 'address', name: 'sensei' },
          { type: 'uint64', name: 'bounty_amount' },
          { type: 'pay', name: 'bounty_txn' }
        ], returns: { type: 'bool' } }]
      });
      const method = abi.getMethodByName('lock_bounty');
      const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
        sender: activeAccount.address,
        appIndex: escrowAppId,
        appArgs: [
          method.getSelector(),
          algosdk.ABIType.from('string').encode(onChainTaskId),
          algosdk.ABIType.from('address').encode(activeAccount.address),
          algosdk.ABIType.from('address').encode(selectedAgent.address),
          algosdk.ABIType.from('address').encode(selectedAgent.senseiAddress),
          algosdk.ABIType.from('uint64').encode(bountyMicroAlgo),
        ],
        boxes: [{ appIndex: escrowAppId, name: new Uint8Array(Buffer.from(onChainTaskId)) }],
        suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
      });

      // Assign group ID and sign
      const txns = algosdk.assignGroupID([payTxn, appCallTxn]);
      const rawTxns = txns.map(t => t.toByte());
      const signedTxns = await signTransactions(rawTxns);
      if (!signedTxns || signedTxns.length === 0) throw new Error('Wallet returned no signatures');
      const sendResult = await algodClient.sendRawTransaction(signedTxns.filter(Boolean) as Uint8Array[]).do();
      const stakeTxId = (sendResult as any).txId || (sendResult as any).txid || 'confirmed';
      await algosdk.waitForConfirmation(algodClient, stakeTxId, 4);
      toast.success('Escrow staked on-chain!', { id: 'stake' });

      // 4. Create task in backend (with escrow proof)
      const task = await createTask({
        id: onChainTaskId,
        title,
        description,
        lane: matchResult?.detectedLane || 'RESEARCH',
        bountyUsdc: bountyMicroAlgo.toString(),
        clientAddress: activeAccount.address,
        agentId: selectedAgents[0],
        agentAddress: selectedAgent.address,
        stakeTxId,
        clientPublicKey: keyPair.publicKey,
      });
      setTaskId(task.id);
      setStep('processing');

      // 5. Poll for task completion
      pollTaskResult(task.id);
    } catch (error: any) {
      console.error('Task creation failed:', error);
      toast.dismiss('stake');
      toast.error(error.message || 'Failed to create task');
    } finally {
      setProcessing(false);
    }
  };

  const pollTaskResult = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const task = await fetchTask(id);
        if (task.state === 'SUBMITTED' || task.state === 'SETTLED') {
          clearInterval(interval);
          setValidationScore(task.validationScore ?? null);
          // Decrypt the output client-side
          if (task.encryptedResult) {
            const privKey = getStoredPrivateKey();
            if (privKey) {
              try {
                const decrypted = await decryptWithPrivateKey(task.encryptedResult, privKey);
                setDecryptedOutput(decrypted);
              } catch {
                setDecryptedOutput('[Decryption failed — private key mismatch]');
              }
            } else {
              setDecryptedOutput('[No private key in browser — cannot decrypt]');
            }
          } else {
            setDecryptedOutput(task.result || '[No output]');
          }
          setStep('awaiting-approval');
        } else if (task.state === 'SLASHED') {
          clearInterval(interval);
          if (task.encryptedResult) {
            const privKey = getStoredPrivateKey();
            if (privKey) {
              try {
                const decrypted = await decryptWithPrivateKey(task.encryptedResult, privKey);
                setDecryptedOutput(decrypted);
              } catch {
                setDecryptedOutput('[Task failed]');
              }
            } else {
              setDecryptedOutput('[Task failed]');
            }
          } else {
            setDecryptedOutput(task.result || '[Task failed]');
          }
          setValidationScore(null);
          setStep('awaiting-approval');
        }
      } catch {}
    }, 3000);
  };

  const handleRelease = async () => {
    if (!taskId || !activeAccount?.address) return;
    try {
      toast.loading('Releasing payment...', { id: 'release' });
      await releaseTaskPayment(taskId, activeAccount.address);
      toast.success('Payment released to sensei!', { id: 'release' });
      setStep('result');
    } catch (error: any) {
      toast.error(error.message || 'Release failed', { id: 'release' });
    }
  };

  const handleSlash = async () => {
    if (!taskId || !activeAccount?.address) return;
    try {
      toast.loading('Slashing...', { id: 'slash' });
      await slashTask(taskId, activeAccount.address);
      toast.success('Bounty refunded + agent slashed', { id: 'slash' });
      setStep('result');
    } catch (error: any) {
      // If task was already auto-slashed by executor, treat as success
      const task = await fetchTask(taskId).catch(() => null);
      if (task?.state === 'SLASHED') {
        toast.success('Agent already slashed — bounty refunded', { id: 'slash' });
        setStep('result');
      } else {
        toast.error(error.message || 'Slash failed', { id: 'slash' });
      }
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
                
                <div className="flex gap-3">
                  <button
                    onClick={handleMatch}
                    disabled={isLoading || reiLoading || !description.trim()}
                    className="btn-primary flex-1"
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
                  <button
                    onClick={handleReiTakeover}
                    disabled={isLoading || reiLoading || !description.trim()}
                    className="btn-secondary flex-1 border-2 border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5"
                  >
                    {reiLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        REI Analyzing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Bot size={18} className="text-violet-500" />
                        REI Agent Takeover
                      </span>
                    )}
                  </button>
                </div>
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
                (Confidence: {matchResult.confidence}%)
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
                    <span>{agent.successRate}% success</span>
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
            <p className="text-muted">Your task is being executed. Waiting for result...</p>
          </motion.div>
        )}

        {/* Awaiting Approval - show decrypted output + resolution score */}
        {step === 'awaiting-approval' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="card-elevated p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Task Output</h2>
                {validationScore != null && (
                  <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                    validationScore >= 8 ? 'bg-green-100 text-green-700' :
                    validationScore >= 5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    <Shield size={14} className="inline mr-1" />
                    Resolution Score: {validationScore}/10
                  </div>
                )}
              </div>
              <div className="prose prose-sm max-w-none mb-8 p-4 rounded-lg bg-black/[0.02] border border-black/[0.06] max-h-96 overflow-y-auto">
                {decryptedOutput ? (
                  <ReactMarkdown>{decryptedOutput}</ReactMarkdown>
                ) : (
                  <p className="text-muted">Loading output...</p>
                )}
              </div>
              <div className="flex gap-4">
                <button onClick={handleRelease} className="btn-primary flex-1">
                  <span className="flex items-center gap-2"><ThumbsUp size={18} /> Satisfied — Release Payment</span>
                </button>
                <button onClick={handleSlash} className="btn-secondary flex-1 border-red-500/30 hover:border-red-500/60 text-red-600">
                  <span className="flex items-center gap-2"><ThumbsDown size={18} /> Not Satisfied — Slash</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Result - final state */}
        {step === 'result' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto text-center py-20"
          >
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Task Complete</h2>
            <p className="text-muted mb-8">Settlement has been processed on-chain.</p>
            <button onClick={() => { setStep('describe'); setDecryptedOutput(null); setValidationScore(null); setTaskId(null); }} className="btn-primary">
              New Task
            </button>
          </motion.div>
        )}

        {/* REI Recommendation */}
        {step === 'rei-recommendation' && reiRecommendation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="card-elevated p-8">
              <div className="flex items-center gap-3 mb-6">
                <Bot size={28} className="text-violet-500" />
                <h2 className="text-2xl font-bold text-foreground">REI Recommendation</h2>
              </div>
              <p className="text-muted mb-6">{reiRecommendation.reasoning}</p>
              <div className="space-y-4 mb-8">
                {reiRecommendation.selectedAgents.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-black/[0.02] border border-black/[0.06]">
                    <div>
                      <span className="font-semibold text-foreground">{agent.lane}</span>
                      <span className="text-sm text-muted ml-3">{truncateAddress(agent.agentAddress)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted">
                      <span>Score: {agent.score}</span>
                      <span>{agent.successRate}% success</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Bounty per Agent (ALGO)</label>
                <input type="number" value={bounty} onChange={(e) => setBounty(e.target.value)} min="1" step="0.1" className="input" />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep('describe')} className="btn-secondary">Back</button>
                <button onClick={handleReiStart} disabled={!activeAccount?.address} className="btn-primary">
                  <span className="flex items-center gap-2">
                    <Zap size={18} />
                    Stake & Start REI Session
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* REI Staking */}
        {step === 'rei-staking' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            {reiStakeError ? (
              <div className="max-w-md text-center">
                <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">Session Start Failed</h2>
                <p className="text-muted mb-2">{reiStakeError}</p>
                <p className="text-sm text-muted mb-6">Your ALGO is locked in escrow. You can retry or refund.</p>
                <div className="flex gap-3">
                  <button onClick={handleReiRetry} className="btn-primary flex-1">Retry</button>
                  <button onClick={handleReiRefund} className="btn-secondary flex-1 text-red-600">Refund ALGO</button>
                </div>
              </div>
            ) : (
              <>
                <Loader2 size={48} className="animate-spin text-violet-500 mb-6" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Staking & Starting Session...</h2>
                <p className="text-muted">Signing escrow transactions and starting agents.</p>
              </>
            )}
          </motion.div>
        )}

        {/* REI Working */}
        {step === 'rei-working' && reiCurrentAgent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="card-elevated p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Brain size={24} className="text-violet-500" />
                  <h2 className="text-xl font-bold text-foreground">Agent: {reiCurrentAgent.lane}</h2>
                </div>
                {reiValidationScore != null && (
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    reiValidationScore >= 8 ? 'bg-green-100 text-green-700' :
                    reiValidationScore >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <Shield size={14} className="inline mr-1" />
                    Score: {reiValidationScore}/10
                  </div>
                )}
              </div>
              <div className="p-4 rounded-lg bg-black/[0.02] border border-black/[0.06] mb-4">
                <p className="text-sm text-muted mb-1">Sub-task:</p>
                <p className="text-foreground">{reiCurrentAgent.subTask}</p>
              </div>
              <p className="text-sm text-muted mb-4">Agent: {truncateAddress(reiCurrentAgent.agentAddress)} • Success Rate: {reiCurrentAgent.successRate}%</p>

              {!reiTaskReady ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-violet-50 border border-violet-200 mb-6">
                  <Loader2 size={20} className="animate-spin text-violet-500" />
                  <span className="text-sm text-violet-700">Agent is executing task...</span>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none mb-6 p-4 rounded-lg bg-black/[0.02] border border-black/[0.06] max-h-64 overflow-y-auto">
                  <ReactMarkdown>{reiDecryptedOutput || ''}</ReactMarkdown>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={handleReiApprove} disabled={!reiTaskReady} className="btn-primary flex-1 disabled:opacity-50">
                  <span className="flex items-center gap-2"><ThumbsUp size={18} /> Approve</span>
                </button>
                <button onClick={handleReiReject} disabled={!reiTaskReady} className="btn-secondary flex-1 border-red-500/30 hover:border-red-500/60 text-red-600 disabled:opacity-50">
                  <span className="flex items-center gap-2"><ThumbsDown size={18} /> Reject</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* REI Complete */}
        {step === 'rei-complete' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="card-elevated p-8">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle size={28} className="text-green-500" />
                <h2 className="text-2xl font-bold text-foreground">REI Session Complete</h2>
              </div>
              <div className="space-y-3 mb-6">
                {reiResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/[0.02] border border-black/[0.06]">
                    <div className="flex items-center gap-3">
                      {r.approved ? <ThumbsUp size={16} className="text-green-500" /> : <ThumbsDown size={16} className="text-red-500" />}
                      <span className="font-medium text-foreground">{r.agent.lane}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted">
                      {r.validationScore != null && <span>Score: {r.validationScore}/10</span>}
                      <span className={r.approved ? 'text-green-600' : 'text-red-600'}>{r.approved ? 'Approved' : 'Rejected'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setStep('describe'); setReiResults([]); setReiRecommendation(null); }} className="btn-primary w-full">
                New Task
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
