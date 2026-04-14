"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useLiveFeed() {
  const [events, setEvents] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(API_URL);
    
    socket.on("connect", () => {
      setIsConnected(true);
      console.log("[SocketIO] Connected to Dojo Backend");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("[SocketIO] Disconnected from Dojo Backend");
    });

    socket.onAny((eventName, payload) => {
      console.log(`[SocketIO] Event: ${eventName}`, payload);
      setEvents((prev) => [
        { ...payload, type: eventName }, 
        ...prev
      ].slice(0, 20));
    });

    socket.on("connect_error", (err) => {
      console.warn("[SocketIO] Connection attempt failed, retrying...", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { earnings: events, isConnected };
}
