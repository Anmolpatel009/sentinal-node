"use client";
import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, ShieldCheck, Zap, Link as LinkIcon, AlertCircle } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  const [currentCount, setCurrentCount] = useState(0);
  const [status, setStatus] = useState("Waiting for URL");
  const [mounted, setMounted] = useState(false);
  const [wsUrl, setWsUrl] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const connectToSentinel = () => {
    if (!wsUrl) return;
    
    // Cleanup existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }

    setStatus("Connecting...");
    
    // Ensure protocol is wss:// for Codespaces
    const formattedUrl = wsUrl.startsWith('http') 
      ? wsUrl.replace('http', 'ws') 
      : wsUrl;

    const socket = new WebSocket(formattedUrl.endsWith('/ws') ? formattedUrl : `${formattedUrl}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("Sentinel Active");
      console.log("Connected to Kernel Agent");
    };

    socket.onclose = () => {
      setStatus("Disconnected");
    };

    socket.onerror = () => {
      setStatus("Connection Error");
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setCurrentCount(msg.packets);
        
        setData((prev) => {
          const newData = [...prev, { 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
            packets: msg.packets 
          }];
          return newData.slice(-30); // Show last 30 seconds
        });
      } catch (e) {
        console.error("Data Parse Error", e);
      }
    };
  };

  if (!mounted) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-zinc-800 pb-8 gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter flex items-center gap-3 italic">
            <ShieldCheck className="text-emerald-500 w-10 h-10" />
            SENTINEL-NODE
          </h1>
          <p className="text-zinc-500 font-medium tracking-wide ml-1">SYSTEM ARCHITECTURE: PHASE 1 (PULSE)</p>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Paste Port 8080 URL here..."
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm w-full md:w-64 focus:outline-none focus:border-emerald-500 transition-all"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
            />
            <button 
              onClick={connectToSentinel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
              <LinkIcon size={16} /> Connect
            </button>
          </div>
          <div className="flex items-center gap-2 justify-end">
             <div className={`w-2 h-2 rounded-full ${status === "Sentinel Active" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{status}</span>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metric Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl backdrop-blur-sm shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Kernel Packet Count</h2>
            <Activity className="text-emerald-500 w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-7xl font-mono font-black text-white tracking-tighter">
              {currentCount.toLocaleString()}
            </span>
            <span className="text-zinc-500 text-sm mt-4 flex items-center gap-2">
                <AlertCircle size={14} className="text-emerald-500" />
                Live XDP_PASS Telemetry
            </span>
          </div>
        </div>

        {/* Visualizer Card */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl backdrop-blur-sm shadow-2xl">
           <h2 className="text-zinc-500 font-bold uppercase tracking-widest text-xs mb-8 flex items-center gap-2">
            <Zap className="text-yellow-500 w-4 h-4" /> Live Network Throughput
          </h2>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis 
                    stroke="#52525b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => val.toLocaleString()}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                  cursor={{ stroke: '#3f3f46' }}
                />
                <Line 
                  type="stepAfter" 
                  dataKey="packets" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={false}
                  animationDuration={0}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}