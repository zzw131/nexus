import React, { useState, useEffect } from "react";
import {
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  X,
  ChevronRight,
  ChevronDown,
  Lock,
  MessageSquare,
  PencilLine,
} from "lucide-react";
import { AGENTS, ChatSession, Agent } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  currentAgentId: string;
  isDarkMode: boolean;
  openclawAgents?: Agent[];
  onAgentSwitch: (id: string) => void;
  onSelectSession: (id: string) => void;
  onCreateSession: (agentId: string) => Promise<void>;
  onRenameSession: (id: string, newTitle: string) => void;
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
  onAgentSwitch,
  onSelectSession,
  onCreateSession,
  onRenameSession,
}: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    <aside className="relative w-[340px] border-r border-zinc-200 dark:border-[#333538] bg-white dark:bg-[#1e1f20] flex flex-col justify-between h-full group/sidebar transition-all duration-300">
      <div className="flex-1 flex flex-col justify-between h-full min-h-0">
        <div
          className="p-5 bg-white dark:bg-[#1e1f20] flex flex-col gap-4 select-none shrink-0 mb-2 relative z-10"
          aria-label="Nexus 控制台"
        >
          <div className="flex items-center justify-between select-none">
            <div className="flex items-center gap-3 w-full -ml-2 p-2 select-none pointer-events-none">
              <div className="h-8 w-8 rounded-xl bg-zinc-900 dark:bg-white items-center justify-center flex overflow-hidden select-none">
                <span className="text-white dark:text-zinc-900 font-bold text-[18px] select-none">N</span>
              </div>
              <div className="flex-1 flex items-center justify-between select-none">
                <h1 className="text-[17px] font-medium tracking-tight text-zinc-900 dark:text-zinc-100 font-sans flex items-center gap-2 select-none">
                  Zzw · Nexus
                </h1>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#333538]/50 transition-colors shadow-none cursor-pointer"
              >
                <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setDropdownOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1e1f20] border border-zinc-200 dark:border-[#333538] rounded-xl shadow-none z-50 overflow-hidden"
                    >
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          setSettingsOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#333538]/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-left"
                      >
                        <Settings className="w-4 h-4" />
                        系统配置项
                      </button>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          alert("即将通过云端代理网关创建新 Agent，敬请期待！");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#333538]/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-left"
                      >
                        <Plus className="w-4 h-4" />
                        添加新 Agent
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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
                className={`flex flex-col gap-0.5 ${isCodexPlaceholder ? "opacity-50 grayscale" : ""}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!isCodexPlaceholder && agentSessions.length > 0) {
                      toggleGroup(agent.id);
                    }
                  }}
                  className={`group relative flex items-center justify-between w-full px-3 py-2 rounded-[10px] transition-colors select-none ${
                    isCodexPlaceholder
                      ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                      : "cursor-pointer hover:bg-zinc-100 dark:hover:bg-[#333538]/50 text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] w-5 text-center leading-none">
                      {agent.emoji}
                    </span>
                    <span className="text-[14px] font-medium font-sans">
                      {agent.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-zinc-400 mr-2">
                    {isCodexPlaceholder ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleCreateNew(e, agent.id)}
                          disabled={creatingAgentId !== null}
                          className="flex items-center justify-center w-5 h-5 rounded hover:text-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {creatingAgentId === agent.id ? (
                            <div className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {agentSessions.length > 0 && (
                          <motion.div
                            animate={{ rotate: isExpanded ? 0 : -90 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Sublist */}
                {agentSessions.length > 0 && (
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out pl-9 pr-2"
                    style={{
                      maxHeight: isExpanded ? "1000px" : "0px",
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div className="space-y-0.5 mt-0.5 pl-3 ml-1.5 border-l border-zinc-200/80 dark:border-zinc-800/80">
                      {agentSessions.map((sess, index) => {
                        const isActive = sess.id === activeSessionId;
                        return (
                          <div
                            key={sess.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelectSession(sess.id)}
                            className={`group/item flex items-center justify-between w-full transition-colors text-left relative cursor-pointer px-3 py-1.5 rounded-xl ${
                              isActive
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium shadow-sm border border-transparent dark:border-zinc-700/50"
                                : "bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50 font-medium border border-transparent"
                            }`}
                          >
                            <span
                              className={`text-[13px] leading-normal font-sans truncate`}
                            >
                              {sess.title || "新对话"}
                            </span>
                            
                            {/* Edit Button (Visible on Hover) */}
                            <div className={`transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"}`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRenameSession(sess.id, sess.title || "新对话");
                                }}
                                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              >
                                <PencilLine className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute inset-0 z-20 flex flex-col justify-between bg-white dark:bg-[#1e1f20] p-5 font-sans antialiased text-left shadow-none border-r border-zinc-200 dark:border-[#333538]"
          >
            <div className="flex-1 flex flex-col min-h-0 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800">
                    控制台配置
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">
                    系统偏好设置
                  </p>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 scrollbar-none">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />{" "}
                    标准会话状态
                  </label>
                  <div className="p-3 bg-zinc-50 dark:bg-[#1e1f20] border border-zinc-200 dark:border-[#333538] text-[10px] font-mono rounded-xl text-zinc-800 dark:text-zinc-200 break-all select-all">
                    已连接
                  </div>
                </div>
                
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Settings className="w-3.5 h-3.5 text-blue-500" />{" "}
                    UI 设计规范库
                  </label>
                  <div className="p-3 bg-zinc-50 dark:bg-[#1e1f20] border border-zinc-200 dark:border-[#333538] text-[11px] font-sans leading-relaxed rounded-xl text-zinc-700 dark:text-zinc-300">
                     <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">配色</p>
                     <ul className="list-disc pl-4 mb-2 space-y-1 text-zinc-600 dark:text-zinc-400">
                       <li>纯白主背景: bg-white</li>
                       <li>次级/悬浮: bg-zinc-50</li>
                       <li>边框颜色: border-zinc-200 (禁止使用多余阴影)</li>
                       <li>主文本: text-zinc-900</li>
                       <li>次文本: text-zinc-500</li>
                     </ul>
                     <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">排版与布局</p>
                     <ul className="list-disc pl-4 mb-2 space-y-1 text-zinc-600 dark:text-zinc-400">
                       <li>字体: Inter / Sans-serif 体系</li>
                       <li>留白: 内部间距保持舒适清晰 (p-2, p-4)</li>
                     </ul>
                     <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">交互表现</p>
                     <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                       <li>禁止使用复杂颜色渐变、毛玻璃与发光投影</li>
                       <li>交互反馈通过背景微变 (hover:bg-zinc-50) 处理</li>
                     </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 mt-4">
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl"
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
