"use client";

import { useState, useCallback } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface SatisfactionControlsProps {
  onSatisfy: () => Promise<void>;
  onDissatisfy: () => Promise<void>;
  isWalletConnected: boolean;
  disabled?: boolean;
}

const DISSATISFY_TIMEOUT_MS = 30_000;

export function SatisfactionControls({
  onSatisfy,
  onDissatisfy,
  isWalletConnected,
  disabled = false,
}: SatisfactionControlsProps) {
  const [isSatisfying, setIsSatisfying] = useState(false);
  const [isDissatisfying, setIsDissatisfying] = useState(false);

  const handleSatisfy = useCallback(async () => {
    if (!isWalletConnected) {
      toast.error("Please connect your wallet to confirm satisfaction.");
      return;
    }

    setIsSatisfying(true);
    try {
      await onSatisfy();
    } catch (error: any) {
      toast.error(
        error?.message || "Payment release failed. Please try again."
      );
      setIsSatisfying(false);
    }
  }, [isWalletConnected, onSatisfy]);

  const handleDissatisfy = useCallback(async () => {
    if (!isWalletConnected) {
      toast.error("Please connect your wallet to submit dissatisfaction.");
      return;
    }

    setIsDissatisfying(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timed out after 30 seconds.")),
          DISSATISFY_TIMEOUT_MS
        )
      );
      await Promise.race([onDissatisfy(), timeoutPromise]);
    } catch (error: any) {
      toast.error(
        error?.message || "Refund could not be processed. Please try again."
      );
      setIsDissatisfying(false);
    }
  }, [isWalletConnected, onDissatisfy]);

  const bothDisabled = disabled || isDissatisfying;

  return (
    <div className="flex items-center gap-4">
      {/* Satisfaction Button */}
      <button
        onClick={handleSatisfy}
        disabled={bothDisabled || isSatisfying}
        className={cn(
          "min-w-[44px] min-h-[44px] px-6 py-3 rounded-lg",
          "inline-flex items-center justify-center gap-2",
          "font-semibold uppercase tracking-wider text-xs",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-2 focus:ring-offset-dojo-bg",
          "disabled:opacity-40 disabled:pointer-events-none",
          "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
        )}
      >
        {isSatisfying ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Check size={16} />
            <span>Satisfied</span>
          </>
        )}
      </button>

      {/* Dissatisfaction Button */}
      <button
        onClick={handleDissatisfy}
        disabled={bothDisabled || isSatisfying}
        className={cn(
          "min-w-[44px] min-h-[44px] px-6 py-3 rounded-lg",
          "inline-flex items-center justify-center gap-2",
          "font-semibold uppercase tracking-wider text-xs",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:ring-offset-2 focus:ring-offset-dojo-bg",
          "disabled:opacity-40 disabled:pointer-events-none",
          "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]"
        )}
      >
        {isDissatisfying ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <X size={16} />
            <span>Not Satisfied</span>
          </>
        )}
      </button>
    </div>
  );
}
