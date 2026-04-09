"use client";

import { useEffect, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";

export function useLiveFeed() {
  const [events, setEvents] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("[WS] Connected to Dojo Backend");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "EVENT") {
          setEvents((prev) => [data.payload, ...prev].slice(0, 20));
        }
      } catch (e) {
        console.error("[WS] Parse Error", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("[WS] Disconnected from Dojo Backend");
    };

    ws.onerror = (err) => {
      console.error("[WS] Error", err);
    };

    return () => {
      ws.close();
    };
  }, []);

  return { earnings: events, isConnected };
}
