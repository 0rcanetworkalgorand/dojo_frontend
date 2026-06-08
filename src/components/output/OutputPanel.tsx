"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "react-hot-toast";
import { Download, Loader2, AlertTriangle } from "lucide-react";

import { useContentGuard } from "@/hooks/useContentGuard";
import { WatermarkOverlay } from "./WatermarkOverlay";
import { DevToolsDetector } from "./DevToolsDetector";
import { SatisfactionControls } from "./SatisfactionControls";
import { splitContent } from "@/lib/utils/contentSplitter";
import {
  generateMarkdownFile,
  triggerDownload,
  buildFilename,
} from "@/lib/utils/downloadGenerator";
import { Task, TaskState, TaskOutput } from "@/lib/types";
import { cn } from "@/lib/utils";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://dojo-backend-yutl.onrender.com";

interface OutputPanelProps {
  task: Task;
  clientAddress: string;
}

export function OutputPanel({ task, clientAddress }: OutputPanelProps) {
  // --- State ---
  const [output, setOutput] = useState<TaskOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [contentRemoved, setContentRemoved] = useState(false);

  // Track whether we're in a satisfaction/dissatisfaction flow
  const [isSatisfying, setIsSatisfying] = useState(false);
  const [isDissatisfying, setIsDissatisfying] = useState(false);

  // Content guard for protection lifecycle
  const isProtectedState =
    task.state === TaskState.SUBMITTED && !contentRemoved;
  const { state: guardState, containerRef, unlock } = useContentGuard(isProtectedState);

  // Refs for timers
  const visibilityShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Fetch task output ---
  useEffect(() => {
    if (task.state !== TaskState.SUBMITTED && task.state !== TaskState.SETTLED) {
      return;
    }

    let cancelled = false;

    async function fetchOutput() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/tasks/${task.id}/output`);
        if (!res.ok) {
          throw new Error(`Failed to load output (${res.status})`);
        }
        const data: TaskOutput = await res.json();
        if (!cancelled) {
          if (!data.content || data.content.trim().length === 0) {
            setError("No output is available for this task.");
            setOutput(null);
          } else {
            setOutput(data);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load task output.");
          setOutput(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchOutput();
    return () => {
      cancelled = true;
    };
  }, [task.id, task.state]);

  // --- Visibility change handling ---
  useEffect(() => {
    if (task.state !== TaskState.SUBMITTED) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        // Show overlay within 100ms
        if (visibilityHideTimer.current) {
          clearTimeout(visibilityHideTimer.current);
          visibilityHideTimer.current = null;
        }
        visibilityShowTimer.current = setTimeout(() => {
          setIsTabHidden(true);
        }, 0); // Immediate, well within 100ms
      } else {
        // Remove overlay within 200ms
        if (visibilityShowTimer.current) {
          clearTimeout(visibilityShowTimer.current);
          visibilityShowTimer.current = null;
        }
        visibilityHideTimer.current = setTimeout(() => {
          setIsTabHidden(false);
        }, 100); // Within 200ms
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (visibilityShowTimer.current) clearTimeout(visibilityShowTimer.current);
      if (visibilityHideTimer.current) clearTimeout(visibilityHideTimer.current);
    };
  }, [task.state]);

  // --- DevTools handlers ---
  const handleDevToolsOpen = useCallback(() => {
    setIsDevToolsOpen(true);
  }, []);

  const handleDevToolsClose = useCallback(() => {
    setIsDevToolsOpen(false);
  }, []);

  // --- Satisfaction flow ---
  const handleSatisfy = useCallback(async () => {
    if (!output) return;

    setIsSatisfying(true);
    try {
      // 1. Unlock content guard
      unlock();

      // 2. Generate markdown file
      const blob = generateMarkdownFile({
        taskId: task.id,
        taskTitle: task.title || "task-output",
        content: output.content,
        lane: task.lane,
        agentAddress: output.agentAddress,
        completionDate: output.submittedAt,
      });

      if (!blob) {
        throw new Error("Failed to generate download file.");
      }

      // 3. Trigger download
      const filename = buildFilename(task.id, task.title || "task-output");
      triggerDownload(blob, filename);

      // 4. Call releaseTaskPayment API
      const res = await fetch(`${API_URL}/api/tasks/${task.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerAddress: clientAddress }),
      });

      if (!res.ok) {
        throw new Error("Payment release failed. Please try again.");
      }

      toast.success("Payment released successfully!");
    } catch (err: any) {
      // Re-throw so SatisfactionControls can handle the error display
      // Note: Content Guard removal and download are NOT rolled back per Req 4.6
      throw err;
    } finally {
      setIsSatisfying(false);
    }
  }, [output, task, clientAddress, unlock]);

  // --- Dissatisfaction flow ---
  const handleDissatisfy = useCallback(async () => {
    setIsDissatisfying(true);
    try {
      const res = await fetch(`${API_URL}/api/tasks/${task.id}/slash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerAddress: clientAddress }),
      });

      if (!res.ok) {
        throw new Error("Refund could not be processed. Please try again.");
      }

      // On success, remove content from DOM
      toast.success("Refund initiated successfully.");
      setContentRemoved(true);
      setOutput(null);
    } catch (err: any) {
      throw err;
    } finally {
      setIsDissatisfying(false);
    }
  }, [task.id, clientAddress]);

  // --- Re-download for SETTLED state ---
  const handleRedownload = useCallback(() => {
    if (!output) {
      toast.error("Output is temporarily unavailable.");
      return;
    }

    const blob = generateMarkdownFile({
      taskId: task.id,
      taskTitle: task.title || "task-output",
      content: output.content,
      lane: task.lane,
      agentAddress: output.agentAddress,
      completionDate: output.submittedAt,
    });

    if (!blob) {
      toast.error("Failed to generate download file.");
      return;
    }

    const filename = buildFilename(task.id, task.title || "task-output");
    triggerDownload(blob, filename);
  }, [output, task]);

  // --- Content splitting for DOM obfuscation ---
  const splitSegments = useMemo(() => {
    if (!output?.content || task.state !== TaskState.SUBMITTED || contentRemoved) {
      return null;
    }
    return splitContent(output.content);
  }, [output?.content, task.state, contentRemoved]);

  // --- Render based on task state ---

  // CREATED or LOCKED: render nothing
  if (task.state === TaskState.CREATED || task.state === TaskState.LOCKED) {
    return null;
  }

  // SLASHED: show refund message
  if (task.state === TaskState.SLASHED) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 text-red-400" size={32} />
        <h3 className="text-lg font-semibold text-red-300 mb-1">
          Task Refunded
        </h3>
        <p className="text-sm text-red-400/80">
          This task was refunded. No output is available.
        </p>
      </div>
    );
  }

  // SETTLED: show unlocked view with re-download
  if (task.state === TaskState.SETTLED) {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
          <span className="ml-2 text-gray-400">Loading output...</span>
        </div>
      );
    }

    if (error || !output) {
      return (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 text-yellow-400" size={32} />
          <p className="text-sm text-yellow-300">
            {error || "Output is temporarily unavailable."}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-emerald-500/20 bg-gray-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">Task Output</h3>
          <button
            onClick={handleRedownload}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-emerald-600 text-white text-sm font-medium",
              "hover:bg-emerald-700 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            )}
          >
            <Download size={16} />
            Re-download
          </button>
        </div>
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown>{output.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // SUBMITTED: protected view
  if (task.state === TaskState.SUBMITTED) {
    // Content removed after dissatisfaction
    if (contentRemoved) {
      return (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-300 mb-1">
            Refund Initiated
          </h3>
          <p className="text-sm text-yellow-400/80">
            The refund has been initiated. Content has been removed.
          </p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
          <span className="ml-2 text-gray-400">Loading output...</span>
        </div>
      );
    }

    // Empty output or load failure: show message without protected view
    if (error || !output) {
      return (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 text-yellow-400" size={32} />
          <p className="text-sm text-yellow-300">
            {error || "No output is available for this task."}
          </p>
        </div>
      );
    }

    // Content guard failed to initialize: withhold content
    if (guardState.isProtected && !guardState.isInitialized && !guardState.error) {
      // Still initializing, show loading
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
          <span className="ml-2 text-gray-400">
            Initializing content protection...
          </span>
        </div>
      );
    }

    if (guardState.error) {
      // Protection failed to attach: withhold content (Req 2.6)
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-sm text-red-300">
            Content protection could not be initialized. Output is withheld for
            security.
          </p>
        </div>
      );
    }

    return (
      <div className="relative rounded-lg border border-gray-700 bg-gray-900/80 overflow-hidden">
        {/* Protection banner (Req 1.4) */}
        <div className="bg-amber-900/30 border-b border-amber-600/30 px-4 py-2">
          <p className="text-xs text-amber-300 font-medium text-center">
            This content is copy-protected until you confirm satisfaction
          </p>
        </div>

        {/* Satisfaction controls */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-700/50">
          <SatisfactionControls
            onSatisfy={handleSatisfy}
            onDissatisfy={handleDissatisfy}
            isWalletConnected={!!clientAddress}
            disabled={isSatisfying || isDissatisfying}
          />
        </div>

        {/* Protected content container */}
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          className="relative p-6"
          style={{
            // Screenshot deterrence: sub-pixel rendering (Req 3.1)
            WebkitFontSmoothing: "subpixel-antialiased",
            MozOsxFontSmoothing: "auto",
          }}
        >
          {/* Watermark overlay (Req 3.2) */}
          <WatermarkOverlay
            clientAddress={clientAddress}
            timestamp={new Date().toISOString()}
          />

          {/* DOM-obfuscated content rendered through content splitter */}
          <div className="prose prose-invert max-w-none relative z-0">
            {splitSegments &&
              splitSegments.segments.map((segment, index) => (
                <div
                  key={index}
                  dangerouslySetInnerHTML={{ __html: segment }}
                />
              ))}
          </div>
        </div>

        {/* DevTools detector (Req 8.3) */}
        <DevToolsDetector
          onOpen={handleDevToolsOpen}
          onClose={handleDevToolsClose}
        />

        {/* DevTools warning overlay */}
        {isDevToolsOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/95">
            <div className="text-center p-8">
              <AlertTriangle className="mx-auto mb-4 text-red-400" size={48} />
              <h3 className="text-xl font-bold text-red-300 mb-2">
                Developer Tools Detected
              </h3>
              <p className="text-sm text-gray-400 max-w-sm">
                Developer tools access is restricted while viewing protected
                content. Please close DevTools to continue.
              </p>
            </div>
          </div>
        )}

        {/* Visibility change overlay (Req 3.3, 3.4) */}
        {isTabHidden && (
          <div className="absolute inset-0 z-40 bg-gray-950" aria-hidden="true" />
        )}
      </div>
    );
  }

  // Fallback for any other state (e.g. VERIFIED)
  return null;
}
