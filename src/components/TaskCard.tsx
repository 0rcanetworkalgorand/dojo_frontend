'use client';

import React from 'react';
import { TaskState, LaneType, Task } from '@/lib/types';
import { BeakerIcon, CodeBracketIcon, CircleStackIcon, EnvelopeIcon, ClockIcon, UserIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatAlgoDisplay } from '@/lib/utils/format';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';


interface TaskCardProps {
  task: Task;
  onPayWinner?: (taskId: string, workerAddress: string, amount: string) => void;
  isClient?: boolean;
}

const LANE_MAP = {
  RESEARCH: { name: 'Research', icon: BeakerIcon, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  CODE: { name: 'Code', icon: CodeBracketIcon, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  DATA: { name: 'Data', icon: CircleStackIcon, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  OUTREACH: { name: 'Outreach', icon: EnvelopeIcon, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

const STATE_MAPPING = {
  CREATED: { label: 'Auction Live', color: 'text-blue-500', bg: 'bg-blue-400/10' },
  LOCKED: { label: 'In Progress', color: 'text-amber-500', bg: 'bg-amber-400/10' },
  SETTLED: { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-400/10' },
  SLASHED: { label: 'Slashed', color: 'text-red-500', bg: 'bg-red-400/10' },
  SUBMITTED: { label: 'Reviewing', color: 'text-indigo-500', bg: 'bg-indigo-400/10' },
  VERIFIED: { label: 'Verified', color: 'text-purple-500', bg: 'bg-purple-400/10' },
};

export default function TaskCard({ task, onPayWinner, isClient }: TaskCardProps) {
  const laneInfo = LANE_MAP[task.lane] || LANE_MAP.RESEARCH;
  const Icon = laneInfo.icon;
  const stateInfo = STATE_MAPPING[task.state] || { label: task.state, color: 'text-slate-500', bg: 'bg-slate-400/10' };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "card p-8 flex flex-col relative group",
        laneInfo.border.replace('border-', 'border-')
      )}
    >
      <div className="flex justify-between items-start mb-8">
        <div className={cn(
          "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
          laneInfo.bg.replace('/10', '/5'),
          laneInfo.color,
          laneInfo.border
        )}>
          <Icon className="w-3.5 h-3.5" />
          {laneInfo.name}
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-black/[0.03] border border-black/[0.06]",
          stateInfo.color
        )}>
          {stateInfo.label}
        </div>
      </div>

      <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter mb-4 group-hover:text-accent transition-colors line-clamp-1">
        {task.title || `MISSION ${task.id.slice(0, 8)}`}
      </h3>
      
      <p className="text-muted text-sm font-medium leading-relaxed mb-8 line-clamp-2 min-h-[44px]">
        {task.description || 'No specialized metadata provided.'}
      </p>

      <div className="grid grid-cols-2 gap-6 mb-10">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-black tracking-widest text-muted flex items-center gap-2">
            <CurrencyDollarIcon className="w-3 h-3 opacity-50" /> Bounty
          </p>
          <p className="text-lg font-bold text-dojo-gold tracking-tight">{formatAlgoDisplay(Number(task.bountyUsdc))}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-black tracking-widest text-muted flex items-center gap-2">
            <ClockIcon className="w-3 h-3 opacity-50" /> Deadline
          </p>
          <p className="text-lg font-bold text-muted tracking-tight">
            {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-black/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black/[0.03] border border-black/[0.06] flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-muted" />
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] text-muted uppercase font-black tracking-widest">Client</span>
                <span className="text-xs font-mono text-muted">{task.clientAddress.slice(0, 6)}...</span>
            </div>
        </div>

        {task.workerAddress && (
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-accent" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] text-muted uppercase font-black tracking-widest">Worker</span>
                    <span className="text-xs font-mono text-muted">{task.workerAddress.slice(0, 6)}...</span>
                </div>
            </div>
        )}

        {isClient && task.state === 'SETTLED' && !(task as any).paidOut && (
            <button
                onClick={() => onPayWinner?.(task.id, task.workerAddress!, task.bountyUsdc.toString())}
                className="px-6 py-3 bg-dojo-teal text-black rounded text-sm font-black uppercase tracking-widest uppercase hover:scale-105 transition-all"
            >
                PAY WINNER
            </button>
        )}
      </div>
    </motion.div>
  );
}
