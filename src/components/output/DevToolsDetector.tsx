'use client';

import { useEffect, useRef } from 'react';

interface DevToolsDetectorProps {
  onOpen: () => void;
  onClose: () => void;
}

/**
 * DevToolsDetector monitors for browser DevTools being open using two heuristics:
 * 1. Resize heuristic: window.outerWidth - window.innerWidth > 160 (or height equivalent)
 * 2. Debugger timing: execution time >100ms indicates DevTools open with breakpoints
 *
 * Fires onOpen/onClose callbacks on state changes. Renders nothing (detection-only component).
 */
export function DevToolsDetector({ onOpen, onClose }: DevToolsDetectorProps) {
  const isOpenRef = useRef(false);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  // Keep callback refs in sync to avoid stale closures
  useEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  }, [onOpen, onClose]);

  useEffect(() => {
    function checkResizeHeuristic(): boolean {
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;
      return widthDelta > 160 || heightDelta > 160;
    }

    function checkDebuggerTiming(): boolean {
      const start = performance.now();
      // The debugger statement pauses execution when DevTools is open
      // eslint-disable-next-line no-debugger
      debugger;
      const elapsed = performance.now() - start;
      return elapsed > 100;
    }

    function detect() {
      const resizeDetected = checkResizeHeuristic();
      const debuggerDetected = checkDebuggerTiming();
      const detected = resizeDetected || debuggerDetected;

      if (detected && !isOpenRef.current) {
        isOpenRef.current = true;
        onOpenRef.current();
      } else if (!detected && isOpenRef.current) {
        isOpenRef.current = false;
        onCloseRef.current();
      }
    }

    const intervalId = setInterval(detect, 1000);

    // Run an initial check immediately
    detect();

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return null;
}
