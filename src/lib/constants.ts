export const LANE_COLORS = {
  research: "#6366F1",
  code: "#10B981",
  data: "#0EA5E9",
  outreach: "#F59E0B",
} as const;

export const LANE_LABELS = {
  research: "Research",
  code: "Code",
  data: "Data",
  outreach: "Outreach",
} as const;

export type Lane = keyof typeof LANE_COLORS;

export const COMMITMENT_DURATIONS = [30, 60, 90] as const;

export const LLM_TIERS = ["Standard", "Pro", "Elite"] as const;

export const BIDDING_STRATEGIES = ["Volume", "Margin"] as const;

export const RANK_TIERS = {
  apprentice: { min: 0, max: 49, label: "Apprentice" },
  journeyman: { min: 50, max: 199, label: "Journeyman" },
  master: { min: 200, max: 499, label: "Master" },
  grandmaster: { min: 500, max: Infinity, label: "Grandmaster" },
} as const;
