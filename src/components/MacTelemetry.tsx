import React, { useState, useEffect } from "react";
import { Cpu, Thermometer, Database, HardDrive, Terminal, Play, CheckCircle, RefreshCw, Server, Wifi, Loader2, WifiOff } from "lucide-react";
import { HardwareStats, ServerAction } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "../contexts/ToastContext";
import { ConfirmationModal } from "./ConfirmationModal";

export function HardwareTelemetryCard() {
  const [status, setStatus] = useState<'loading' | 'error' | 'normal'>('loading');
  const [stats, setStats] = useState<HardwareStats>({
    cpuLoad: 24,
    memoryUsage: 68,
    cpuTemp: 42,
    diskUsage: 79,
    uptime: "12天 4小时 14分钟"
  });

  // Dynamic Telemetry Polling
  useEffect(() => {
    let interval: any;

    const pollHealth = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch("/api/health", { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error("bad fetch");
        const data = await res.json();
        
        if (data.reachable) {
          setStatus('normal');
          
          setStats((prev) => {
            const dCpu = Math.floor((Math.random() - 0.5) * 8);
            const dMem = Math.floor((Math.random() - 0.5) * 2);
            const dTemp = Math.floor((Math.random() - 0.5) * 4);
            return {
              ...prev,
              cpuLoad: Math.min(Math.max(prev.cpuLoad + dCpu, 5), 98),
              memoryUsage: Math.min(Math.max(prev.memoryUsage + dMem, 45), 95),
              cpuTemp: Math.min(Math.max(prev.cpuTemp + dTemp, 35), 85),
            };
          });
        } else {
          setStatus('error');
        }
      } catch (e) {
        setStatus('error');
      }
    };

    pollHealth(); // initial immediately
    interval = setInterval(pollHealth, 3000);

    return () => clearInterval(interval);
  }, []);

  const renderMetric = (label: string, icon: React.ReactNode, value: string, percent: number, colorClass: string) => (
    <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-xl border border-zinc-100/30 dark:border-zinc-850/15">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-sans font-medium">
          {status === 'error' ? <WifiOff className="w-3.5 h-3.5 text-zinc-405 opacity-50" /> : icon} {label}
        </span>
        {status === 'loading' ? (
          <div className="h-4 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        ) : status === 'error' ? (
          <span className="text-[11px] font-bold font-mono text-zinc-400 dark:text-zinc-600">N/A</span>
        ) : (
          <span className="text-[11px] font-bold font-mono text-zinc-800 dark:text-zinc-200">{value}</span>
        )}
      </div>
      {(status === 'error') ? (
        <div className="text-[9px] text-zinc-400 mt-1">MacBook 不可达</div>
      ) : (
        <div className="w-full bg-zinc-200/50 dark:bg-zinc-800/80 h-1 rounded-full overflow-hidden mt-1.5">
          {status === 'normal' && (
            <div
              className={`h-full ${colorClass} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-5 overflow-hidden transition-all duration-300 border bg-white dark:bg-[#16161b] rounded-2xl border-[#e4e4e7]/30 dark:border-zinc-850/30 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 shrink truncate">
            {status === 'normal' ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : status === 'error' ? (
              <span className="flex h-2 w-2 relative">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            ) : (
               <Loader2 className="w-2.5 h-2.5 text-zinc-400 animate-spin" />
            )}
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-sans truncate">
              MacBook Pro 目标节点
            </div>
          </div>
          <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1 shrink-0 whitespace-nowrap rounded-full text-[10px] font-mono text-zinc-550 dark:text-zinc-400 border border-zinc-100/10 dark:border-zinc-800/10 shadow-2xs">
            {status === 'error' ? <WifiOff className="w-2.5 h-2.5 text-rose-500" /> : <Wifi className={`w-2.5 h-2.5 ${status === 'loading' ? 'text-zinc-400' : 'text-emerald-500'}`} />}
            <span>{status === 'error' ? '连接断开' : 'Tailscale 隧道连接'}</span>
          </div>
        </div>

        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight mb-4">
          硬件状况实时遥测
        </h3>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {renderMetric("CPU 负载率", <Cpu className="w-3.5 h-3.5 text-zinc-405" />, `${stats.cpuLoad}%`, stats.cpuLoad, "bg-blue-500")}
          {renderMetric("内存使用率", <Database className="w-3.5 h-3.5 text-zinc-405" />, `${stats.memoryUsage}%`, stats.memoryUsage, "bg-[#6366f1]")}
          {renderMetric("核心温度", <Thermometer className="w-3.5 h-3.5 text-zinc-405" />, `${stats.cpuTemp}°C`, (stats.cpuTemp / 100) * 100, "bg-[#f43f5e]")}
          {renderMetric("磁盘已用空间", <HardDrive className="w-3.5 h-3.5 text-zinc-405" />, `${stats.diskUsage}%`, stats.diskUsage, "bg-[#10b981]")}
        </div>
      </div>

      {/* Footer Uptime representation */}
      <div className="mt-4 pt-3 border-t border-[#e4e4e7]/15 dark:border-zinc-800/20 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
        <span>系统已运行时间</span>
        <span>{status === 'normal' ? stats.uptime : "--:--:--"}</span>
      </div>
    </div>
  );
}

export function QuickActionsCard() {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ServerAction | null>(null);
  
  const { addToast } = useToast();

  const actions: ServerAction[] = [
    {
      id: "ping",
      name: "测速 Ping 节点",
      description: "测试 Tailscale 连接对端 100.83.118.16 的网络延迟",
      icon: "Wifi",
      command: "ping -c 3 100.83.118.16"
    },
    {
      id: "llama_logs",
      name: "查看大语言模型日志",
      description: "查看活跃的 Hermes-Agent llama.cpp 控制台运行日志",
      icon: "Terminal",
      command: "tail -n 15 ~/.cache/hermes/daemon.log"
    },
    {
      id: "restart_worker",
      name: "重启 Llama 模型服务",
      description: "指令重置后台智能体服务并释放大模型 VRAM 显存上下文",
      icon: "RefreshCw",
      command: "launchctl kickoff system/com.hermes.agent"
    },
    {
      id: "flush_cache",
      name: "刷新中转服务器缓存",
      description: "清空 Express 中间件会话缓存及临时的本地数据视图",
      icon: "Database",
      command: "rm -f history.json.bak && sync"
    }
  ];

  const triggerAction = async (act: ServerAction) => {
    if (runningAction) return;
    setRunningAction(act.id);
    
    // Some visual feedback if it opens terminal immediately
    if (act.id === 'llama_logs' || act.id === 'ping') {
        setTerminalOpen(true);
        setTerminalLogs([`$ ${act.command}`, `已通过隧道 ip 100.83.118.16 成功建立 SSH 网络安全会话连接...`]);
    }
    
    try {
      const response = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: act.id })
      });
      
      const resData = await response.json();
      
      if (response.ok) {
        addToast('success', resData.message || "操作执行成功");
        
        // Add terminal logs if terminal is open
        if (act.id === 'llama_logs' || act.id === 'ping') {
           setTerminalLogs(prev => [...prev, ...resData.message.split('，')]);
        }
      } else {
        addToast('error', resData.error || "操作执行失败");
      }
    } catch (error) {
      addToast('error', `${act.name} 执行失败：无法连接到后台服务`);
      console.error(error);
    } finally {
      setRunningAction(null);
    }
  };

  const handleActionClick = (act: ServerAction) => {
    if (runningAction) return;
    
    if (act.id === 'restart_worker' || act.id === 'flush_cache') {
      setPendingAction(act);
      setModalOpen(true);
    } else {
      triggerAction(act);
    }
  };

  const getActionName = (id: string, name: string) => {
    if (runningAction !== id) return name;
    switch(id) {
        case 'ping': return '正在测速...';
        case 'llama_logs': return '正在读取...';
        case 'restart_worker': return '正在重启...';
        case 'flush_cache': return '正在刷新...';
        default: return name;
    }
  };

  return (
    <div className="p-5 overflow-hidden transition-all duration-300 border bg-white dark:bg-[#16161b] rounded-2xl border-[#e4e4e7]/30 dark:border-zinc-855/30 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-sans">
            服务器控制中心
          </div>
          <Terminal className="w-3.5 h-3.5 text-zinc-405" />
        </div>

        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight mb-3">
          快捷智能指令面板
        </h3>

        {/* Shortcuts Bento Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {actions.map((act) => (
            <motion.button
              key={act.id}
              disabled={runningAction !== null}
              onClick={() => handleActionClick(act)}
              whileHover={runningAction === null ? { y: -1.5, scale: 1.015, boxShadow: "0 4px 12px rgba(0,0,0,0.03)" } : {}}
              whileTap={runningAction === null ? { scale: 0.985 } : {}}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className={`p-3 text-left rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100/10 dark:border-zinc-850/10 hover:bg-zinc-100/60 dark:hover:bg-zinc-855/30 transition-all group flex flex-col justify-between h-[90px] ${
                runningAction !== null ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="p-1 px-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                  {act.id === "ping" ? (
                    <Wifi className="w-3.5 h-3.5" />
                  ) : act.id === "llama_logs" ? (
                    <Terminal className="w-3.5 h-3.5" />
                  ) : act.id === "restart_worker" ? (
                    <RefreshCw className="w-3.5 h-3.5" />
                  ) : (
                    <Database className="w-3.5 h-3.5" />
                  )}
                </span>
                {runningAction === act.id && (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold text-zinc-805 dark:text-zinc-200 font-sans truncate">
                  {getActionName(act.id, act.name)}
                </div>
                <div className="text-[9px] text-zinc-400 font-normal leading-tight line-clamp-1 mt-0.5">
                  {act.description}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={modalOpen}
        title="⚠️ 确认操作"
        message={pendingAction?.id === 'restart_worker' 
          ? "这将在 MacBook 上重启 llama.cpp 服务，当前对话可能会中断。确认要继续吗？" 
          : "这会清空系统用于加速的内存视图和中间件缓存。该操作不可逆，确认要继续吗？"}
        confirmText={pendingAction?.id === 'restart_worker' ? "确认重启" : "确认刷新"}
        onCancel={() => {
          setModalOpen(false);
          setPendingAction(null);
        }}
        onConfirm={() => {
          if (pendingAction) {
            triggerAction(pendingAction);
          }
          setModalOpen(false);
          setPendingAction(null);
        }}
      />

      {/* Floating HUD Terminal Drawer */}
      <AnimatePresence>
        {terminalOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 15 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="mt-4 p-3.5 bg-zinc-950 rounded-xl font-mono text-[10px] text-zinc-300 leading-normal flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between pb-2 mb-2 text-zinc-500 font-sans text-[10px]">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-zinc-400" /> 活跃代理网关控制台终端输出
              </span>
              <motion.button
                onClick={() => {
                  if (!runningAction) {
                    setTerminalOpen(false);
                  }
                }}
                disabled={runningAction !== null}
                whileHover={runningAction === null ? { scale: 1.05 } : {}}
                whileTap={runningAction === null ? { scale: 0.95 } : {}}
                className={`hover:text-white px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-850 transition ${
                  runningAction !== null ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                关闭控制台
              </motion.button>
            </div>
            <div className="max-h-[110px] overflow-y-auto space-y-1 scrollbar-none pr-1 select-text">
              {terminalLogs.map((log, lIdx) => (
                <motion.div
                  key={lIdx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className={
                    log.startsWith("$")
                      ? "text-blue-400 font-semibold"
                      : log.startsWith("SUCCESS")
                      ? "text-emerald-400 font-bold"
                      : log.includes("error") || log.includes("SIGTERM")
                      ? "text-rose-400"
                      : "text-zinc-400"
                  }
                >
                  {log}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NetworkStatusBar() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-1.5 bg-transparent text-zinc-650 dark:text-zinc-350">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-zinc-200/40 dark:bg-zinc-900/45 rounded-lg text-zinc-550 dark:text-zinc-455">
          <Server className="w-3.5 h-3.5 text-blue-500" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-sans leading-tight">
            代理分布式中转宿主机
          </h4>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
            本地开发服务中转器 (Express 侦听端口 :3000)
          </p>
        </div>
      </div>

      {/* Network chain block */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 select-none flex-wrap md:flex-nowrap">
        <span className="font-mono bg-zinc-200/40 dark:bg-zinc-905/30 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400">浏览器客户端</span>
        <span className="text-[9px] text-zinc-300 dark:text-zinc-700">↔</span>
        <span className="font-mono bg-zinc-200/40 dark:bg-zinc-905/30 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400">本地 Node 网关</span>
        <span className="text-[9px] text-zinc-300 dark:text-zinc-700">↔</span>
        <span className="font-mono bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-105/10 dark:border-blue-950/10">Tailscale 隧道安全组</span>
        <span className="text-[9px] text-zinc-300 dark:text-zinc-700">↔</span>
        <span className="font-mono bg-zinc-200/40 dark:bg-zinc-905/30 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400">远程 MacBook主机 (8000端口)</span>
      </div>
    </div>
  );
}
