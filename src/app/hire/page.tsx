'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { toast } from 'react-hot-toast';
import { Navigation } from '@/components/Navigation';
import { LaneBadge } from '@/components/LaneBadge';
import { matchAgents, createTask, fetchTask, analyzeWithRei, startReiSessionWithStakes, approveReiSession, rejectReiSession, getReiSessionStatus, releaseTaskPayment, slashTask, ReiSelectedAgent, ReiRecommendation } from '@/lib/api';
import { ensureKeyPair, getStoredPrivateKey, getStoredPublicKey, decryptWithPrivateKey, KeyPair } from '@/lib/crypto';
import { initX402Client, isX402Ready } from '@/lib/x402Client';
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
  RESEARCH: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  CODE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DATA: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  OUTREACH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const stateLabels: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Queued', color: 'text-gray-500' },
  LOCKED: { label: 'Agent Processing...', color: 'text-amber-500' },
  SUBMITTED: { label: 'Finalizing...', color: 'text-blue-500' },
  VERIFIED: { label: 'Verified', color: 'text-indigo-500' },
  SETTLED: { label: 'Complete ✓', color: 'text-emerald-600' },
  SLASHED: { label: 'Failed ✗', color: 'text-red-500' },
};

export default function HirePage() {
  const { activeAccount, signTransactions } = useWallet();
  const { transactionSigner } = useWallet();
  const [algodClient] = useState(() => new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''));

  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<MatchedAgent | null>(null);
  const [bountyAlgo, setBountyAlgo] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<string>('CREATED');
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [reiRecommendation, setReiRecommendation] = useState<ReiRecommendation | null>(null);
  const [reiSessionId, setReiSessionId] = useState<string | null>(null);
  const [reiCurrentAgent, setReiCurrentAgent] = useState<(ReiSelectedAgent & { taskId: string }) | null>(null);
  const [reiCurrentResult, setReiCurrentResult] = useState<string | null>(null);
  const [reiCurrentIndex, setReiCurrentIndex] = useState(0);
  const [reiTotalAgents, setReiTotalAgents] = useState(0);
  const [reiIsAnalyzing, setReiIsAnalyzing] = useState(false);
  const [reiIsProcessing, setReiIsProcessing] = useState(false);
  const [reiApprovedCount, setReiApprovedCount] = useState(0);
  const [reiRejectedCount, setReiRejectedCount] = useState(0);
  const [reiCompletedResults, setReiCompletedResults] = useState<{ lane: string; output: string; status: string; taskId: string }[]>([]);
  const [reiBountyPerAgent, setReiBountyPerAgent] = useState('1');
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);

  useEffect(() => { 
    setMounted(true); 
    ensureKeyPair()
      .then(kp => {
        console.log('[Hire] KeyPair ready:', !!kp?.privateKey, !!kp?.publicKey);
        setKeyPair(kp);
      })
      .catch(err => console.error('[Hire] KeyPair failed:', err));
  }, []);

  // Initialize x402 when wallet connects
  useEffect(() => {
    if (activeAccount && signTransactions) {
      console.log('[Hire] Wallet connected, initializing x402...');
      initX402Client({
        signTransactions: async (txns: Uint8Array[]) => {
          const signed = await signTransactions(txns);
          // Filter out nulls - x402 requires all transactions to be signed
          return signed.filter((s): s is Uint8Array => s !== null);
        },
        address: activeAccount.address
      }).then(() => {
        console.log('[Hire] x402 ready:', isX402Ready());
      });
    }
  }, [activeAccount, signTransactions]);

  const decryptOutput = async (encryptedData: string | null | undefined): Promise<string | null> => {
    console.log('[Decrypt] Called with:', !!encryptedData, 'length:', encryptedData?.length);
    if (!encryptedData) return null;
    
    // Validate base64 before decrypting
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(encryptedData)) {
      console.error('[Decrypt] Invalid base64 string:', encryptedData.substring(0, 50) + '...');
      return '⚠️ Invalid encrypted data received';
    }
    
    const privateKey = getStoredPrivateKey();
    console.log('[Decrypt] Private key found:', !!privateKey);
    if (!privateKey) {
      console.warn('[Decrypt] No private key found in localStorage');
      return '⚠️ No decryption key found. Please refresh the page.';
    }
    try {
      const decrypted = await decryptWithPrivateKey(encryptedData, privateKey);
      console.log('[Decrypt] Success, length:', decrypted.length);
      return decrypted;
    } catch (err) {
      console.error('[Decrypt] Failed:', err);
      return '⚠️ Failed to decrypt output: ' + (err as Error).message;
    }
  };

  useEffect(() => {
    if (step === 'processing' && taskId) {
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      socket.on('TASK_RESULT', async (data: any) => {
        if (data.taskId === taskId) {
          const decrypted = await decryptOutput(data.result || data.encryptedResult);
          setTaskResult(decrypted);
          setTaskState(data.state || 'SETTLED');
          setStep('result');
          toast.success('Task completed! 🎉', { duration: 4000 });
        }
      });
      socket.on('TASK_STATUS', (data: any) => {
        if (data.taskId === taskId) setTaskState(data.state);
      });
      socket.on('BOUNTY_REFUNDED', (data: any) => {
        if (data.taskId === taskId) toast.success('💰 Bounty refunded to your wallet (100%)', { duration: 5000 });
      });
      socket.on('COLLATERAL_SLASHED', () => {
        toast('⚠️ Agent collateral slashed: 10% sent to platform treasury', { icon: '🔒', duration: 5000 });
      });
      pollingRef.current = setInterval(async () => {
        try {
          const task = await fetchTask(taskId);
          if (task.encryptedResult && task.state === 'SETTLED') {
            const decrypted = await decryptOutput(task.encryptedResult);
            setTaskResult(decrypted); setTaskState('SETTLED'); setStep('result');
            toast.success('Task completed! 🎉', { duration: 4000 });
          } else if (task.state === 'SLASHED') {
            const decrypted = await decryptOutput(task.encryptedResult);
            setTaskResult(decrypted || 'Task execution failed.'); setTaskState('SLASHED'); setStep('result');
            toast.error('Task failed.');
          } else if (task.encryptedResult && task.state === 'SUBMITTED') {
            // Task output ready, waiting for approval
            const decrypted = await decryptOutput(task.encryptedResult);
            setTaskResult(decrypted);
            setTaskState('SUBMITTED');
            setStep('awaiting-approval');
          } else {
            setTaskState(task.state);
          }
        } catch (e) { }
      }, 3000);
      return () => { socket.disconnect(); if (pollingRef.current) clearInterval(pollingRef.current); };
    }
  }, [step, taskId]);

  useEffect(() => {
    if (step === 'rei-working' && reiSessionId && reiCurrentAgent?.taskId) {
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

      socket.on('REI_AGENT_RESULT', async (data: any) => {
        if (data.taskId ===reiCurrentAgent?.taskId) {
          const decrypted = await decryptOutput(data.result || data.encryptedResult);
          setReiCurrentResult(decrypted);
          setReiIsProcessing(false);
        }
      });

      socket.on('REI_SESSION_COMPLETE', (data: any) => {
        if (data.sessionId === reiSessionId) {
          setStep('rei-complete');
          setReiIsProcessing(false);
        }
      });

      socket.on('BOUNTY_REFUNDED', () => {
        toast.success('💰 Bounty refunded!', { duration: 5000 });
      });

      socket.on('COLLATERAL_SLASHED', () => {
        toast('⚠️ Agent stake slashed: 10% to treasury', { icon: '🔒', duration: 5000 });
      });

      const pollInterval = setInterval(async () => {
        try {
          const task = await fetchTask(reiCurrentAgent?.taskId || '');
          if (task.encryptedResult && task.state !== 'CREATED' && task.state !== 'LOCKED') {
            const decrypted = await decryptOutput(task.encryptedResult);
            setReiCurrentResult(decrypted);
            setReiIsProcessing(false);
            clearInterval(pollInterval);
          }
        } catch (e) { }
      }, 3000);

      return () => { socket.disconnect(); clearInterval(pollInterval); };
    }
  }, [step, reiSessionId, reiCurrentAgent?.taskId]);

  useEffect(() => {
    if (step === 'result' && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [step]);

  // ── Manual flow handlers ──────────────────────────────────────────────

  const handleFindAgents = async () => {
    if (description.trim().length < 10) { toast.error('Please describe your task in more detail.'); return; }
    setIsMatching(true);
    try {
      const result = await matchAgents(description);
      setMatchResult(result);
      setSelectedAgent(null);
      setStep('match');
      if (result.agents.length === 0) toast('No agents found for this task type.', { icon: '🔍' });
      else toast.success(`Found ${result.agents.length} agent(s) for ${result.detectedLane}!`);
    } catch (err: any) { toast.error(err.message || 'Failed to find agents'); }
    finally { setIsMatching(false); }
  };

  const handleHireAgent = async () => {
    if (!activeAccount || !selectedAgent) return;
    const bountyNum = parseFloat(bountyAlgo);
    if (isNaN(bountyNum) || bountyNum < 0.1) { toast.error('Minimum bounty is 0.1 ALGO.'); return; }

    setIsSubmitting(true);
    const tid = toast.loading('Preparing task...');

    const onChainTaskId = `T-${Date.now()}`;

    try {
      toast.loading('Attempting x402 payment...', { id: tid });
      const taskData = await createTask({
        id: onChainTaskId,
        title: title || `Task: ${description.substring(0, 40)}...`,
        description,
        lane: matchResult?.detectedLane || 'RESEARCH',
        bountyUsdc: String(Math.floor(bountyNum * 1_000_000)),
        clientAddress: activeAccount.address,
        clientPublicKey: getStoredPublicKey(),
        deadlineDays: 7,
        agentAddress: selectedAgent.address,
      });

      setTaskId(taskData.id);
      setTaskState('CREATED');
      setStep('processing');
      toast.success('Task dispatched via x402!', { id: tid, duration: 3000 });
    } catch (err: any) {
      console.log('[Hire] x402 failed, falling back to on-chain:', err.message);
      
      const tid2 = toast.loading('Falling back to on-chain...');
      
      try {
        const escrowAppId = parseInt(process.env.NEXT_PUBLIC_ESCROW_VAULT_APP_ID || '0') || 758715891;
        const bountyMicroAlgo = BigInt(Math.floor(bountyNum * 1_000_000));

        const atc = await buildCreateTaskGroup({
          algodClient,
          escrowVaultAppId: escrowAppId,
          clientAddress: activeAccount.address,
          workerAddress: selectedAgent.address,
          senseiAddress: selectedAgent.senseiAddress,
          taskId: onChainTaskId,
          bountyAmountAlgo: bountyMicroAlgo,
          signer: algosdk.makeEmptyTransactionSigner()
        });

        const txGroup = atc.buildGroup();
        const rawTxns = txGroup.map(t => t.txn.toByte());

        toast.loading('Sign the stake transaction...', { id: tid2 });
        const signedTxns = await signTransactions(rawTxns);
        if (!signedTxns || signedTxns.length === 0) throw new Error('Wallet returned no signatures');

        toast.loading('Submitting to network...', { id: tid2 });
        const sendResult = await (algodClient as any).sendRawTransaction(signedTxns.filter(s => s !== null) as Uint8Array[]).do();
        const stakeTxId = sendResult?.txId || sendResult?.txid;
        await algosdk.waitForConfirmation(algodClient, stakeTxId, 4);

        toast.loading('Dispatching task...', { id: tid2 });
        const taskData = await createTask({
          id: onChainTaskId,
          title: title || `Task: ${description.substring(0, 40)}...`,
          description,
          lane: matchResult?.detectedLane || 'RESEARCH',
          bountyUsdc: String(Math.floor(bountyNum * 1_000_000)),
          clientAddress: activeAccount.address,
          clientPublicKey: getStoredPublicKey(),
          deadlineDays: 7,
          stakeTxId,
          agentAddress: selectedAgent.address,
        });

        setTaskId(taskData.id);
        setTaskState('CREATED');
        setStep('processing');
        toast.success('Task dispatched via on-chain!', { id: tid2, duration: 3000 });
      } catch (fallbackErr: any) {
        console.error('Fallback failed:', fallbackErr);
        toast.error(`Fallback failed: ${fallbackErr.message}`, { id: tid2 });
      }
    } finally { setIsSubmitting(false); }
  };

  // ── Rei flow handlers ────────────────────────────────────────────────

  const handleReiAnalyze = async () => {
    if (description.trim().length < 10) { toast.error('Please describe your task in more detail.'); return; }
    setReiIsAnalyzing(true);
    try {
      const result = await analyzeWithRei(description);
      setReiRecommendation(result);
      setStep('rei-recommendation');
    } catch (err: any) { toast.error(err.message || 'Rei analysis failed.'); }
    finally { setReiIsAnalyzing(false); }
  };

  const handleReiStakeAndBegin = async () => {
    if (!activeAccount || !reiRecommendation || !transactionSigner) return;

    const bountyNum = parseFloat(reiBountyPerAgent);
    if (isNaN(bountyNum) || bountyNum < 0.1) { toast.error('Minimum bounty per agent is 0.1 ALGO.'); return; }

    setReiIsProcessing(true);
    const tid = toast.loading('Starting staking process...');

    try {
      const escrowAppId = parseInt(process.env.NEXT_PUBLIC_ESCROW_VAULT_APP_ID || '0') || 758715891;
      const bountyMicroAlgo = BigInt(Math.floor(bountyNum * 1_000_000));
      const appAddr = algosdk.getApplicationAddress(escrowAppId);
      const abi = buildEscrowAbi();
      const stakeTxIds: string[] = [];

      console.log('[Rei Frontend] ════════════════════════════════════════');
      console.log('[Rei Frontend] Starting sequential staking for', reiRecommendation.selectedAgents.length, 'agent(s)');
      console.log('[Rei Frontend] Escrow App ID:', escrowAppId);
      console.log('[Rei Frontend] Escrow Address:', appAddr.toString());
      console.log('[Rei Frontend] Bounty per agent:', bountyNum, 'ALGO');
      console.log('[Rei Frontend] ════════════════════════════════════════');

      for (let i = 0; i < reiRecommendation.selectedAgents.length; i++) {
        const agent = reiRecommendation.selectedAgents[i];
        const taskId = agent.taskId || `T-${Date.now()}-${i}`;
        agent.taskId = taskId;
        stakeTxIds.push(`stake-${taskId}`);

        console.log('[Rei Frontend] ─────────────────────────────────────────');
        console.log('[Rei Frontend] Staking Agent', i + 1, 'of', reiRecommendation.selectedAgents.length);
        console.log('[Rei Frontend]   Lane:', agent.lane);
        console.log('[Rei Frontend]   Agent:', agent.agentAddress.substring(0, 10) + '...');
        console.log('[Rei Frontend]   Sensei:', agent.senseiAddress.substring(0, 10) + '...');
        console.log('[Rei Frontend]   Task ID:', taskId);

        toast.loading(`Signing transaction for ${agent.lane} agent...`, { id: tid });

        const sp = await algodClient.getTransactionParams().do();
        const atc = new algosdk.AtomicTransactionComposer();

        const bountyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAccount.address,
          receiver: appAddr.toString(),
          amount: bountyMicroAlgo,
          suggestedParams: sp,
        });

        atc.addMethodCall({
          appID: BigInt(escrowAppId),
          method: abi.getMethodByName('lock_bounty'),
          methodArgs: [taskId, activeAccount.address, agent.agentAddress, agent.senseiAddress, bountyMicroAlgo, { txn: bountyTxn, signer: transactionSigner }],
          sender: activeAccount.address,
          signer: transactionSigner,
          suggestedParams: sp,
          boxes: [{ appIndex: escrowAppId, name: new Uint8Array(Buffer.from(taskId)) }]
        });

        const txGroup = atc.buildGroup();
        const rawTxns = txGroup.map(t => t.txn.toByte());

        console.log('[Rei Frontend]   Built', rawTxns.length, 'transactions (payment + app call)');

        const signedTxns = await signTransactions(rawTxns);
        if (!signedTxns || signedTxns.length === 0) {
          throw new Error(`Wallet returned no signatures for agent ${i + 1}`);
        }
        console.log('[Rei Frontend]   Wallet signed', signedTxns.length, 'transactions');

        const validSigned = signedTxns.filter((s: any) => s !== null) as Uint8Array[];
        const sendResult = await (algodClient as any).sendRawTransaction(validSigned).do();
        
        const txId = sendResult?.txId || sendResult?.txid || '';
        console.log('[Rei Frontend]   Submitted, txId:', txId);

        if (!txId) {
          throw new Error(`No txId returned for agent ${i + 1}`);
        }

        toast.loading(`Waiting for confirmation...`, { id: tid });
        const confirmed = await algosdk.waitForConfirmation(algodClient, txId, 4);
        
        console.log('[Rei Frontend]   Confirmed! Round:', confirmed['confirmedRound']);
        console.log('[Rei Frontend]   ✓ Agent', i + 1, 'staked successfully');
      }

      console.log('[Rei Frontend] ════════════════════════════════════════');
      console.log('[Rei Frontend] All', reiRecommendation.selectedAgents.length, 'agents staked successfully!');
      console.log('[Rei Frontend] ════════════════════════════════════════');

      toast.loading('Starting Rei session...', { id: tid });
      
      const pubKey = getStoredPublicKey();
      console.log('[Hire] Starting Rei with public key:', pubKey ? 'EXISTS (' + pubKey.length + ' chars)' : 'NULL');

      const session = await startReiSessionWithStakes(
        activeAccount.address,
        description,
        reiRecommendation.selectedAgents,
        stakeTxIds,
        getStoredPublicKey() || undefined
      );

      console.log('[Rei Frontend] Session started, sessionId:', session.sessionId);

      setReiSessionId(session.sessionId);
      setReiCurrentAgent(session.firstAgent as ReiSelectedAgent & { taskId: string });
      setReiCurrentIndex(0);
      setReiTotalAgents(reiRecommendation.selectedAgents.length);
      setReiCurrentResult(null);
      setReiIsProcessing(false);
      setStep('rei-working');

      toast.success('Rei session started!', { id: tid, duration: 4000 });

    } catch (err: any) {
      console.error('[Rei Frontend] ════════════════════════════════════════');
      console.error('[Rei Frontend] STAKING FAILED:', err.message);
      console.error('[Rei Frontend] ════════════════════════════════════════');
      toast.error(err.message || 'Failed to stake', { id: tid });
      setReiIsProcessing(false);
    }
  };

  const handleReiApprove = async () => {
    if (!reiSessionId) return;
    setReiIsProcessing(true);
    const tid = toast.loading('Sending payment to sensei...');

    try {
      const result = await approveReiSession(reiSessionId);

      setReiCompletedResults(prev => [
        ...prev,
        { lane: reiCurrentAgent?.lane || '', output: result.taskResult, status: 'APPROVED', taskId: result.taskId }
      ]);
      setReiApprovedCount(c => c + 1);

      toast.success('💰 Payment sent to agent creator!', { id: tid, duration: 4000 });

      if (result.sessionComplete) {
        setStep('rei-complete');
      } else if (result.nextAgent) {
        setReiCurrentAgent(result.nextAgent as ReiSelectedAgent & { taskId: string });
        setReiCurrentIndex(i => i + 1);
        setReiCurrentResult(null);
        setReiIsProcessing(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed', { id: tid });
      setReiIsProcessing(false);
    }
  };

  const handleReiReject = async () => {
    if (!reiSessionId) return;
    setReiIsProcessing(true);
    const tid = toast.loading('Processing refund...');

    try {
      const result = await rejectReiSession(reiSessionId);

      setReiCompletedResults(prev => [
        ...prev,
        { lane: reiCurrentAgent?.lane || '', output: result.taskResult, status: 'REJECTED', taskId: result.taskId }
      ]);
      setReiRejectedCount(c => c + 1);

      toast.success('↩️ Refund sent. Agent penalized.', { id: tid, duration: 4000 });

      if (result.sessionComplete) {
        setStep('rei-complete');
      } else if (result.nextAgent) {
        setReiCurrentAgent(result.nextAgent as ReiSelectedAgent & { taskId: string });
        setReiCurrentIndex(i => i + 1);
        setReiCurrentResult(null);
        setReiIsProcessing(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Refund failed', { id: tid });
      setReiIsProcessing(false);
    }
  };

  // ── Reset handlers ────────────────────────────────────────────────────

  const handleNewTask = () => {
    setStep('describe'); setDescription(''); setTitle(''); setMatchResult(null);
    setSelectedAgent(null); setBountyAlgo('1'); setTaskId(null); setTaskResult(null); setTaskState('CREATED');
  };

  const handleReiNewTask = () => {
    setStep('describe'); setDescription(''); setTitle(''); setReiRecommendation(null);
    setReiSessionId(null); setReiCurrentAgent(null); setReiCurrentResult(null);
    setReiCurrentIndex(0); setReiTotalAgents(0); setReiIsAnalyzing(false);
    setReiIsProcessing(false); setReiApprovedCount(0); setReiRejectedCount(0);
    setReiCompletedResults([]); setReiBountyPerAgent('1');
  };

  // ── Helper: ABI builder ───────────────────────────────────────────────

  function buildEscrowAbi() {
    return new algosdk.ABIInterface({
      name: 'EscrowVault',
      methods: [{
        name: 'lock_bounty',
        args: [
          { type: 'string', name: 'task_id' },
          { type: 'address', name: 'client' },
          { type: 'address', name: 'worker' },
          { type: 'address', name: 'sensei' },
          { type: 'uint64', name: 'bounty_amount' },
          { type: 'pay', name: 'bounty_txn' }
        ],
        returns: { type: 'bool' }
      }]
    });
  }

  async function buildCreateTaskGroup(params: {
    algodClient: algosdk.Algodv2;
    escrowVaultAppId: number;
    clientAddress: string;
    workerAddress: string;
    senseiAddress: string;
    taskId: string;
    bountyAmountAlgo: bigint;
    signer: algosdk.TransactionSigner;
  }): Promise<algosdk.AtomicTransactionComposer> {
    const { algodClient, escrowVaultAppId, clientAddress, workerAddress, senseiAddress, taskId, bountyAmountAlgo, signer } = params;
    const sp = await algodClient.getTransactionParams().do();
    const atc = new algosdk.AtomicTransactionComposer();
    const appAddr = algosdk.getApplicationAddress(escrowVaultAppId);

    const bountyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: clientAddress,
      receiver: appAddr.toString(),
      amount: bountyAmountAlgo,
      suggestedParams: sp,
    });

    const abi = buildEscrowAbi();
    atc.addMethodCall({
      appID: BigInt(escrowVaultAppId),
      method: abi.getMethodByName('lock_bounty'),
      methodArgs: [taskId, clientAddress, workerAddress, senseiAddress, bountyAmountAlgo, { txn: bountyTxn, signer }],
      sender: clientAddress,
      signer,
      suggestedParams: sp,
      boxes: [{ appIndex: escrowVaultAppId, name: new Uint8Array(Buffer.from(taskId)) }]
    });

    return atc;
  }

  return (
    <div className="min-h-screen bg-dojo-bg">
      <Navigation />
      {/* DEBUG: Show key status - read directly from localStorage */}
      <div className="fixed top-20 right-4 z-50 bg-black/80 text-white text-xs px-3 py-2 rounded">
        🔑 Pub: {typeof window !== 'undefined' && localStorage.getItem('dojo_encryption_public_key') ? 'YES' : 'NO'} | Priv: {typeof window !== 'undefined' && localStorage.getItem('dojo_encryption_private_key') ? 'YES' : 'NO'}
      </div>
      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
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
            const allSteps = ['describe', 'match', 'confirm', 'processing', 'result', 'rei-recommendation', 'rei-staking', 'rei-working', 'rei-complete'];
            const currentIdx = allSteps.indexOf(step);
            const stepIdx = allSteps.indexOf(s.key === 'result' ? 'result' : s.key);
            const isActive = step === s.key || (s.key === 'result' && step === 'processing');
            const isCompleted = currentIdx > stepIdx;
            return (
              <React.Fragment key={s.key}>
                {i > 0 && <div className={`w-10 h-px ${isCompleted || isActive ? 'bg-dojo-teal' : 'bg-gray-200'}`} />}
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isActive ? 'bg-dojo-teal text-white shadow-lg shadow-dojo-teal/30' : isCompleted ? 'bg-dojo-teal/20 text-dojo-teal' : 'bg-gray-100 text-gray-400'}`}>
                    {isCompleted ? <CheckCircle size={14} /> : s.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-dojo-teal' : 'text-gray-400'}`}>{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ═══════ STEP 1: DESCRIBE ═══════ */}
          {step === 'describe' && (
            <motion.div key="describe" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
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
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Algorand DeFi sentiment analysis" className="dojo-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Task Description *</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                      placeholder="Describe what you need in detail..."
                      className="dojo-input resize-none font-normal text-[15px] leading-relaxed" />
                    <div className="flex justify-between mt-2">
                      <p className="text-xs text-gray-400">{description.length} characters</p>
                      {description.length >= 10 && <p className="text-xs text-dojo-teal font-medium">✓ Ready to match</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <div className="flex gap-3 justify-end">
                    <button onClick={handleReiAnalyze}
                      disabled={reiIsAnalyzing || description.trim().length < 10 || (mounted && !activeAccount)}
                      className="dojo-button-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-dojo-teal/30 hover:border-dojo-teal px-6">
                      {reiIsAnalyzing ? (
                        <><div className="w-4 h-4 border-2 border-dojo-teal/30 border-t-dojo-teal rounded-full animate-spin" />Rei analyzing...</>
                      ) : (
                        <><Brain size={18} className="text-dojo-teal" />Let Rei Take Over</>
                      )}
                    </button>
                    <button onClick={handleFindAgents}
                      disabled={isMatching || description.trim().length < 10 || (mounted && !activeAccount)}
                      className="dojo-button flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isMatching ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing...</>
                      ) : (
                        <><Search size={18} />Choose Agent Manually<ArrowRight size={16} /></>
                      )}
                    </button>
                  </div>
                </div>

                {mounted && !activeAccount && (
                  <p className="text-center text-sm text-amber-600 mt-4 font-medium">Please connect your wallet to hire an agent.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════ REI: RECOMMENDATION PANEL ═══════ */}
          {step === 'rei-recommendation' && reiRecommendation && (
            <motion.div key="rei-recommendation" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
              <div className="dojo-card p-8 sm:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center">
                    <Bot size={20} className="text-dojo-teal" />
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-dojo-heading">Rei&apos;s Recommendation</h2>
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      <CircleDot size={12} className="text-dojo-teal animate-pulse" />AI-powered agent selection
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-dojo-teal/5 border border-dojo-teal/10 mb-6">
                  <p className="text-sm text-gray-600 leading-relaxed italic">&ldquo;{reiRecommendation.reasoning}&rdquo;</p>
                </div>

                <div className="space-y-4 mb-6">
                  {reiRecommendation.selectedAgents.map((agent, index) => (
                    <div key={`${agent.agentAddress}-${index}`} className="dojo-card p-5 border border-black/5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-7 h-7 rounded-full bg-dojo-teal/10 flex items-center justify-center text-xs font-bold text-dojo-teal">{index + 1}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${laneBadgeColors[agent.lane] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>{agent.lane}</span>
                        <span className="text-xs text-gray-400 font-mono">{truncateAddress(agent.agentAddress, 6)}</span>
                        <div className="ml-auto flex items-center gap-3">
                          <span className="text-xs text-dojo-success font-medium">{(agent.successRate * 100).toFixed(0)}% success</span>
                          <span className="text-xs text-gray-400">{Number(agent.tasksCompleted)} tasks</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3 pl-10">{agent.subTask}</p>
                      <div className="pl-10">
                        <p className="text-[10px] text-gray-400 mb-1 font-medium">Score</p>
                        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-dojo-teal rounded-full" style={{ width: `${Math.min(agent.score, 1) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-dojo-bg border border-black/5 mb-6">
                  <label className="block text-xs text-gray-400 font-semibold uppercase mb-2">Bounty Per Agent (ALGO)</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="0.1" step="0.1" value={reiBountyPerAgent}
                      onChange={(e) => setReiBountyPerAgent(e.target.value)}
                      className="dojo-input text-xl font-heading font-bold flex-1" />
                    <span className="text-sm font-bold text-gray-400">ALGO × {reiRecommendation.selectedAgents.length} agents = <span className="text-dojo-teal">{(parseFloat(reiBountyPerAgent || '0') * reiRecommendation.selectedAgents.length).toFixed(2)} ALGO</span> total</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => { setStep('describe'); setReiRecommendation(null); }}
                    className="flex items-center gap-2 text-gray-500 hover:text-dojo-teal transition-colors font-medium text-sm">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button onClick={handleReiStakeAndBegin} disabled={reiIsProcessing}
                    className="dojo-button flex items-center gap-2 disabled:opacity-50 px-8">
                    {reiIsProcessing ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                    ) : (
                      <><Shield size={18} />Stake &amp; Begin</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ REI: WORKING PANEL ═══════ */}
          {step === 'rei-working' && reiCurrentAgent && (
            <motion.div key="rei-working" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className={`rounded-2xl p-6 mb-6 bg-gradient-to-r ${laneColors[reiCurrentAgent.lane] || laneColors.RESEARCH} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                      <Brain size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium opacity-80">Agent {reiCurrentIndex + 1} of {reiTotalAgents}</p>
                      <h3 className="text-2xl font-heading font-bold">{reiCurrentAgent.lane}</h3>
                    </div>
                  </div>
                  {reiIsProcessing && !reiCurrentResult && (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-sm font-medium">Processing...</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="dojo-card p-6 mb-6">
                <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Sub-task</p>
                <p className="text-sm text-gray-700 leading-relaxed">{reiCurrentAgent.subTask}</p>
              </div>

              {reiCurrentResult ? (
                <div className="dojo-card p-8 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center">
                      <FileText size={20} className="text-dojo-teal" />
                    </div>
                    <div>
                      <h3 className="text-lg font-heading font-bold text-dojo-heading">Agent Output</h3>
                      <p className="text-xs text-gray-400 font-mono">{truncateAddress(reiCurrentAgent.agentAddress, 6)}</p>
                    </div>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none p-6 rounded-xl bg-[#0D0D0D] border border-white/5 overflow-auto max-h-[500px] shadow-inner">
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg !my-0 !bg-transparent" {...props}>
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={`${className} bg-white/10 px-1 rounded text-dojo-teal`} {...props}>{children}</code>
                          );
                        },
                        p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-4">{children}</p>,
                        h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-6 mb-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-5 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-md font-bold text-white mt-4 mb-2">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-1">{children}</ul>,
                        li: ({ children }) => <li className="text-gray-300">{children}</li>,
                      }}
                    >
                      {reiCurrentResult}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="dojo-card p-10 sm:p-14 text-center mb-6">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-dojo-teal/20 border-t-dojo-teal flex items-center justify-center">
                    <Loader2 size={24} className="text-dojo-teal" />
                  </motion.div>
                  <h2 className="text-2xl font-heading font-bold text-dojo-heading mb-2">Agent is Working...</h2>
                  <p className="text-gray-500">Your {reiCurrentAgent.lane.toLowerCase()} agent is processing your task.<br />This usually takes 10-30 seconds.</p>
                </div>
              )}

              {reiCurrentResult && (
                <div className="flex gap-3">
                  <button onClick={handleReiReject} disabled={reiIsProcessing}
                    className="flex-1 py-4 px-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-semibold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all disabled:opacity-50">
                    {reiIsProcessing ? <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <ThumbsDown size={18} />}
                    Not Satisfied — Get Refund
                  </button>
                  <button onClick={handleReiApprove} disabled={reiIsProcessing}
                    className="flex-1 py-4 px-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                    {reiIsProcessing ? <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /> : <ThumbsUp size={18} />}
                    Satisfied — Send Payment
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════ REI: SESSION COMPLETE ═══════ */}
          {step === 'rei-complete' && (
            <motion.div key="rei-complete" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="dojo-card p-8 sm:p-10 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-dojo-teal/10 flex items-center justify-center">
                  <Sparkles size={36} className="text-dojo-teal" />
                </div>
                <h2 className="text-3xl font-heading font-bold text-dojo-heading mb-3">Rei Session Complete</h2>
                <p className="text-gray-500 mb-8">All agents have been processed. Here&apos;s your summary.</p>

                <div className="flex gap-4 justify-center mb-8">
                  <div className="px-6 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-2xl font-heading font-bold text-emerald-500">{reiApprovedCount}</p>
                    <p className="text-xs text-gray-400 font-medium uppercase">Approved</p>
                  </div>
                  <div className="px-6 py-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-2xl font-heading font-bold text-red-500">{reiRejectedCount}</p>
                    <p className="text-xs text-gray-400 font-medium uppercase">Rejected</p>
                  </div>
                  <div className="px-6 py-4 rounded-xl bg-dojo-teal/10 border border-dojo-teal/20">
                    <p className="text-2xl font-heading font-bold text-dojo-teal">{reiTotalAgents}</p>
                    <p className="text-xs text-gray-400 font-medium uppercase">Total Agents</p>
                  </div>
                </div>

                <div className="space-y-3 text-left mb-8">
                  {reiCompletedResults.map((result, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-dojo-bg border border-black/5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${result.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {result.status === 'APPROVED' ? <CheckCircle size={14} /> : <X size={14} />}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${laneBadgeColors[result.lane] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>{result.lane}</span>
                      <span className={`text-xs font-medium ${result.status === 'APPROVED' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {result.status === 'APPROVED' ? 'Approved ✓' : 'Rejected ✗'}
                      </span>
                    </div>
                  ))}
                </div>

                <button onClick={handleReiNewTask} className="dojo-button flex items-center gap-2 mx-auto">
                  <Sparkles size={16} />Start New Task
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 2: MATCH (Manual) ═══════ */}
          {step === 'match' && matchResult && (
            <motion.div key="match" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
              <div className={`rounded-2xl p-6 mb-8 bg-gradient-to-r ${laneColors[matchResult.detectedLane] || laneColors.RESEARCH} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{matchResult.detectedLane === 'CODE' ? '💻' : matchResult.detectedLane === 'DATA' ? '📊' : matchResult.detectedLane === 'OUTREACH' ? '📢' : '🔬'}</span>
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
                    {matchResult.agents.filter(agent => agent.address && agent.address.length === 58).map((agent) => (
                      <motion.div key={agent.id} whileHover={{ y: -2 }} onClick={() => setSelectedAgent(agent)}
                        className={`dojo-card p-5 cursor-pointer transition-all duration-200 ${selectedAgent?.id === agent.id ? 'ring-2 ring-dojo-teal shadow-lg shadow-dojo-teal/10' : 'hover:shadow-dojo-hover'}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-dojo-bg border border-black/5 flex items-center justify-center text-sm font-heading font-semibold">
                              {agent.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-heading font-semibold text-dojo-heading">{agent.name}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <LaneBadge lane={agent.lane.toLowerCase() as any} />
                                {agent.isPrimaryMatch && <span className="text-[9px] font-bold text-dojo-teal bg-dojo-teal/10 px-1.5 py-0.5 rounded-full uppercase">Best Match</span>}
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
                          <div><p className="text-[10px] text-gray-400 font-semibold uppercase"><Users size={10} className="inline mr-1" />Tasks</p><p className="font-heading font-medium text-sm">{agent.taskCount}</p></div>
                          <div><p className="text-[10px] text-gray-400 font-semibold uppercase"><CheckCircle size={10} className="inline mr-1" />Success</p><p className="font-heading font-medium text-sm text-dojo-success">{agent.successRate}%</p></div>
                          <div><p className="text-[10px] text-gray-400 font-semibold uppercase"><Diamond size={10} className="inline mr-1" />Earned</p><p className="font-heading font-medium text-sm text-dojo-gold">{agent.totalEarned}</p></div>
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
                <button onClick={() => setStep('confirm')} disabled={!selectedAgent}
                  className="dojo-button flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  Continue to Stake <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 3: CONFIRM & STAKE (Manual) ═══════ */}
          {step === 'confirm' && selectedAgent && matchResult && (
            <motion.div key="confirm" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
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
                      <p className="font-heading font-semibold text-dojo-heading">{matchResult.detectedLane}</p>
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
                    <input type="number" min="0.1" step="0.1" value={bountyAlgo} onChange={(e) => setBountyAlgo(e.target.value)}
                      className="dojo-input text-2xl font-heading font-bold pl-14 pr-20" />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2"><Zap size={20} className="text-dojo-teal" /></div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">ALGO</div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Minimum 0.1 ALGO. This is staked as payment for the agent&apos;s work.</p>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep('match')} className="flex items-center gap-2 text-gray-500 hover:text-dojo-teal transition-colors font-medium text-sm">
                    <ArrowLeft size={16} /> Change Agent
                  </button>
                  <button onClick={handleHireAgent} disabled={isSubmitting}
                    className="dojo-button flex items-center gap-2 px-8 disabled:opacity-50">
                    {isSubmitting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                    ) : (
                      <><Shield size={18} />Stake {bountyAlgo} ALGO &amp; Hire</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 4: PROCESSING ═══════ */}
          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="dojo-card p-10 sm:p-14 text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-dojo-teal/20 border-t-dojo-teal flex items-center justify-center">
                  <Loader2 size={24} className="text-dojo-teal" />
                </motion.div>
                <h2 className="text-2xl font-heading font-bold text-dojo-heading mb-2">Agent is Working...</h2>
                <p className="text-gray-500 mb-6">Your {matchResult?.detectedLane?.toLowerCase()} agent is processing your task using AI.<br />This usually takes 10-30 seconds.</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dojo-bg border border-black/5">
                  <span className={`text-sm font-bold ${stateLabels[taskState]?.color || 'text-gray-500'}`}>
                    {stateLabels[taskState]?.label || taskState}
                  </span>
                </div>
                {taskId && <p className="text-[10px] text-gray-400 font-mono mt-4">Task ID: {taskId}</p>}
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 4b: AWAITING APPROVAL ═══════ */}
          {step === 'awaiting-approval' && taskResult && (
            <motion.div key="awaiting-approval" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="rounded-2xl p-6 mb-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">⏳</span>
                    <div>
                      <p className="text-sm font-medium opacity-80">Task Status</p>
                      <h3 className="text-2xl font-heading font-bold">Output Ready - Review & Approve</h3>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dojo-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center">
                    <FileText size={20} className="text-dojo-teal" />
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-dojo-heading">Agent Output</h2>
                    <p className="text-sm text-gray-400">Review the output and decide if you're satisfied</p>
                  </div>
                </div>

                <div className="prose prose-invert prose-sm max-w-none p-6 rounded-xl bg-[#0D0D0D] border border-white/5 overflow-auto max-h-[500px] shadow-inner mb-6">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg !my-0 !bg-transparent" {...props}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={`${className} bg-white/10 px-1 rounded text-dojo-teal`} {...props}>{children}</code>
                        );
                      },
                      p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-4">{children}</p>,
                    }}
                  >
                    {taskResult}
                  </ReactMarkdown>
                </div>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={async () => {
                      if (!activeAccount?.address || !taskId) return;
                      try {
                        toast.loading('Approving and releasing payment...', { id: 'approve' });
                        await releaseTaskPayment(taskId, activeAccount.address);
                        setTaskState('SETTLED');
                        setStep('result');
                        toast.success('Payment released to developer! ✅', { id: 'approve' });
                      } catch (err: any) {
                        toast.error('Failed: ' + err.message, { id: 'approve' });
                      }
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl transition-all hover:scale-105"
                  >
                    <ThumbsUp size={20} />
                    Satisfied - Release Payment
                  </button>
                  <button
                    onClick={async () => {
                      if (!activeAccount?.address || !taskId) return;
                      try {
                        toast.loading('Rejecting and slashing...', { id: 'reject' });
                        await slashTask(taskId, activeAccount.address);
                        setTaskState('SLASHED');
                        setStep('result');
                        toast.success('Payment refunded, developer slashed!', { id: 'reject' });
                      } catch (err: any) {
                        toast.error('Failed: ' + err.message, { id: 'reject' });
                      }
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold rounded-xl transition-all hover:scale-105"
                  >
                    <ThumbsDown size={20} />
                    Not Satisfied - Reject & Refund
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 5: RESULT (Manual) ═══════ */}
          {step === 'result' && taskResult && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className={`rounded-2xl p-6 mb-6 ${taskState === 'SETTLED' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{taskState === 'SETTLED' ? '✅' : '❌'}</span>
                    <div>
                      <p className="text-sm font-medium opacity-80">Task Status</p>
                      <h3 className="text-2xl font-heading font-bold">{taskState === 'SETTLED' ? 'Completed Successfully' : 'Task Failed'}</h3>
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

              <div className="dojo-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-dojo-teal/10 flex items-center justify-center">
                    <FileText size={20} className="text-dojo-teal" />
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-dojo-heading">Agent Output</h2>
                    <p className="text-sm text-gray-400">{matchResult?.detectedLane} • Bounty: {bountyAlgo} ALGO</p>
                  </div>
                </div>

                <div className="prose prose-invert prose-sm max-w-none p-6 rounded-xl bg-[#0D0D0D] border border-white/5 overflow-auto max-h-[600px] shadow-inner">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg !my-0 !bg-transparent" {...props}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={`${className} bg-white/10 px-1 rounded text-dojo-teal`} {...props}>{children}</code>
                        );
                      },
                      p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-4">{children}</p>,
                      h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-6 mb-3">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-5 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-md font-bold text-white mt-4 mb-2">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-1">{children}</ul>,
                      li: ({ children }) => <li className="text-gray-300">{children}</li>,
                    }}
                  >
                    {taskResult}
                  </ReactMarkdown>
                </div>

                <div className="flex items-center justify-between mt-8">
                  <p className="text-[10px] text-gray-400 font-mono">Task: {taskId?.substring(0, 8)}...</p>
                  <button onClick={handleNewTask} className="dojo-button flex items-center gap-2">
                    <Sparkles size={16} />Hire Another Agent
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