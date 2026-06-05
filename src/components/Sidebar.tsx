import React, { useState, useEffect } from "react";
import { Plus, MessageSquare, Trash2, Settings, ShieldCheck, Sun, Moon, Info, X, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { ChatSession, AGENTS } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  key?: string;
  sessions: ChatSession[];
  activeSessionId: string | null;
  currentAgentId: string;
  gatewayConnected: boolean;
  loadingSessionHistory: boolean;
  onSelectSession: (id: string) => void;
  onNewSession: (agentId?: string) => void;
  onDeleteSession: (id: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onAgentSwitch: (id: string) => void;
  onOpenWizard: () => void;
}

const getEngineLabel = (runtime: string) => {
  const rt = (runtime || "").toLowerCase();
  if (rt === "llama") return "Llama";
  if (rt === "openclaw") return "OpenClaw";
  if (rt === "claude") return "Claude";
  if (rt === "hermes") return "Hermes";
  return rt ? rt.charAt(0).toUpperCase() + rt.slice(1) : "Unknown";
};

export default function Sidebar({
  sessions,
  activeSessionId,
  currentAgentId,
  gatewayConnected,
  loadingSessionHistory,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isDarkMode,
  onToggleDarkMode,
  onAgentSwitch,
  onOpenWizard,
}: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Default to only expand the active agent group and collapse others
  useEffect(() => {
    setExpandedGroups({
      [currentAgentId]: true,
    });
  }, [currentAgentId]);

  const toggleGroup = (agentId: string) => {
    const agent = AGENTS[agentId];
    if (agent?.placeholder || !agent?.active) return;
    setExpandedGroups((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  const getGroupedSessions = () => {
    const grouped: Record<string, ChatSession[]> = {};
    Object.keys(AGENTS).forEach(id => {
      grouped[id] = [];
    });
    
    sessions.forEach(sess => {
      const aId = sess.agentId || "hermes";
      if (!grouped[aId]) grouped[aId] = [];
      grouped[aId].push(sess);
    });

    return grouped;
  };

  const groupedSessions = getGroupedSessions();

  return (
    <aside className="relative w-80 border-r border-[#e4e4e7]/30 dark:border-zinc-900/30 bg-[#f5f5f7] dark:bg-[#121215] flex flex-col justify-between h-full group/sidebar transition-all duration-300">
      
      {/* 1. Main Sidebar Interface (Rendered when settings is closed) */}
      <div className="flex-1 flex flex-col justify-between h-full min-h-0">
        
        {/* Top Header section */}
        <div className="p-5 flex flex-col gap-4 select-none shrink-0" aria-label="Nexus 多智能体网关">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-950 font-sans font-extrabold text-sm shadow-xs">
                N
              </div>
              <div>
                <h1 className="text-xs font-bold tracking-tight text-zinc-800 dark:text-zinc-100 font-sans">
                  Nexus 节点机
                </h1>
                <span className="text-[9px] text-zinc-400 font-mono tracking-wider">v1.3 // 网关</span>
              </div>
            </div>

            <motion.button
              onClick={onToggleDarkMode}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleDarkMode();
                }
              }}
              whileHover={{ scale: 1.15, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/40 dark:hover:bg-zinc-805/40 rounded-lg transition-colors cursor-pointer"
              title="切换主题"
              aria-label="切换主题"
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
            </motion.button>
          </div>

        </div>

        {/* Scrollable Chat Sessions History Section */}
        <div className="flex-1 overflow-y-auto px-4 space-y-4 scrollbar-thin pr-1 min-h-0">
          {Object.values(AGENTS).map((agent) => {
            const agentSessions = groupedSessions[agent.id] || [];
            const isExpanded = expandedGroups[agent.id] || false;
            const isPlaceholder = agent.placeholder || !agent.active;
            const isCurrentAgent = currentAgentId === agent.id;

            return (
              <div key={agent.id} className={`flex flex-col gap-1 ${isPlaceholder ? 'opacity-50 grayscale' : ''}`}>
                {/* Agent Header */}
                <div
                  role="button"
                  tabIndex={isPlaceholder ? -1 : 0}
                  onClick={() => {
                    if (!isPlaceholder) {
                      onAgentSwitch(agent.id);
                      if (!isExpanded) toggleGroup(agent.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isPlaceholder) {
                      e.preventDefault();
                      onAgentSwitch(agent.id);
                      if (!isExpanded) toggleGroup(agent.id);
                    }
                  }}
                  aria-label={isPlaceholder ? `${agent.name} 预留接口，不可点击` : `展开 ${agent.name} 会话列表`}
                  className={`group relative flex items-center justify-between w-full px-3 py-2 rounded-xl transition-all select-none ${
                    isPlaceholder 
                      ? 'cursor-not-allowed' 
                      : 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className={`flex items-start gap-2 flex-1 transition-all`}>
                    <div className="flex flex-col items-start gap-0.5 mt-0.5">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200 font-sans tracking-tight flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium font-sans tracking-tight leading-none shrink-0 ${
                          agent.runtime === "llama"
                            ? "bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                            : agent.runtime === "openclaw"
                            ? "bg-violet-100/60 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400"
                            : agent.runtime === "claude"
                            ? "bg-orange-100/60 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}>
                          {getEngineLabel(agent.runtime)}
                        </span>
                        {agent.emoji} {agent.name}
                        {isPlaceholder && (
                          <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded-md bg-amber-100/50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-normal">
                            即将上线
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-70">
                    {!isPlaceholder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAgentSwitch(agent.id);
                          onNewSession(agent.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            e.preventDefault();
                            onAgentSwitch(agent.id);
                            onNewSession(agent.id);
                          }
                        }}
                        className="p-1 rounded-md hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        aria-label="新建对话"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                    {!isPlaceholder && (
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded leading-none min-w-[20px] text-center">
                        {agentSessions.length}
                      </span>
                    )}
                    {isPlaceholder ? (
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <motion.div
                        animate={{ rotate: isExpanded ? 0 : -90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Agent Sessions List */}
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out`}
                  style={{ maxHeight: isExpanded && !isPlaceholder ? "1000px" : "0px", opacity: isExpanded && !isPlaceholder ? 1 : 0 }}
                >
                  <div className="pl-2 ml-3 py-1 space-y-1 border-l-2 border-blue-500/50 dark:border-blue-500/40">
                    {agentSessions.length === 0 && !isPlaceholder ? (
                       <div className="pl-4 py-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-normal italic">
                         {currentAgentId === "openclaw" 
                           ? (gatewayConnected ? "等待会话同步..." : "正在连接 Gateway...")
                           : `暂无 ${agent.alias || agent.name.split(" ")[0]} 对话`}
                       </div>
                    ) : (
                      agentSessions.map((sess) => {
                        const isActive = sess.id === activeSessionId;
                        const isGateway = !!sess.sessionKey;
                        const msgCount = sess.messages.length;
                        const isLoading = isActive && loadingSessionHistory;
                        // Channel badge
                        const chLabel = sess.channel === "webchat" ? "🌐" : sess.channel === "feishu" ? "📱" : sess.channel === "cron" ? "⏰" : "";
                        return (
                          <motion.div
                            key={sess.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelectSession(sess.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelectSession(sess.id);
                              }
                            }}
                            className={`group/item flex items-center justify-between w-full px-3 py-2 ml-1 rounded-xl transition-all text-left relative cursor-pointer border border-transparent ${
                              isActive
                                ? "bg-white dark:bg-zinc-905 text-zinc-900 dark:text-white shadow-2xs border-[#e4e4e7]/20 dark:border-zinc-800/20"
                                : "hover:bg-zinc-200/40 dark:hover:bg-zinc-900/30 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                            }`}
                          >
                            <div className="flex flex-col overflow-hidden w-[82%] min-w-0">
                              <div className="flex items-center gap-2">
                                <MessageSquare className={`w-3 h-3 shrink-0 ${isActive ? "text-zinc-905 dark:text-white" : "text-zinc-400"}`} />
                                <span className="text-[11px] font-semibold leading-normal font-sans truncate pr-1">
                                  {sess.title || "新对话"}
                                </span>
                              </div>
                              {isGateway && (
                                <div className="flex items-center gap-2 ml-5 mt-0.5">
                                  <span className="text-[9px] text-zinc-400 font-mono">
                                    {chLabel} {sess.channel} · {sess.totalTokens ? `${Math.round(sess.totalTokens / 1000)}k tokens` : ""}
                                  </span>
                                  {sess.lastMessagePreview && (
                                    <span className="text-[9px] text-zinc-400 truncate max-w-[120px]">
                                      {sess.lastMessagePreview.slice(0, 30)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {isLoading && (
                                <div className="flex items-center gap-1 ml-5 mt-0.5">
                                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
                                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                  <span className="text-[9px] text-blue-400 ml-1">加载历史...</span>
                                </div>
                              )}
                            </div>

                            <motion.button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(sess.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onDeleteSession(sess.id);
                                }
                              }}
                              whileHover={{ scale: 1.1, x: -1 }}
                              whileTap={{ scale: 0.9 }}
                              className="opacity-0 group-hover/item:opacity-100 focus:opacity-100 shrink-0 p-1 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 transition-all cursor-pointer"
                              title="删除对话"
                              aria-label="删除对话"
                            >
                              <Trash2 className="w-3 h-3" />
                            </motion.button>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer block (No Divider Above) */}
        <div className="p-4 bg-transparent flex flex-col gap-3 select-none shrink-0 border-t border-zinc-200/30 dark:border-zinc-800/30">
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenWizard}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-semibold border border-dashed border-zinc-300 dark:border-zinc-700 transition-colors"
          >
             <Plus className="w-3.5 h-3.5" />
             添加新 Agent 网络
          </motion.button>

          <div className="flex items-center justify-between gap-1 px-1">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${currentAgentId === "openclaw" ? (gatewayConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500") : "bg-emerald-500 animate-pulse"}`} />
              <span className="text-[10px] font-bold text-zinc-650 dark:text-zinc-400 font-sans tracking-wide">
                {currentAgentId === "openclaw" 
                  ? (gatewayConnected ? "Gateway 实时同步" : "Gateway 连接中...")
                  : "Tailscale 隧道连接状态"}
              </span>
            </div>
            <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">
              {currentAgentId === "openclaw" ? "18789" : "100.83.118.16"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setSettingsOpen(true)}
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/30 dark:border-zinc-800/30 rounded-xl text-xs font-semibold text-zinc-650 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer shadow-xs"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
              <span>系统配置项</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* 2. Embedded Settings Panel (Directly OVERLAPS the left sidebar window when toggled with sliding effect) */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute inset-0 z-20 flex flex-col justify-between bg-white dark:bg-[#121215] p-5 font-sans antialiased text-left shadow-2xl"
          >
            <div className="flex-1 flex flex-col min-h-0 space-y-5">
              
              {/* Header section with raw close button */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    外部网络代理设置
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                    管理后端连接架构与 API 接口定义
                  </p>
                </div>
                <motion.button
                  onClick={() => setSettingsOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSettingsOpen(false);
                    }
                  }}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 350, damping: 15 }}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                  title="返回"
                  aria-label="关闭"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>

              {/* Content list with background cards instead of line dividers */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 scrollbar-none">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    大模型配置端点
                  </label>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-[#e4e4e7]/20 dark:border-zinc-800/20 text-[10px] font-mono rounded-xl text-zinc-800 dark:text-zinc-200 break-all select-all">
                    http://100.83.118.16:8000/v1/chat/completions
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Bearer 秘钥认证保护
                  </label>
                  <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-[#e4e4e7]/20 dark:border-zinc-800/20 font-mono text-[10px] rounded-xl">
                    <span className="text-zinc-400 font-semibold truncate select-all pr-2">
                      Bearer 43847f73aa132c3abfa9b076eb1dd7ff...
                    </span>
                    <span className="text-[9px] uppercase font-bold text-zinc-400 font-sans px-1.5 py-0.5 rounded bg-zinc-200/50 dark:bg-zinc-800">
                      已验证
                    </span>
                  </div>
                </div>
                
                <div className="p-3 rounded-xl bg-blue-50/40 dark:bg-blue-950/10 text-[10px] leading-relaxed text-blue-600 dark:text-blue-400 flex gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 text-blue-500 mt-0.5" />
                  <span>
                    系统通过 Tailscale 加密隧道直连受信任的物理核心节点。
                  </span>
                </div>
                
              </div>
            </div>

            <div className="pt-4 shrink-0">
              <motion.button
                onClick={() => setSettingsOpen(false)}
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl cursor-pointer shadow-xs"
              >
                完成并返回工作台
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
