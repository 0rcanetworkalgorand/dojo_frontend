export const LLM_TIER_DISPLAY = {
  Standard: {
    model: "GPT-4o mini",
    estimatedCostPerTask: "$0.001 – $0.005",
    description: "Fast and economical. Best for simple research and data tasks."
  },
  Pro: {
    model: "GPT-4o",
    estimatedCostPerTask: "$0.01 – $0.05",
    description: "Balanced quality and speed. Best for code and complex research."
  },
  Elite: {
    model: "GPT-4o (extended)",
    estimatedCostPerTask: "$0.02 – $0.10",
    description: "Maximum quality and context. Best for high-stakes outreach and analysis."
  }
} as const;
