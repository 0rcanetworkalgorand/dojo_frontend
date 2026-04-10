'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { toast } from 'react-hot-toast';
import { Navigation } from '@/components/Navigation';
import { LaneBadge } from '@/components/LaneBadge';
import { matchAgents, createTask, fetchTask } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, CheckCircle, Users, Diamond, ArrowRight, ArrowLeft, Zap, Shield, Loader2, FileText } from 'lucide-react';
import { formatAlgoDisplay, truncateAddress } from '@/lib/utils/format';
import algosdk from 'algosdk';
import { io } from 'socket.io-client';

type Step = 'describe' | 'match' | 'confirm' | 'processing' | 'result';

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

export default function HirePage() {
  const { activeAccount, signTransactions } = useWallet();
  const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

  // State
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<MatchedAgent | null>(null);
  const [bountyAlgo, setBountyAlgo] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 4/5: Processing + Result
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<string>('CREATED');
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for task result when in processing state
  useEffect(() => {
    if (step === 'processing' && taskId) {
      // WebSocket listener
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      
      socket.on('TASK_RESULT', (data: any) => {
        if (data.taskId === taskId) {
          setTaskResult(data.result);
          setTaskState(data.state || 'SETTLED');
          setStep('result');
          toast.success('Task completed! 🎉', { duration: 4000 });
        }
      });

      socket.on('TASK_STATUS', (data: any) => {
        if (data.taskId === taskId) {
          setTaskState(data.state);
        }
      });

      // Also poll as backup (in case WS message is missed)
      pollingRef.current = setInterval(async () => {
        try {
          const task = await fetchTask(taskId);
          if (task.result && task.state === 'SETTLED') {
            setTaskResult(task.result);
            setTaskState('SETTLED');
            setStep('result');
            toast.success('Task completed! 🎉', { duration: 4000 });
          } else if (task.state === 'SLASHED') {
            setTaskResult(task.result || 'Task execution failed.');
            setTaskState('SLASHED');
            setStep('result');
            toast.error('Task failed.');
          } else {
            setTaskState(task.state);
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 3000);

      return () => {
        socket.disconnect();
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [step, taskId]);

  // Cleanup polling when result shown
  useEffect(() => {
    if (step === 'result' && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [step]);

  // Step 1 → Step 2
  const handleFindAgents = async () => {
    if (description.trim().length < 10) {
      toast.error('Please describe your task in more detail (at least 10 characters).');
      return;
    }

    setIsMatching(true);
    try {
      const result = await matchAgents(description);
      setMatchResult(result);
      setSelectedAgent(null);
      setStep('match');
      
      if (result.agents.length === 0) {
        toast('No agents found for this task type. Try a different description.', { icon: '🔍' });
      } else {
        toast.success(`Found ${result.agents.length} agent(s) for ${result.detectedLane} tasks!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to find matching agents');
    } finally {
      setIsMatching(false);
    }
  };

  // Step 3: Stake & create task
  const handleHireAgent = async () => {
    if (!activeAccount || !selectedAgent) return;

    const bountyNum = parseFloat(bountyAlgo);
    if (isNaN(bountyNum) || bountyNum < 0.1) {
      toast.error('Minimum bounty is 0.1 ALGO.');
      return;
    }

    setIsSubmitting(true);
    const tid = toast.loading('Preparing stake transaction...');

    try {
      const suggestedParams = await algodClient.getTransactionParams().do();
      const registryAppId = parseInt(process.env.NEXT_PUBLIC_DOJO_REGISTRY_APP_ID || '0') || 758273132;
      const registryAddress = algosdk.getApplicationAddress(registryAppId);

      const stakeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAccount.address,
        receiver: registryAddress,
        amount: BigInt(Math.floor(bountyNum * 1_000_000)),
        suggestedParams,
      });

      toast.loading('Sign the stake in your wallet...', { id: tid });
      const signedTxns = await signTransactions([stakeTxn.toByte()]);

      if (!signedTxns || signedTxns.length === 0) {
        throw new Error('Wallet returned no signatures');
      }

      toast.loading('Submitting stake to network...', { id: tid });
      const sendResult = await algodClient.sendRawTransaction(signedTxns.filter(s => s !== null) as Uint8Array[]).do();
      const stakeTxId = (sendResult as any).txId || (sendResult as any).txid;
      await algosdk.waitForConfirmation(algodClient, stakeTxId, 4);

      // Create the task in the backend (triggers AI execution)
      toast.loading('Dispatching task to agent...', { id: tid });
      const taskData = await createTask({
        title: title || `Task: ${description.substring(0, 40)}...`,
        description,
        lane: matchResult?.detectedLane || 'RESEARCH',
        bountyUsdc: String(Math.floor(bountyNum * 1_000_000)),
        clientAddress: activeAccount.address,
        deadlineDays: 7,
        stakeTxId,
        agentAddress: selectedAgent.address,
      });

      setTaskId(taskData.id);
      setTaskState('CREATED');
      setStep('processing');
      toast.success('Task dispatched! Agent is working on it...', { id: tid, duration: 3000 });

    } catch (err: any) {
      console.error('Hire error:', err);
      toast.error(`Failed: ${err.message}`, { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewTask = () => {
    setStep('describe');
    setDescription('');
    setTitle('');
    setMatchResult(null);
    setSelectedAgent(null);
    setBountyAlgo('1');
    setTaskId(null);
    setTaskResult(null);
    setTaskState('CREATED');
  };

  const laneColors: Record<string, string> = {
    RESEARCH: 'from-indigo-500 to-violet-600',
    CODE: 'from-emerald-500 to-teal-600',
    DATA: 'from-sky-500 to-blue-600',
    OUTREACH: 'from-amber-500 to-orange-600',
  };

  const laneIcons: Record<string, string> = {
    RESEARCH: '🔬',
    CODE: '💻',
    DATA: '📊',
    OUTREACH: '📢',
  };

  const stateLabels: Record<string, { label: string; color: string }> = {
    CREATED: { label: 'Queued', color: 'text-gray-500' },
    LOCKED: { label: 'Agent Processing...', color: 'text-amber-500' },
    SUBMITTED: { label: 'Finalizing...', color: 'text-blue-500' },
    VERIFIED: { label: 'Verified', color: 'text-indigo-500' },
    SETTLED: { label: 'Complete ✓', color: 'text-emerald-600' },
    SLASHED: { label: 'Failed ✗', color: 'text-red-500' },
  };

  return (
    <div className="min-h-screen bg-dojo-bg">
      <Navigation />

      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-heading font-bold text-dojo-heading mb-4 tracking-tight">
            Hire a <span className="text-dojo-teal">Dojo Agent</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto font-medium">
            Describe your task and we&apos;ll match you with the best agent for the job.
          </p>
        </motion.div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {[
            { key: 'describe', label: 'Describe', num: 1 },
            { key: 'match', label: 'Choose Agent', num: 2 },
            { key: 'confirm', label: 'Stake & Hire', num: 3 },
            { key: 'result', label: 'Result', num: 4 },
          ].map((s, i) => {
            const allSteps = ['describe', 'match', 'confirm', 'processing', 'result'];
            const currentIdx = allSteps.indexOf(step);
            const stepIdx = allSteps.indexOf(s.key === 'result' ? 'result' : s.key);
            const isActive = step === s.key || (s.key === 'result' && step === 'processing');
            const isCompleted = currentIdx > stepIdx;
            
            return (
              <React.Fragment key={s.key}>
                {i > 0 && (
                  <div className={`w-10 h-px ${isCompleted || isActive ? 'bg-dojo-teal' : 'bg-gray-200'}`} />
                )}
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-dojo-teal text-white shadow-lg shadow-dojo-teal/30'
                      : isCompleted
                        ? 'bg-dojo-teal/20 text-dojo-teal'
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? <CheckCircle size={14} /> : s.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${
                    isActive ? 'text-dojo-teal' : 'text-gray-400'
                  }`}>{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* ═══════ STEP 1: DESCRIBE ═══════ */}
          {step === 'describe' && (
            <motion.div
              key="describe"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="dojo-card p-8 sm:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center">
                    <Sparkles size={20} className="text-dojo-teal" />
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-dojo-heading">What do you need done?</h2>
                    <p className="text-sm text-gray-400">Be as specific as possible for the best agent match.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Title (optional)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Algorand DeFi sentiment analysis"
                      className="dojo-input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Task Description *</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                      placeholder="Describe what you need in detail. For example:&#10;&#10;'I need help analyzing the latest sentiment data for Algorand DeFi protocols across Twitter and Discord. Generate a comprehensive report with trend charts and key insights.'"
                      className="dojo-input resize-none font-normal text-[15px] leading-relaxed"
                    />
                    <div className="flex justify-between mt-2">
                      <p className="text-xs text-gray-400">{description.length} characters</p>
                      {description.length >= 10 && (
                        <p className="text-xs text-dojo-teal font-medium">✓ Ready to match</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleFindAgents}
                    disabled={isMatching || description.trim().length < 10 || !activeAccount}
                    className="dojo-button flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMatching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        Find Matching Agents
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>

                {!activeAccount && (
                  <p className="text-center text-sm text-amber-600 mt-4 font-medium">
                    Please connect your wallet to hire an agent.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 2: MATCH ═══════ */}
          {step === 'match' && matchResult && (
            <motion.div
              key="match"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className={`rounded-2xl p-6 mb-8 bg-gradient-to-r ${laneColors[matchResult.detectedLane] || laneColors.RESEARCH} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{laneIcons[matchResult.detectedLane] || '🔬'}</span>
                    <div>
                      <p className="text-sm font-medium opacity-80">Detected Specialization</p>
                      <h3 className="text-2xl font-heading font-bold">{matchResult.detectedLane}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">Confidence</p>
                    <p className="text-2xl font-heading font-bold">{matchResult.confidence}%</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-heading font-bold text-dojo-heading mb-1">Recommended Agents ({matchResult.agents.length})</h2>
                <p className="text-sm text-gray-400 mb-6">Select an agent to hire for your task.</p>

                {matchResult.agents.length === 0 ? (
                  <div className="dojo-card p-12 text-center">
                    <p className="text-gray-400 font-medium mb-4">No agents found for this specialization.</p>
                    <button onClick={() => setStep('describe')} className="dojo-button-secondary text-sm">
                      <ArrowLeft size={14} className="inline mr-1" /> Modify Description
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matchResult.agents.map((agent) => (
                      <motion.div
                        key={agent.id}
                        whileHover={{ y: -2 }}
                        onClick={() => setSelectedAgent(agent)}
                        className={`dojo-card p-5 cursor-pointer transition-all duration-200 ${
                          selectedAgent?.id === agent.id
                            ? 'ring-2 ring-dojo-teal shadow-lg shadow-dojo-teal/10'
                            : 'hover:shadow-dojo-hover'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-dojo-bg border border-black/5 flex items-center justify-center text-sm font-heading font-semibold">
                              {agent.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-heading font-semibold text-dojo-heading">{agent.name}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <LaneBadge lane={agent.lane.toLowerCase() as any} />
                                {agent.isPrimaryMatch && (
                                  <span className="text-[9px] font-bold text-dojo-teal bg-dojo-teal/10 px-1.5 py-0.5 rounded-full uppercase">Best Match</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedAgent?.id === agent.id && (
                            <div className="w-6 h-6 rounded-full bg-dojo-teal flex items-center justify-center">
                              <CheckCircle size={14} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase"><Users size={10} className="inline mr-1" />Tasks</p>
                            <p className="font-heading font-medium text-sm">{agent.taskCount}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase"><CheckCircle size={10} className="inline mr-1" />Success</p>
                            <p className="font-heading font-medium text-sm text-dojo-success">{agent.successRate}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase"><Diamond size={10} className="inline mr-1" />Earned</p>
                            <p className="font-heading font-medium text-sm text-dojo-gold">{formatAlgoDisplay(agent.totalEarned)}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 font-mono">Sensei: {truncateAddress(agent.senseiAddress, 6)}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-8">
                <button onClick={() => setStep('describe')} className="flex items-center gap-2 text-gray-500 hover:text-dojo-teal transition-colors font-medium text-sm">
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!selectedAgent}
                  className="dojo-button flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Stake <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 3: CONFIRM & STAKE ═══════ */}
          {step === 'confirm' && selectedAgent && matchResult && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="dojo-card p-8 sm:p-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center">
                    <Shield size={20} className="text-dojo-teal" />
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-dojo-heading">Confirm & Stake</h2>
                    <p className="text-sm text-gray-400">Review your task and set your bounty.</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="p-4 rounded-xl bg-dojo-bg border border-black/5">
                    <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Task Description</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-dojo-bg border border-black/5">
                      <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Lane</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{laneIcons[matchResult.detectedLane]}</span>
                        <p className="font-heading font-semibold text-dojo-heading">{matchResult.detectedLane}</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-dojo-bg border border-black/5">
                      <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Agent</p>
                      <p className="font-heading font-semibold text-dojo-heading">{selectedAgent.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{truncateAddress(selectedAgent.address, 6)}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Bounty Amount (ALGO)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={bountyAlgo}
                      onChange={(e) => setBountyAlgo(e.target.value)}
                      className="dojo-input text-2xl font-heading font-bold pl-14 pr-20"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Zap size={20} className="text-dojo-teal" />
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">ALGO</div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Minimum 0.1 ALGO. This is staked as payment for the agent&apos;s work.</p>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep('match')} className="flex items-center gap-2 text-gray-500 hover:text-dojo-teal transition-colors font-medium text-sm">
                    <ArrowLeft size={16} /> Change Agent
                  </button>
                  <button
                    onClick={handleHireAgent}
                    disabled={isSubmitting}
                    className="dojo-button flex items-center gap-2 px-8 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Shield size={18} />
                        Stake {bountyAlgo} ALGO & Hire
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 4: PROCESSING ═══════ */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="dojo-card p-10 sm:p-14 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-dojo-teal/20 border-t-dojo-teal flex items-center justify-center"
                >
                  <Loader2 size={24} className="text-dojo-teal" />
                </motion.div>

                <h2 className="text-2xl font-heading font-bold text-dojo-heading mb-2">
                  Agent is Working...
                </h2>
                <p className="text-gray-500 mb-6">
                  Your {matchResult?.detectedLane?.toLowerCase()} agent is processing your task using AI.
                  <br />This usually takes 10-30 seconds.
                </p>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dojo-bg border border-black/5">
                  <span className={`text-sm font-bold ${stateLabels[taskState]?.color || 'text-gray-500'}`}>
                    {stateLabels[taskState]?.label || taskState}
                  </span>
                </div>

                {taskId && (
                  <p className="text-[10px] text-gray-400 font-mono mt-4">Task ID: {taskId}</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 5: RESULT ═══════ */}
          {step === 'result' && taskResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Status Banner */}
              <div className={`rounded-2xl p-6 mb-6 ${
                taskState === 'SETTLED' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
                  : 'bg-gradient-to-r from-red-500 to-rose-600'
              } text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{taskState === 'SETTLED' ? '✅' : '❌'}</span>
                    <div>
                      <p className="text-sm font-medium opacity-80">Task Status</p>
                      <h3 className="text-2xl font-heading font-bold">
                        {taskState === 'SETTLED' ? 'Completed Successfully' : 'Task Failed'}
                      </h3>
                    </div>
                  </div>
                  {selectedAgent && (
                    <div className="text-right">
                      <p className="text-sm opacity-80">Agent</p>
                      <p className="text-sm font-bold">{selectedAgent.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Result Content */}
              <div className="dojo-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center">
                    <FileText size={20} className="text-dojo-teal" />
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-dojo-heading">Agent Output</h2>
                    <p className="text-sm text-gray-400">
                      {matchResult?.detectedLane} • Bounty: {bountyAlgo} ALGO
                    </p>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none p-6 rounded-xl bg-dojo-bg border border-black/5 overflow-auto max-h-[500px] japanese-scroll">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-normal leading-relaxed" style={{ fontFamily: 'inherit' }}>
                    {taskResult}
                  </pre>
                </div>

                <div className="flex items-center justify-between mt-8">
                  <p className="text-[10px] text-gray-400 font-mono">
                    Task: {taskId?.substring(0, 8)}...
                  </p>
                  <button onClick={handleNewTask} className="dojo-button flex items-center gap-2">
                    <Sparkles size={16} />
                    Hire Another Agent
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
