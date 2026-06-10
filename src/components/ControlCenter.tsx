import React, { useState, useRef, useEffect } from "react";
import {
  Server,
  Cpu,
  Thermometer,
  Database,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Radio,
  Sparkles,
  Layers,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ControlCenterProps {
  // Network connection status
  networkOk: boolean;
  linkBrowserToNode: boolean;
  linkNodeToTunnel: boolean;
  linkTunnelToMac: boolean;

  // Active agent status
  activeAgentName: string;
  activeAgentEmoji?: string;
  activeAgentReady: boolean;

  // Hardware metrics
  cpuUsage: number;
  memoryUsage: number;
  temperature: number;
  uptime?: string;
}

export default function ControlCenter({
  networkOk = true,
  linkBrowserToNode = true,
  linkNodeToTunnel = true,
  linkTunnelToMac = true,
  activeAgentName = "Nexus 节点",
  activeAgentEmoji = "🧠",
  activeAgentReady = true,
  cpuUsage = 24,
  memoryUsage = 68,
  temperature = 42,
  uptime = "12天 4小时 14分钟",
}: ControlCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative font-sans" ref={containerRef}>
      {/* Delicate Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
          isOpen
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-150"
            : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-805 dark:hover:text-zinc-100"
        }`}
        aria-label="打开控制中心"
        title="打开控制中心"
      >
        <Radio className={`w-4 h-4 ${networkOk ? "text-emerald-500 animate-pulse" : "text-rose-500"}`} />
        
        {/* Connection status indicator dot */}
        <span className="absolute top-1 right-1 flex h-2 w-2">
          {networkOk && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${networkOk ? "bg-emerald-500" : "bg-rose-500"}`}></span>
        </span>
      </button>

      {/* Floating control center popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className="absolute right-0 top-full mt-2.5 w-80 bg-white/90 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden backdrop-blur-md text-left select-none"
          >
            {/* Header section */}
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Server className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider font-mono">
                  系统全局控制中心
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                aria-label="关闭密闭中心"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content area */}
            <div className="p-4 space-y-4">
              
              {/* Layer 1: Network flow metrics */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-blue-500" /> 网络链路拓扑
                  </span>
                  <span className={`text-[10px] font-semibold flex items-center gap-1 ${networkOk ? "text-emerald-600" : "text-rose-600"}`}>
                    {networkOk ? "🟢 整体在线" : "🔴 链路受阻"}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50/80 dark:bg-[#16161b]/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2 text-[11px]">
                  {/* Visual Node Flow */}
                  <div className="flex items-center justify-between font-mono bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-900">
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-zinc-500 text-[9px] uppercase">浏览器</span>
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${linkBrowserToNode ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                    </div>
                    <div className={`h-[2px] flex-1 ${linkBrowserToNode ? "bg-emerald-200 dark:bg-emerald-900" : "bg-zinc-200 dark:bg-zinc-800"}`} />
                    
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-zinc-500 text-[9px] uppercase">网关</span>
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${linkNodeToTunnel ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                    </div>
                    <div className={`h-[2px] flex-1 ${linkNodeToTunnel ? "bg-emerald-200 dark:bg-emerald-900" : "bg-zinc-200 dark:bg-zinc-800"}`} />
                    
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-zinc-500 text-[9px] uppercase">通道</span>
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${linkTunnelToMac ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                    </div>
                    <div className={`h-[2px] flex-1 ${linkTunnelToMac ? "bg-emerald-200 dark:bg-emerald-900" : "bg-zinc-200 dark:bg-zinc-800"}`} />
                    
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-zinc-500 text-[9px] uppercase">主机</span>
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${linkTunnelToMac && networkOk ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 opacity-90 text-[10px] text-zinc-500 dark:text-zinc-400 font-sans">
                    <div className="flex items-center justify-between">
                      <span>安全组 (Tailscale)</span>
                      <span className={linkNodeToTunnel ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600"}>
                        {linkNodeToTunnel ? "安全连接中" : "未建立通道"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>中转目标</span>
                      <span className="font-mono">Express :3000</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 2: Core Brain Status */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-500" /> 核心认知大脑
                </span>
                
                <div className="p-3 bg-zinc-50/80 dark:bg-[#16161b]/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg select-none">
                      {activeAgentEmoji}
                    </div>
                    <div>
                      <h4 className="text-[12px] font-bold text-zinc-800 dark:text-zinc-250 font-sans">
                        {activeAgentName}
                      </h4>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        {activeAgentReady ? "多模型认知能力就绪" : "未准备就绪"}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-medium border leading-none ${
                    activeAgentReady 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/30 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400" 
                      : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/30 dark:border-amber-900/30 text-amber-600 dark:text-amber-400"
                  }`}>
                    {activeAgentReady ? "就绪" : "待命"}
                  </span>
                </div>
              </div>

              {/* Layer 3: Compace MacBook Telemetry Cards */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-amber-500" /> 物理宿主算力遥测
                </span>

                {/* Micro bento grids */}
                <div className="grid grid-cols-3 gap-2">
                  {/* CPU Bento */}
                  <div className="p-2.5 bg-zinc-50/80 dark:bg-[#16161b]/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex flex-col justify-between min-h-[64px]">
                    <div className="flex items-center justify-between">
                      <Cpu className="w-3.5 h-3.5 text-zinc-450 dark:text-zinc-400" />
                      <span className="text-[9px] font-bold text-zinc-400 uppercase font-mono">CPU</span>
                    </div>
                    <div className="mt-2 text-left">
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono tracking-tight">
                        {cpuUsage}%
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="bg-zinc-900 dark:bg-white h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(Math.max(cpuUsage, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* RAM Bento */}
                  <div className="p-2.5 bg-zinc-50/80 dark:bg-[#16161b]/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex flex-col justify-between min-h-[64px]">
                    <div className="flex items-center justify-between">
                      <Layers className="w-3.5 h-3.5 text-zinc-450 dark:text-zinc-400" />
                      <span className="text-[9px] font-bold text-zinc-400 uppercase font-mono">内存</span>
                    </div>
                    <div className="mt-2 text-left">
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono tracking-tight">
                        {memoryUsage}%
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(Math.max(memoryUsage, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Temp Bento */}
                  <div className="p-2.5 bg-zinc-50/80 dark:bg-[#16161b]/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex flex-col justify-between min-h-[64px]">
                    <div className="flex items-center justify-between">
                      <Thermometer className="w-3.5 h-3.5 text-zinc-450 dark:text-zinc-400" />
                      <span className="text-[9px] font-bold text-zinc-400 uppercase font-mono">温控</span>
                    </div>
                    <div className="mt-2 text-left">
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono tracking-tight">
                        {temperature}°C
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${temperature > 65 ? "bg-rose-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(Math.max((temperature / 90) * 100, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Micro Uptime Footer status */}
            <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-[#141418]/40 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
              <span>系统持续正常运行时间</span>
              <span>{uptime || "已连接"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
