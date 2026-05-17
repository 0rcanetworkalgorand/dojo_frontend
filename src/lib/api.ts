import algosdk from "algosdk";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ALGOD_SERVER = "https://testnet-api.4160.nodely.io";
const ALGOD_TOKEN = "";
const ALGOD_PORT = "";

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
const USDC_ID = Number(process.env.NEXT_PUBLIC_USDC_ASSET_ID || 10458941);

export async function fetchAgents(lane?: string, sensei?: string) {
  const params = new URLSearchParams();
  if (lane) params.append('lane', lane);
  if (sensei) params.append('sensei', sensei);
  
  const res = await fetch(`${BASE_URL}/api/agents?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function fetchStats(address: string) {
  const res = await fetch(`${BASE_URL}/api/agents/stats/${address}`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchEvents() {
  const res = await fetch(`${BASE_URL}/api/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

import { getFetchWithPayment, isX402Ready } from './x402Client';

export async function createTask(data: any) {
  const x402Fetch = getFetchWithPayment();
  
  if (isX402Ready() && x402Fetch) {
    try {
      console.log('[API] Trying x402 payment for task creation...');
      const res = await x402Fetch(`${BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, paymentMethod: 'x402' }),
      });
      
      if (res.ok) {
        console.log('[API] Task created via x402 payment');
        return res.json();
      }
      
      if (res.status === 402) {
        console.log('[API] x402 payment required, falling back to on-chain...');
        throw new Error('x402_payment_required');
      }
      
      throw new Error(`x402 request failed: ${res.status}`);
    } catch (err: any) {
      if (err.message === 'x402_payment_required' || err.message?.includes('x402')) {
        console.log('[API] Falling back to on-chain transaction...');
        throw err;
      }
      console.error('[API] x402 error:', err);
      throw err;
    }
  }
  
  const res = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function fetchWalletAlgo(address: string): Promise<number> {
  try {
    console.log(`[API] Fetching ALGO balance for ${address}`);
    const accountInfo = await algodClient.accountInformation(address).do();
    const amount = Number(accountInfo['amount']); // Returns microAlgos
    console.log(`[API] Found ALGO balance: ${amount} microAlgos`);
    return amount;
  } catch (err) {
    console.error('Failed to fetch ALGO balance:', err);
    return 0;
  }
}

export async function matchAgents(description: string) {
  const res = await fetch(`${BASE_URL}/api/tasks/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to match agents');
  }
  return res.json();
}

export async function fetchTask(taskId: string) {
  const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`);
  if (!res.ok) throw new Error('Failed to fetch task');
  return res.json();
}

export interface ReiSelectedAgent {
  agentAddress: string;
  senseiAddress: string;
  lane: string;
  score: number;
  successRate: number;
  tasksCompleted: string;
  tasksFailed: string;
  subTask: string;
  taskId?: string;
}

export interface ReiRecommendation {
  analyzedLanes: string[];
  reasoning: string;
  selectedAgents: ReiSelectedAgent[];
}

export async function analyzeWithRei(description: string): Promise<ReiRecommendation> {
  const res = await fetch(`${BASE_URL}/api/rei/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Rei analysis failed');
  }
  return res.json();
}

export async function startReiSession(
  clientAddress: string,
  description: string,
  selectedAgents: ReiSelectedAgent[]
): Promise<{ sessionId: string; firstAgent: ReiSelectedAgent & { taskId: string }; subTask: string }> {
  const stakeTxIds = selectedAgents.map((_, i) => `pending-${i}`);
  const serialized = selectedAgents.map(agent => ({
    agentAddress: agent.agentAddress,
    senseiAddress: agent.senseiAddress,
    lane: agent.lane,
    score: typeof agent.score === 'number' ? agent.score : parseFloat(String(agent.score)),
    successRate: typeof agent.successRate === 'number' ? agent.successRate : parseFloat(String(agent.successRate)),
    tasksCompleted: String(agent.tasksCompleted ?? '0'),
    tasksFailed: String(agent.tasksFailed ?? '0'),
    subTask: String(agent.subTask ?? ''),
  }));
  const res = await fetch(`${BASE_URL}/api/rei/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientAddress, description, selectedAgents: serialized, stakeTxIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to start Rei session');
  }
  return res.json();
}

export async function startReiSessionWithStakes(
  clientAddress: string,
  description: string,
  selectedAgents: ReiSelectedAgent[],
  stakeTxIds: string[],
  clientPublicKey?: string
): Promise<{ sessionId: string; firstAgent: ReiSelectedAgent & { taskId: string }; subTask: string }> {
  const serialized = selectedAgents.map(agent => ({
    agentAddress: agent.agentAddress,
    senseiAddress: agent.senseiAddress,
    lane: agent.lane,
    score: typeof agent.score === 'number' ? agent.score : parseFloat(String(agent.score)),
    successRate: typeof agent.successRate === 'number' ? agent.successRate : parseFloat(String(agent.successRate)),
    tasksCompleted: String(agent.tasksCompleted ?? '0'),
    tasksFailed: String(agent.tasksFailed ?? '0'),
    subTask: String(agent.subTask ?? ''),
    taskId: String(agent.taskId ?? ''),
  }));
  const res = await fetch(`${BASE_URL}/api/rei/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientAddress, description, selectedAgents: serialized, stakeTxIds, clientPublicKey }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to start Rei session');
  }
  return res.json();
}

export async function approveReiSession(sessionId: string): Promise<{
  nextAgent: (ReiSelectedAgent & { taskId: string }) | null;
  sessionComplete: boolean;
  taskResult: string;
  taskId: string;
}> {
  const res = await fetch(`${BASE_URL}/api/rei/session/${sessionId}/approve`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Approval failed');
  }
  return res.json();
}

export async function rejectReiSession(sessionId: string): Promise<{
  nextAgent: (ReiSelectedAgent & { taskId: string }) | null;
  sessionComplete: boolean;
  taskResult: string;
  taskId: string;
}> {
  const res = await fetch(`${BASE_URL}/api/rei/session/${sessionId}/reject`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Rejection failed');
  }
  return res.json();
}

export async function getReiSessionStatus(sessionId: string) {
  const res = await fetch(`${BASE_URL}/api/rei/session/${sessionId}/status`);
  if (!res.ok) throw new Error('Failed to fetch session status');
  return res.json();
}

export async function releaseTaskPayment(taskId: string, callerAddress: string) {
  const res = await fetch(`${BASE_URL}/api/tasks/${taskId}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callerAddress }),
  });
  if (!res.ok) throw new Error('Failed to release payment');
  return res.json();
}

export async function slashTask(taskId: string, callerAddress: string) {
  const res = await fetch(`${BASE_URL}/api/tasks/${taskId}/slash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callerAddress }),
  });
  if (!res.ok) throw new Error('Failed to slash');
  return res.json();
}
