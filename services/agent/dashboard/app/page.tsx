"use client";

import React, { useState, useEffect, useRef } from "react";
import { Activity, Shield, Zap, Globe, Lock, AlertCircle } from "lucide-react";

// --- Utility: Safe WebSocket URL Construction ---
const getWsUrl = (inputUrl: string) => {
  if (!inputUrl) return "";
  let processed = inputUrl.trim();
  if (!processed.startsWith("http") && !processed.startsWith("ws")) {
    processed = `http://${processed}`;
  }
  try {
    const url = new URL(processed);
    // Force WSS if the dashboard is running on HTTPS (Codespaces reality)
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    url.protocol = isHttps ? "wss:" : "ws:";
    
    if (!url.pathname.endsWith("/ws")) {
      url.pathname = url.pathname.replace(/\/$/, "") + "/ws";
    }
    return url.toString();
  } catch (e) {
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const cleanHost = inputUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `${protocol}//${cleanHost}/ws`;
  }
};

export default function Home() {
  const [wsUrl, setWsUrl] = useState("localhost:8080");
  const [status, setStatus] = useState("Disconnected");
  const [metrics, setMetrics] = useState({
    total: 0,
    tcp: 0,
    udp: 0,
    icmp: 0,
  });
  
  const socketRef = useRef<WebSocket | null>(null);

  // Clean up connection on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const connectToSentinel = () => {
    if (socketRef.current) socketRef.current.close();

    const formattedUrl = getWsUrl(wsUrl);
    setStatus("Connecting...");

    try {
      const socket = new WebSocket(formattedUrl);
      socketRef.current = socket;

      socket.onopen = () => setStatus("Sentinel Active");
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Phase 2 Payload check
          if (data.metrics) {
            setMetrics(data.metrics);
          }
        } catch (err) {
          console.error("Failed to parse Sentinel payload", err);
        }
      };

      socket.onclose = () => setStatus("Disconnected");
      socket.onerror = () => setStatus("Connection Error");
    } catch (err) {
      setStatus("Setup Failed");
    }
  };

  return (
    <main className="min-h-screen bg-black text-slate-200 p-8 font-sans">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-12 flex justify-between items-end border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-white flex items-center gap-3">
            <Shield className="w-12 h-12 text-blue-500" /> SENTINEL <span className="text-blue-500 text-xl font-mono">NODE</span>
          </h1>
          <p className="text-slate-500 font-mono mt-2 uppercase tracking-widest text-xs">
            Phase 2: Protocol Dissector & Kernel Telemetry
          </p>
        </div>
        
        <div className="flex gap-2">
          <input 
            type="text" 
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            className="bg-slate-900 border border-slate-700 px-4 py-2 rounded font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button 
            onClick={connectToSentinel}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold transition-all uppercase text-sm"
          >
            Connect
          </button>
        </div>
      </div>

      {/* Grid Section */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Packets" value={metrics.total} icon={<Activity className="text-blue-400" />} />
        <StatCard label="TCP Segments" value={metrics.tcp} icon={<Zap className="text-yellow-400" />} />
        <StatCard label="UDP Datagrams" value={metrics.udp} icon={<Globe className="text-purple-400" />} />
        <StatCard label="ICMP (Ping)" value={metrics.icmp} icon={<Lock className="text-green-400" />} />
      </div>

      {/* Status Footer */}
      <div className="max-w-6xl mx-auto mt-12 flex items-center gap-4 bg-slate-900/50 p-4 rounded border border-slate-800">
        <div className={`w-3 h-3 rounded-full animate-pulse ${status === "Sentinel Active" ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="font-mono text-xs uppercase tracking-widest">{status}</span>
        <span className="text-slate-700 ml-auto font-mono text-[10px]">XDP_PROG_TYPE_SENTINEL_PULSE</span>
      </div>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg hover:border-slate-600 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-slate-500 font-mono text-xs uppercase tracking-wider">{label}</span>
        <div className="opacity-50 group-hover:opacity-100 transition-opacity">
          {icon}
        </div>
      </div>
      {/* REALITY CHECK: Defensive value handling with fallback to 0 */}
      <p className="text-4xl font-mono font-black text-white tracking-tighter">
        {(value ?? 0).toLocaleString()}
      </p>
    </div>
  );
}