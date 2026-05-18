"use client";

import { useLiveFeed } from "@/hooks/useLiveFeed";
import { formatAlgoDisplay } from "@/lib/utils/format";
import { motion, AnimatePresence } from "framer-motion";
import { Scroll, Activity, Circle } from "lucide-react";
import { LaneBadge } from "./LaneBadge";
import { cn } from "@/lib/utils";

export function LiveFeed() {
  const { earnings, isConnected } = useLiveFeed();

  return (
    <div className="flex flex-col h-full bg-background border-x border-black/[0.06] relative group overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-surface-elevated border-b border-black/[0.06] z-10">
        <div className="flex items-center gap-3">
          <Activity size={18} className="text-accent" />
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">Live Stream</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
          <Circle size={6} className="fill-accent text-accent animate-pulse" />
          <span className="text-[9px] font-semibold text-accent uppercase tracking-widest">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {earnings.map((event: any, i: number) => (
            <motion.div
              key={event.id || i}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-4 bg-surface rounded-xl border border-black/[0.06] hover:border-accent/30 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-xs text-foreground uppercase tracking-tight">
                    {event.type.replace('_', ' ')}
                  </p>
                  <p className="text-[9px] text-muted font-mono truncate w-32 mt-1 uppercase tracking-widest">
                    {event.address || event.txId || 'System Node'}
                  </p>
                </div>
                {event.lane && (
                  <LaneBadge lane={event.lane.toLowerCase()} className="transform scale-[0.65] origin-right !px-2" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <p className="text-[9px] text-muted font-semibold uppercase tracking-widest">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
