import React, { useState, useEffect } from "react";
import {
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  X,
  ChevronRight,
  Lock,
  MessageSquare,
} from "lucide-react";
import { AGENTS, ChatSession } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  currentAgentId: string;
  isDarkMode: boolean;
  openclawAgents?: Agent[];
  onToggleDarkMode: () => void;
  onAgentSwitch: (id: string) => void;
  onSelectSession: (id: string) => void;
  onCreateSession: (agentId: string) => Promise<void>;
  onRenameSession?: (sessionId: string, newTitle: string) => Promise<void>;
  onOpenWizard: () => void;
}

const getEngineLabel = (rt: string) => {
  if (rt === "llama") return "Llama";
  if (rt === "openclaw") return "OpenClaw";
  if (rt === "claude") return "Claude";
  if (rt === "codex") return "Codex";
  return rt ? rt.charAt(0).toUpperCase() + rt.slice(1) : "Unknown";
};

export default function Sidebar({
  sessions,
  activeSessionId,
  currentAgentId,
  isDarkMode,
  openclawAgents = [],
  onToggleDarkMode,
  onAgentSwitch,
  onSelectSession,
  onCreateSession,
  onRenameSession,
}: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [creatingAgentId, setCreatingAgentId] = useState<string | null>(null);

  // Initialize expanded groups based on active agents or specific conditions
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    if (activeSessionId) {
      const activeSess = sessions.find((s) => s.id === activeSessionId);
      if (activeSess?.agentId) {
        initialExpanded[activeSess.agentId] = true;
      }
    } else {
      initialExpanded[currentAgentId] = true;
    }
    setExpandedGroups((prev) => ({ ...prev, ...initialExpanded }));
  }, [activeSessionId, currentAgentId, sessions]);

  const toggleGroup = (agentId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  const allAgentsToRender = [
    ...Object.values(AGENTS),
    ...openclawAgents,
  ];

  const groupedSessions = () => {
    const grouped: Record<string, ChatSession[]> = {};
    allAgentsToRender.forEach((agent) => {
      grouped[agent.id] = [];
    });
    sessions.forEach((sess) => {
      const aId = sess.agentId || "hermes";
      if (!grouped[aId]) grouped[aId] = [];
      grouped[aId].push(sess);
    });
    return grouped;
  };

  const sessionsMap = groupedSessions();

  const handleCreateNew = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    if (creatingAgentId) return;

    setCreatingAgentId(agentId);
    try {
      await onCreateSession(agentId);
      setExpandedGroups((prev) => ({ ...prev, [agentId]: true }));
    } finally {
      setCreatingAgentId(null);
    }
  };

  return (
    <aside className="relative w-[340px] border-r border-[#e4e4e7]/30 dark:border-zinc-900/30 bg-[#f5f5f7] dark:bg-[#121215] flex flex-col justify-between h-full group/sidebar transition-all duration-300">
      <div className="flex-1 flex flex-col justify-between h-full min-h-0">
        <div
          className="p-5 flex flex-col gap-4 select-none shrink-0"
          aria-label="Nexus 控制台"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-black items-center justify-center flex font-bold text-white text-sm shadow-md">
                N
              </div>
              <div>
                <h1 className="text-xs font-bold tracking-tight text-zinc-800 dark:text-zinc-100 font-sans flex items-center gap-2">
                  Nexus 节点机
                </h1>
                <span className="text-[9px] text-zinc-400 font-mono tracking-wider">
                  v1.3 // 网关
                </span>
              </div>
            </div>

            <motion.button
              onClick={onToggleDarkMode}
              whileHover={{ scale: 1.15, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors shadow-none cursor-pointer"
            >
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-3 scrollbar-none pb-4">
          {allAgentsToRender.map((agent) => {
            const agentSessions = sessionsMap[agent.id] || [];
            const isExpanded = expandedGroups[agent.id] || false;
            const isCodexPlaceholder =
              agent.placeholder && agent.id === "codex";
            const rt = agent.runtime;

            return (
              <div
                key={agent.id}
                className={`flex flex-col gap-1.5 ${isCodexPlaceholder ? "opacity-50 grayscale" : ""}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!isCodexPlaceholder) {
                      toggleGroup(agent.id);
                      onAgentSwitch(agent.id);
                    }
                  }}
                  className={`group relative flex items-center justify-between w-full px-2 py-2 rounded-xl transition-all select-none ${
                    isCodexPlaceholder
                      ? "cursor-not-allowed"
                      : "cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {/* Runtime Pill */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-tight leading-none shrink-0 border 
                        ${rt === "llama" ? "bg-emerald-100/50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/40" : ""}
                        ${rt === "openclaw" ? "bg-violet-100/50 text-violet-700 border-violet-200/50 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-800/40" : ""}
                        ${rt === "claude" ? "bg-orange-100/50 text-orange-700 border-orange-200/50 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800/40" : ""}
                        ${rt === "codex" ? "bg-zinc-200/50 text-zinc-500 border-zinc-300/50 dark:bg-zinc-800/50 dark:text-zinc-500 dark:border-zinc-700" : ""}
                      `}
                    >
                      {getEngineLabel(rt)}
                    </span>

                    {/* Name */}
                    <span className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                      <span className="text-base leading-none">
                        {agent.emoji}
                      </span>
                      {agent.name}
                    </span>

                    {/* Placeholder status */}
                    {isCodexPlaceholder && (
                      <span className="text-[10px] text-zinc-400 font-medium ml-1">
                        即将上线
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mr-3 transition-opacity">
                    {/* Plus Button */}
                    {!isCodexPlaceholder && currentAgentId === agent.id && (
                      <button
                        onClick={(e) => handleCreateNew(e, agent.id)}
                        disabled={creatingAgentId !== null}
                        className="flex items-center justify-center w-5 h-5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                      >
                        {creatingAgentId === agent.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-end w-[42px] gap-2 shrink-0 pr-1">
                    {/* Count Pill */}
                    {!isCodexPlaceholder && (
                      <span className="text-[10px] font-mono font-medium text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded leading-none min-w-[20px] text-center border border-zinc-300/30 dark:border-zinc-700/30">
                        {agentSessions.length}
                      </span>
                    )}

                    {/* Chevron or Lock */}
                    {isCodexPlaceholder ? (
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Sublist */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out pl-3 pr-1"
                  style={{
                    maxHeight: isExpanded ? "1000px" : "0px",
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div className="pl-3 py-1 space-y-1">
                    {agentSessions.map((sess) => {
                      const isActive = sess.id === activeSessionId;
                      return (
                        <div
                          key={sess.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectSession(sess.id)}
                          className="group/item flex items-center justify-between w-full rounded-xl transition-all text-left relative cursor-pointer"
                        >
                          {isActive && (
                            <div className="absolute left-[-13px] top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full bg-blue-500 z-10" />
                          )}
                          <div
                            className={`flex items-center gap-2.5 w-full transition-colors rounded-xl px-3 py-2 ${
                              isActive
                                ? "bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200/50 dark:border-zinc-800"
                                : "hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 border border-transparent"
                            }`}
                          >
                            <MessageSquare
                              className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400"}`}
                            />
                            <span
                              className={`text-[12px] font-medium leading-normal font-sans truncate ${isActive ? "text-zinc-900 dark:text-white font-semibold" : ""}`}
                            >
                              {sess.title || "新对话"}
                            </span>
                            {/* 重命名按钮：hover 显示，事件隔离 */}
                            {onRenameSession && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const newName = window.prompt("请输入新名称", sess.title || "");
                                  if (newName && newName.trim()) {
                                    onRenameSession(sess.id, newName.trim());
                                  }
                                }}
                                className="ml-auto shrink-0 p-0.5 rounded opacity-0 group-hover/item:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all cursor-pointer"
                                title="重命名"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            {/* 预留“云端新建 Agent”入口：如果用户选择创建 OpenClaw Agent，未来的 API 提交路径应指向代理网关，而不是本地服务器的 API */}
            <button
              onClick={() => {
                // Future implementation: Add OpenClaw agent -> POST /api/openclaw/v1/models (代理网关)
                alert("即将通过云端代理网关创建新 Agent，敬请期待！");
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-[13px] font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              添加新 Agent
            </button>
          </div>
        </div>

        <div className="p-4 bg-transparent flex flex-col gap-3 select-none shrink-0 border-t border-zinc-200/30 dark:border-zinc-800/30">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/30 dark:border-zinc-800/30 rounded-xl text-xs font-semibold text-zinc-650 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 shadow-xs transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-500" />
            <span>系统配置项</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute inset-0 z-20 flex flex-col justify-between bg-white dark:bg-[#121215] p-5 font-sans antialiased text-left shadow-2xl"
          >
            <div className="flex-1 flex flex-col min-h-0 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    控制台配置
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">
                    SYSTEM PREFERENCES
                  </p>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 scrollbar-none">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />{" "}
                    标准会话状态
                  </label>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-[#e4e4e7]/20 dark:border-zinc-800/20 text-[10px] font-mono rounded-xl text-zinc-800 dark:text-zinc-200 break-all select-all">
                    已连接
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 mt-4">
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl"
              >
                完成并返回工作台
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
