"use client";

import { Agent } from "@/lib/types";
import { formatAlgoDisplay, formatPercentage } from "@/lib/utils/format";
import { motion } from "framer-motion";
import { LaneBadge } from "./LaneBadge";
import { Users, CheckCircle, Diamond, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "dojo-card p-6 flex flex-col group transition-all duration-300",
        "hover:shadow-dojo-hover hover:ring-2 hover:ring-dojo-teal/20",
        className
      )}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-dojo-bg border border-black/5 flex items-center justify-center overflow-hidden">
            <div 
              className="w-full h-full flex items-center justify-center text-xl font-heading font-semibold opacity-80"
              style={{ background: `linear-gradient(135deg, white, #FAF9F5)` }}
            >
              {(agent.name || "Agent").substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-lg leading-tight mb-1 group-hover:text-dojo-teal transition-colors">
              {agent.name || "Agent"}
            </h3>
            <div className="flex flex-wrap gap-2 mb-2">
              <LaneBadge lane={agent.lane} />
              {agent.llmTier && (
                <div className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-widest border border-gray-200/50">
                  {agent.llmTier}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1">
            <Users size={12} /> Tasks
          </p>
          <p className="font-heading font-medium text-gray-900">{agent.taskCount}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1">
            <CheckCircle size={12} /> Success
          </p>
          <p className="font-heading font-medium text-dojo-success">
            {formatPercentage(agent.successRate)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1">
            <Diamond size={12} className="text-dojo-gold" /> Total Earned
          </p>
          <p className="font-heading font-medium text-dojo-gold">
            {formatAlgoDisplay(agent.totalEarned)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1">
            <Clock size={12} /> Commitment
          </p>
          <p className="font-heading font-medium text-gray-600">
            {daysLeft > 0 ? `${daysLeft} days` : "Expired"}
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-2">
        {isOwner && agent.status === 'ACTIVE' && (
          <button
            onClick={() => onStake?.(agent.id)}
            className="w-full dojo-button bg-dojo-teal border-dojo-teal text-white hover:bg-dojo-teal/90 group/btn"
          >
            <span className="flex items-center justify-center gap-2">
              Stake & List (10 ALGO)
              <motion.span
                initial={{ x: 0 }}
                whileHover={{ x: 3 }}
                transition={{ duration: 0.2 }}
              >
                →
              </motion.span>
            </span>
          </button>
        )}
        
        {!isOwner && (
          <button
            onClick={() => onLicense?.(agent.id)}
            className="w-full dojo-button group/btn"
          >
            <span className="flex items-center justify-center gap-2">
              License Now
              <motion.span
                initial={{ x: 0 }}
                whileHover={{ x: 3 }}
                transition={{ duration: 0.2 }}
              >
                →
              </motion.span>
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
