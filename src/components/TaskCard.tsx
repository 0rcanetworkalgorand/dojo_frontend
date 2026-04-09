'use client';

import React from 'react';
import { TaskState, LaneType, Task } from '@/lib/types';
import { BeakerIcon, CodeBracketIcon, CircleStackIcon, EnvelopeIcon, ClockIcon, UserIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatAlgoDisplay } from '@/lib/utils/format';


interface TaskCardProps {
  task: Task;
  onPayWinner?: (taskId: string, workerAddress: string, amount: string) => void;
  isClient?: boolean;
}

const LANE_MAP = {
  RESEARCH: { name: 'Research', icon: BeakerIcon, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  CODE: { name: 'Code', icon: CodeBracketIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  DATA: { name: 'Data', icon: CircleStackIcon, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  OUTREACH: { name: 'Outreach', icon: EnvelopeIcon, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

const STATE_MAPPING = {
  CREATED: { label: 'Auction Live', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  LOCKED: { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  SETTLED: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  SLASHED: { label: 'Slashed', color: 'text-red-400', bg: 'bg-red-400/10' },
  SUBMITTED: { label: 'Reviewing', color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  VERIFIED: { label: 'Verified', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

export default function TaskCard({ task, onPayWinner, isClient }: TaskCardProps) {
  const laneInfo = LANE_MAP[task.lane] || LANE_MAP.RESEARCH;
  const Icon = laneInfo.icon;
  const stateInfo = STATE_MAPPING[task.state] || { label: task.state, color: 'text-slate-400', bg: 'bg-slate-400/10' };

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${laneInfo.border} bg-white/5 backdrop-blur-md p-6 transition-all hover:bg-white/[0.08] group`}>
      {/* Background Glow */}
      <div className={`absolute -right-12 -top-12 w-32 h-32 blur-3xl opacity-10 rounded-full ${laneInfo.bg.replace('/10', '')}`} />

      <div className="flex justify-between items-start mb-4">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${laneInfo.bg} ${laneInfo.color} border ${laneInfo.border}`}>
          <Icon className="w-3 h-3" />
          {laneInfo.name}
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${stateInfo.bg} ${stateInfo.color}`}>
          {stateInfo.label}
        </div>
      </div>

      <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors line-clamp-1">
        {task.title || `Mission ${task.id.substring(0, 8)}`}
      </h3>
      
      <p className="text-slate-400 text-sm mb-6 line-clamp-2 min-h-[40px]">
        {task.description || 'No description provided.'}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-2 text-slate-300">
          <CurrencyDollarIcon className="w-4 h-4 text-slate-500" />
          <span className="text-lg font-mono font-bold">{formatAlgoDisplay(Number(task.bountyUsdc))}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <ClockIcon className="w-4 h-4" />
          <span>{new Date(task.deadline).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Client</span>
                <span className="text-xs font-mono text-slate-300">{task.clientAddress.substring(0, 6)}...</span>
            </div>
        </div>

        {task.state === TaskState.CREATED && task.workerAddress && onPayWinner && isClient && (
            <button
                onClick={() => onPayWinner(task.id, task.workerAddress!, task.bountyUsdc)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20"
            >
                Lock Bounty
            </button>
        )}

        {task.workerAddress && task.state !== TaskState.CREATED && (
            <div className="flex items-center gap-2 text-right">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Agent</span>
                    <span className="text-xs font-mono text-emerald-400">{task.workerAddress.substring(0, 6)}...</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
