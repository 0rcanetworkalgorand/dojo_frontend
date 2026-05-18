"use client";

import { Agent } from "@/lib/types";
import { formatAlgoDisplay, formatPercentage } from "@/lib/utils/format";
import { motion } from "framer-motion";
import { LaneBadge } from "./LaneBadge";
import { Users, CheckCircle, Diamond, Clock } from "lucide-react";
import { cn } from "@/lib/utils/index";

interface AgentCardProps {
  agent: Agent;
  onLicense?: (agentId: string) => void;
  onStake?: (agentId: string) => void;
  isOwner?: boolean;
  className?: string;
}

export function AgentCard({ agent, onLicense, onStake, isOwner, className }: AgentCardProps) {
  const daysLeft = Math.ceil((agent.commitmentExpiry - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "card-elevated p-8 flex flex-col group",
        className
      )}
    >
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl bg-black/[0.03] border border-black/[0.06] flex items-center justify-center overflow-hidden group-hover:border-accent/20 transition-colors duration-300">
            <div 
              className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted uppercase tracking-tighter"
              style={{ background: `linear-gradient(135deg, rgba(10,10,11,0.03), transparent)` }}
            >
              {(agent.name || "Agent").substring(0, 2)}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-xl text-foreground uppercase tracking-tighter mb-2">
              {agent.name || "Agent"}
            </h3>
            <div className="flex flex-wrap gap-2">
              <LaneBadge lane={agent.lane} />
              {agent.llmTier && (
                <div className="px-3 py-1 rounded-full bg-black/[0.03] text-muted text-xs font-semibold uppercase tracking-wider border border-black/[0.06]">
                  {agent.llmTier}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-10">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-semibold tracking-widest text-muted flex items-center gap-2">
            <Users size={12} className="opacity-50" /> Tasks
          </p>
          <p className="text-lg font-bold text-foreground tracking-tight">{agent.taskCount}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-semibold tracking-widest text-muted flex items-center gap-2">
            <CheckCircle size={12} className="opacity-50" /> Success
          </p>
          <p className="text-lg font-bold text-accent tracking-tight">
            {formatPercentage(agent.successRate)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-semibold tracking-widest text-muted flex items-center gap-2">
            <Diamond size={12} className="text-dojo-gold opacity-50" /> Earnings
          </p>
          <p className="text-lg font-bold text-dojo-gold tracking-tight">
            {formatAlgoDisplay(agent.totalEarned)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-semibold tracking-widest text-muted flex items-center gap-2">
            <Clock size={12} className="opacity-50" /> Commitment
          </p>
          <p className="text-lg font-bold text-muted tracking-tight">
            {daysLeft > 0 ? `${daysLeft}d` : "Expired"}
          </p>
        </div>
      </div>

      <div className="mt-auto">
        {isOwner && agent.status === 'ACTIVE' && (
          <button
            onClick={() => onStake?.(agent.id)}
            className="w-full btn-primary !text-[11px] group/btn"
          >
            <span className="flex items-center justify-center gap-2">
              STAKE (10 ALGO)
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="inline-block"
              >
                <ArrowRight size={14} />
              </motion.span>
            </span>
          </button>
        )}
        {isOwner && (
          <button
            onClick={() => onLicense?.(agent.id)}
            className="w-full btn-secondary !text-[11px] mt-3"
          >
            <span className="flex items-center justify-center gap-2">
              LICENSE ($50 USDC)
              <FileText size={14} />
            </span>
          </button>
        )}
        {!isOwner && (
          <button
            onClick={() => onLicense?.(agent.id)}
            className="w-full btn-outline !text-[11px] mt-3"
          >
            <span className="flex items-center justify-center gap-2">
              LICENSE ($50 USDC)
              <FileText size={14} />
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

import { ArrowRight, FileText } from "lucide-react";
