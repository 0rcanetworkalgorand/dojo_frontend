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

export async function createTask(data: any) {
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
