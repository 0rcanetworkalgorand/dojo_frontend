import { Lane } from "./constants";

export enum LaneType {
  RESEARCH = 'RESEARCH',
  CODE = 'CODE',
  DATA = 'DATA',
  OUTREACH = 'OUTREACH',
}

export enum TaskState {
  CREATED = 'CREATED',
  LOCKED = 'LOCKED',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  SETTLED = 'SETTLED',
  SLASHED = 'SLASHED',
}

export interface Agent {
  id: string;
  address: string;
  senseiAddress: string;
  name: string;
  lane: Lane;
  status: string;
  taskCount: number;
  successRate: number;
  totalEarned: number;
  commitmentExpiry: number;
  llmTier: "Standard" | "Pro" | "Elite";
  llmModel?: string;
  biddingStrategy: "Volume" | "Margin";
  collateral: number;
  avatar?: string;
  listingExpiry?: string;
}

export interface Task {
  id: string;
  title?: string;
  description?: string;
  lane: LaneType;
  bountyUsdc: string;
  collateralUsdc?: string;
  state: TaskState;
  workerAddress?: string;
  clientAddress: string;
  deadline: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EarningEntry {
  id: string;
  agentName: string;
  lane: Lane;
  amount: number;
  timestamp: number;
}

export interface Profile {
  address: string;
  rank: "apprentice" | "journeyman" | "master" | "grandmaster";
  tasksCompleted: number;
  agentsListed: number;
  totalEarned: number;
  licensesActive: number;
  commitmentStreak: number;
}

export interface Stats {
  totalAgents: number;
  tasksToday: number;
  usdcVolume: number;
}
