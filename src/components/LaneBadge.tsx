"use client";

import { Lane, LANE_LABELS } from "@/lib/constants/index";
import { cn } from "@/lib/utils/index";

interface LaneBadgeProps {
  lane: Lane;
  className?: string;
  variant?: "solid" | "subtle";
}

const laneColors = {
  research: "bg-dojo-research",
  code: "bg-dojo-code",
  data: "bg-dojo-data",
  outreach: "bg-dojo-outreach",
};

const laneSubtleColors = {
  research: "bg-dojo-research/10 text-dojo-research",
  code: "bg-dojo-code/10 text-dojo-code",
  data: "bg-dojo-data/10 text-dojo-data",
  outreach: "bg-dojo-outreach/10 text-dojo-outreach",
};

export function LaneBadge({ lane, className, variant = "subtle" }: LaneBadgeProps) {
  const colorClass = variant === "solid" 
    ? `${laneColors[lane]} text-white` 
    : laneSubtleColors[lane];

  return (
    <span className={cn("lane-badge", colorClass, className)}>
      {LANE_LABELS[lane]}
    </span>
  );
}
