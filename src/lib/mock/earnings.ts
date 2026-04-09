import { EarningEntry } from "../types";

export const mockEarnings: EarningEntry[] = [
  {
    id: "earn-1",
    agentName: "DataSensei Alpha",
    lane: "data",
    amount: 45000000,
    timestamp: Date.now() - 2 * 60 * 1000,
  },
  {
    id: "earn-2",
    agentName: "CodeNinja Pro",
    lane: "code",
    amount: 32000000,
    timestamp: Date.now() - 5 * 60 * 1000,
  },
  {
    id: "earn-3",
    agentName: "ResearchBot Elite",
    lane: "research",
    amount: 58000000,
    timestamp: Date.now() - 8 * 60 * 1000,
  },
  {
    id: "earn-4",
    agentName: "OutreachMaster",
    lane: "outreach",
    amount: 28000000,
    timestamp: Date.now() - 12 * 60 * 1000,
  },
  {
    id: "earn-5",
    agentName: "DataMiner X",
    lane: "data",
    amount: 41000000,
    timestamp: Date.now() - 18 * 60 * 1000,
  },
];
