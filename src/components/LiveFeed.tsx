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
    <div className="flex flex-col h-full bg-[#FAF9F5] border-x border-gray-100 relative group">
      {/* Top Roller */}
      <div className="h-4 bg-[#DCD9D0] rounded-b-sm shadow-inner mx-4 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/5" />
      </div>

      <div className="flex items-center justify-between px-6 py-4 bg-white/50 border-b border-gray-100 z-10">
        <div className="flex items-center gap-2">
          <Scroll size={18} className="text-dojo-teal/70" />
          <h3 className="font-heading font-semibold text-dojo-heading">Live Stream</h3>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-dojo-success/10 border border-dojo-success/20">
          <Circle size={8} className="fill-dojo-success text-dojo-success animate-pulse" />
          <span className="text-[10px] font-bold text-dojo-success uppercase tracking-wider">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto japanese-scroll px-6 py-4 space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
          {earnings.map((event: any, i: number) => (
            <motion.div
              key={event.id || i}
              layout
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className="p-4 bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-heading font-semibold text-sm text-dojo-heading leading-tight">
                    {event.type.replace('_', ' ')}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium truncate w-32 mt-1">
                    {event.address || event.txId || 'System'}
                  </p>
                </div>
                {event.lane && (
                  <LaneBadge lane={event.lane.toLowerCase()} className="transform scale-75 origin-right" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-dojo-teal" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Roller */}
      <div className="h-4 bg-[#DCD9D0] rounded-t-sm shadow-inner mx-4 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/5" />
      </div>
    </div>
  );
}
