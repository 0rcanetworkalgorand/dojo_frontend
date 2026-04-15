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
    <div className="flex flex-col h-full bg-dojo-bg border-x border-white/[0.05] relative group overflow-hidden">
      <div className="flex items-center justify-between px-8 py-6 bg-white/[0.02] border-b border-white/[0.05] z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Activity size={18} className="text-dojo-teal" />
          <h3 className="font-black text-xs text-white uppercase tracking-[0.2em]">Live Stream</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-dojo-success/10 border border-dojo-success/20">
          <Circle size={6} className="fill-dojo-success text-dojo-success animate-pulse shadow-[0_0_8px_rgba(0,245,212,0.5)]" />
          <span className="text-[9px] font-black text-dojo-success uppercase tracking-widest">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto japanese-scroll px-6 py-6 space-y-6">
        <AnimatePresence initial={false} mode="popLayout">
          {earnings.map((event: any, i: number) => (
            <motion.div
              key={event.id || i}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-5 bg-white/[0.02] rounded-2xl border border-white/[0.05] hover:border-dojo-teal/30 hover:bg-white/[0.05] transition-all duration-300 group/feed"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-xs text-white uppercase tracking-tight leading-tight group-hover/feed:text-dojo-teal transition-colors">
                    {event.type.replace('_', ' ')}
                  </p>
                  <p className="text-[9px] text-white/30 font-mono truncate w-32 mt-1.5 uppercase tracking-widest leading-none">
                    {event.address || event.txId || 'System Node'}
                  </p>
                </div>
                {event.lane && (
                  <LaneBadge lane={event.lane.toLowerCase()} className="transform scale-[0.65] origin-right !px-2" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-dojo-teal shadow-[0_0_4px_rgba(0,245,212,0.8)]" />
                <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">
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
