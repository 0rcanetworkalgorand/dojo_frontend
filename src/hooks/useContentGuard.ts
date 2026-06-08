"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ContentGuardState {
  isProtected: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface UseContentGuardReturn {
  state: ContentGuardState;
  containerRef: React.RefObject<HTMLDivElement>;
  unlock: () => void;
}

const GUARDED_EVENTS: (keyof HTMLElementEventMap)[] = [
  "copy",
  "cut",
  "paste",
  "contextmenu",
  "dragstart",
  "selectstart",
];

/**
 * Hook that applies content protection to a container element.
 *
 * When `enabled` is true, attaches event listeners that prevent copy, cut, paste,
 * context menu, drag-start, and select-start. Also applies `user-select: none`
 * on the container.
 *
 * Provides an `unlock()` function to remove all protections and re-enable interaction.
 *
 * If the container ref is null after mount (listener attachment fails), sets
 * `isInitialized: false` so the consuming component can withhold content rendering.
 */
export function useContentGuard(enabled: boolean): UseContentGuardReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const listenersAttached = useRef(false);

  const [state, setState] = useState<ContentGuardState>({
    isProtected: enabled,
    isInitialized: false,
    error: null,
  });

  const preventDefault = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  const attachListeners = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      setState((prev) => ({
        ...prev,
        isInitialized: false,
        error: "Container element not available for protection attachment",
      }));
      return false;
    }

    try {
      for (const event of GUARDED_EVENTS) {
        el.addEventListener(event, preventDefault, { capture: true });
      }
      el.style.userSelect = "none";
      el.style.webkitUserSelect = "none";
      listenersAttached.current = true;

      setState({
        isProtected: true,
        isInitialized: true,
        error: null,
      });
      return true;
    } catch (err) {
      setState({
        isProtected: false,
        isInitialized: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to attach content guard listeners",
      });
      return false;
    }
  }, [preventDefault]);

  const removeListeners = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    for (const event of GUARDED_EVENTS) {
      el.removeEventListener(event, preventDefault, { capture: true });
    }
    el.style.userSelect = "";
    el.style.webkitUserSelect = "";
    listenersAttached.current = false;
  }, [preventDefault]);

  const unlock = useCallback(() => {
    removeListeners();
    setState({
      isProtected: false,
      isInitialized: true,
      error: null,
    });
  }, [removeListeners]);

  // Attach or detach listeners when `enabled` changes
  useEffect(() => {
    if (enabled) {
      attachListeners();
    } else {
      removeListeners();
      setState((prev) => ({
        ...prev,
        isProtected: false,
      }));
    }

    return () => {
      // Clean up listeners on unmount
      if (listenersAttached.current) {
        removeListeners();
      }
    };
  }, [enabled, attachListeners, removeListeners]);

  return {
    state,
    containerRef,
    unlock,
  };
}
