"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Navigation } from "@/components/Navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { OutputPanel } from "@/components/output/OutputPanel";
import { Task, TaskState } from "@/lib/types";
import { SwarmParticles } from "@/components/SwarmParticles";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://dojo-backend-yutl.onrender.com";

const STATE_LABELS: Record<TaskState, { label: string; color: string }> = {
  [TaskState.CREATED]: { label: "CREATED", color: "text-gray-400 bg-gray-400/10 border-gray-400/20" },
  [TaskState.LOCKED]: { label: "LOCKED", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  [TaskState.SUBMITTED]: { label: "SUBMITTED", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  [TaskState.VERIFIED]: { label: "VERIFIED", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  [TaskState.SETTLED]: { label: "SETTLED", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  [TaskState.SLASHED]: { label: "SLASHED", color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const { activeAddress } = useWallet();
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !isAuthenticated) return;

    async function fetchTask() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/tasks/${taskId}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Task not found" : "Failed to load task");
        }
        const data: Task = await res.json();
        setTask(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load task");
        setTask(null);
      } finally {
        setLoading(false);
      }
    }

    fetchTask();
  }, [taskId, isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-dojo-bg relative overflow-hidden">
        <SwarmParticles className="opacity-30" />
        <Navigation />
        <main className="relative z-10 max-w-4xl mx-auto px-6 sm:px-12 pt-24">
          <div className="dojo-card p-12 text-center">
            <h1 className="text-2xl font-black text-foreground uppercase tracking-tighter mb-4">
              Task Not Found
            </h1>
            <p className="text-muted text-sm uppercase tracking-widest">
              {error || "The requested task does not exist or could not be loaded."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const stateInfo = STATE_LABELS[task.state] || STATE_LABELS[TaskState.CREATED];
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const bountyDisplay = task.bountyUsdc
    ? `$${(parseInt(task.bountyUsdc) / 1_000_000).toFixed(2)}`
    : "—";

  return (
    <div className="min-h-screen bg-dojo-bg relative overflow-hidden">
      <SwarmParticles className="opacity-30" />
      <Navigation />

      <main className="relative z-10 max-w-4xl mx-auto px-6 sm:px-12 pt-24 pb-20">
        {/* Task Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-black text-dojo-teal uppercase tracking-[0.3em]">
              Mission Details
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${stateInfo.color}`}
            >
              {stateInfo.label}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase tracking-tighter leading-none mb-4">
            {task.title || "Untitled Task"}
          </h1>
          {task.description && (
            <p className="text-muted text-sm leading-relaxed max-w-2xl">
              {task.description}
            </p>
          )}
        </div>

        {/* Task Metadata */}
        <div className="dojo-card p-8 mb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <span className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2">
                Lane
              </span>
              <span className="text-sm font-black text-foreground uppercase tracking-tighter">
                {task.lane}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2">
                Bounty
              </span>
              <span className="text-sm font-black text-foreground tracking-tighter">
                {bountyDisplay}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2">
                Deadline
              </span>
              <span className="text-sm font-black text-foreground tracking-tighter">
                {deadlineDate ? deadlineDate.toLocaleDateString() : "—"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2">
                State
              </span>
              <span className="text-sm font-black text-foreground uppercase tracking-tighter">
                {task.state}
              </span>
            </div>
          </div>
        </div>

        {/* Output Panel - renders conditionally based on task state */}
        <OutputPanel task={task} clientAddress={activeAddress || ""} />
      </main>
    </div>
  );
}
