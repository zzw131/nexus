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
  PencilLine,
} from "lucide-react";
import { AGENTS, ChatSession, Agent } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { RenameSessionModal } from "./RenameSessionModal";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  currentAgentId: string;
  isDarkMode: boolean;
  isAdmin: boolean;
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
  isAdmin,
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
  const [renamingSession, setRenamingSession] = useState<{ id: string; title: string } | null>(null);

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

  const allAgentsToRender = [...Object.values(AGENTS), ...openclawAgents];

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
    <aside className="relative w-[340px] border-r border-zinc-200/20 dark:border-zinc-800/20 bg-white/75 dark:bg-[#131118]/80 backdrop-blur-md flex flex-col justify-between h-full group/sidebar transition-all duration-300">
      <div className="flex-1 flex flex-col justify-between h-full min-h-0">
        <div
          className="p-5 bg-white/90 dark:bg-white/10 border-b border-zinc-200/20 dark:border-white/5 flex flex-col gap-4 select-none shrink-0 mb-2 shadow-sm relative z-10"
          aria-label="Nexus 控制台"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 items-center justify-center flex font-bold text-white dark:text-zinc-900 text-sm shadow-md">
                N
              </div>
              <div>
                <h1 className="text-xs font-bold tracking-tight text-zinc-950 dark:text-white font-sans flex items-center gap-2">
                  Nexus 节点机
                </h1>
                <span className="text-[9px] text-zinc-500 dark:text-zinc-300 font-mono tracking-wider">
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
                    if (!isCodexPlaceholder && agentSessions.length > 0) {
                      toggleGroup(agent.id);
                    }
                  }}
                  className={`group relative flex items-center justify-between w-full px-2 py-2 rounded-xl transition-all select-none ${
                    isCodexPlaceholder
                      ? "cursor-not-allowed"
                      : agentSessions.length === 0
                        ? "cursor-default"
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
                    {/* Plus Button - only shown when this agent is selected */}
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
                    ) : agentSessions.length > 0 ? (
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Sublist */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out pl-0 pr-0"
                  style={{
                    maxHeight: (isExpanded || agentSessions.length === 0) ? "1000px" : "0px",
                    opacity: (isExpanded || agentSessions.length === 0) ? 1 : 0,
                  }}
                >
                  <div className="p-1 space-y-1 bg-white dark:bg-[#1e1c26]/80 rounded-xl mt-1 shadow-sm border border-zinc-100/80 dark:border-zinc-800/30">
                    {agentSessions.length === 0 ? (
                      <div className="py-4 px-2 text-center text-zinc-400 dark:text-zinc-600 text-[11px] font-medium select-none flex flex-col items-center gap-1.5 opacity-80">
                        暂无会话数据
                      </div>
                    ) : (
                      agentSessions.map((sess) => {
                        const isActive = sess.id === activeSessionId;
                        return (
                          <div
                            key={sess.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelectSession(sess.id)}
                            className="group/item flex items-center justify-between w-full rounded-xl transition-all text-left relative cursor-pointer"
                          >
                            <div
                              className={`flex items-center gap-2.5 w-full transition-all duration-300 rounded-xl px-4 py-2.5 ${
                                isActive
                                  ? "bg-white dark:bg-white/20 border border-white dark:border-white/30 shadow-[0_4px_24px_rgba(255,255,255,1)] dark:shadow-[0_4px_24px_rgba(255,255,255,0.1)] backdrop-blur-xl pr-9"
                                  : "hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 border border-transparent pr-9"
                              }`}
                            >
                              <MessageSquare
                                className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400"}`}
                              />
                              <span
                                className={`text-[12px] font-medium leading-normal font-sans truncate ${isActive ? "text-zinc-950 dark:text-white font-semibold" : ""}`}
                              >
                                {sess.title || "新对话"}
                              </span>
                            </div>
                            
                            {/* Edit Button - visible on hover, admin only */}
                            {onRenameSession && isAdmin && (
                              <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"}`}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingSession({ id: sess.id, title: sess.title || "" });
                                  }}
                                  className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                                >
                                  <PencilLine className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <button
              onClick={() => {
                alert("即将通过云端代理网关创建新 Agent，敬请期待！");
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-[13px] font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              添加新 Agent
            </button>
          </div>
        </div>

        {/* 重命名弹窗 */}
        <RenameSessionModal
          open={renamingSession !== null}
          currentName={renamingSession?.title || ""}
          onClose={() => setRenamingSession(null)}
          onConfirm={(newName) => {
            if (renamingSession && onRenameSession) {
              onRenameSession(renamingSession.id, newName);
            }
            setRenamingSession(null);
          }}
        />

        <div className="p-4 bg-transparent flex flex-col gap-3 select-none shrink-0 border-t border-zinc-200/30 dark:border-zinc-800/30">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex-1 flex items-center justify-center gap-3 px-4 py-3 bg-transparent rounded-xl text-[14px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-300 cursor-pointer group/sec-btn"
          >
            <Settings className="w-5 h-5 text-zinc-500 transition-all duration-500 group-hover/sec-btn:rotate-90 group-hover/sec-btn:scale-110" />
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
            className="absolute inset-0 z-20 flex flex-col justify-between bg-white/95 dark:bg-[#131118]/95 p-5 font-sans antialiased text-left shadow-2xl border-r border-zinc-200/40 dark:border-zinc-800/40 backdrop-blur-md"
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
