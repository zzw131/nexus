import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Trash2,
  RefreshCw,
  Terminal,
  Activity,
  User,
  Zap,
  Info,
  Layers,
  ChevronRight,
  Wifi,
  Radio,
  Clock,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  X,
  Menu,
  Sun,
  Moon,
  Mic,
  Plus,
  ArrowDown,
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import MarkdownRenderer from "./components/MarkdownRenderer";
import AgentWizard from "./components/AgentWizard";
import ControlCenter from "./components/ControlCenter";
import {
  HardwareTelemetryCard,
  QuickActionsCard,
  NetworkStatusBar,
} from "./components/MacTelemetry";
import { AgentPlaceholder } from "./components/AgentPlaceholder";
import { AIGeneratingState } from "./components/AIGeneratingState";
import { RefStyleMockup } from "./components/RefStyleMockup";
import { Message, ChatSession, Agent, AGENTS } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { useRetry } from "./hooks/useRetry";

import { RenameSessionModal } from "./components/RenameSessionModal";
import { ModelSelector } from "./components/ModelSelector";

export default function App() {
  // Theme state - default to false (Light Theme)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "sess-mock-1",
      title: "关于高保真界面的修改方案",
      agentId: "hermes",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "请帮我配置低核心延迟的 Flash-Lite 极速响应,并将加载动效 and 生成卡片修改为细描边、扫光形式。",
          timestamp: new Date(Date.now() - 3600000).toLocaleTimeString("zh-CN", { hour12: false }),
        },
        {
          id: "mock-generating",
          role: "assistant",
          content: "",
          timestamp: new Date(Date.now() - 3500000).toLocaleTimeString("zh-CN", { hour12: false }),
        },
        {
          id: "m3",
          role: "user",
          content: "扫光和N字母图标的细节非常棒!渲染完成后的卡片可以一并展示出来吗?",
          timestamp: new Date(Date.now() - 3400000).toLocaleTimeString("zh-CN", { hour12: false }),
        },
        {
          id: "mock-completed",
          role: "assistant",
          content: "**[⚡️ Hermes 核心大脑]**\n卡片渲染任务已完成,这是升级细描边和重构后的最终高保真交付物:",
          timestamp: new Date(Date.now() - 3300000).toLocaleTimeString("zh-CN", { hour12: false }),
        }
      ]
    },
    {
      id: "sess-mock-2",
      title: "架构审查",
      agentId: "hermes",
      messages: []
    },
    {
      id: "sess-mock-3",
      title: "产品文档补充",
      agentId: "qwen",
      messages: []
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>("sess-mock-1");
  const [input, setInput] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [pinging, setPinging] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"chat" | "telemetry">("chat");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 150);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  const [isAdviceOpen, setIsAdviceOpen] = useState<boolean>(false);
  const [hoveredAdvice, setHoveredAdvice] = useState<boolean>(false);
  const adviceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adviceRef.current && !adviceRef.current.contains(event.target as Node)) {
        setIsAdviceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // State for Rename Modal
  const [renameModalState, setRenameModalState] = useState<{ open: boolean; sessionId: string; currentName: string }>({
    open: false,
    sessionId: "",
    currentName: "",
  });

  // Simulated real-time metrics for the ControlCenter
  const [controlCenterMetrics, setControlCenterMetrics] = useState({
    cpuUsage: 22,
    memoryUsage: 66,
    temperature: 41,
    uptime: "12天 4小时 16分钟"
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setControlCenterMetrics(prev => {
        const dCpu = Math.floor((Math.random() - 0.5) * 6);
        const dMem = Math.floor((Math.random() - 0.5) * 2);
        const dTemp = Math.floor((Math.random() - 0.5) * 3);
        return {
          ...prev,
          cpuUsage: Math.min(Math.max(prev.cpuUsage + dCpu, 8), 85),
          memoryUsage: Math.min(Math.max(prev.memoryUsage + dMem, 58), 92),
          temperature: Math.min(Math.max(prev.temperature + dTemp, 36), 75)
        };
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Multi-Agent Gateway routing states
  const [currentAgentId, setCurrentAgentId] = useState<string>(() => {
    return localStorage.getItem("hermes_current_agent_id") || "hermes";
  });

  useEffect(() => {
    localStorage.setItem("hermes_current_agent_id", currentAgentId);
  }, [currentAgentId]);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [openclawAgents, setOpenclawAgents] = useState<Agent[]>([]);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [showNetworkErrorModal, setShowNetworkErrorModal] =
    useState<boolean>(false);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(
    null,
  );

  const { isRetrying, retryCount, resetRetry } = useRetry();

  // Test connection to Alibaba Cloud server
  const testConnection = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("/api/health", { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        setNetworkError(null);
        return true;
      }
      setNetworkError("服务器响应异常");
      return false;
    } catch {
      setNetworkError("无法连接到服务器");
      return false;
    }
  };

  // initial check
  useEffect(() => {
    testConnection();
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load agents from config
  useEffect(() => {
    // 本地静态 AGENTS 配置已包含所有 Agent
  }, []);

  // Apply dark mode CSS classes
  useEffect(() => {
    // Read cached state
    const cachedTheme = localStorage.getItem("hermes_color_theme");
    if (cachedTheme === "dark") {
      setIsDarkMode(true);
    } else {
      setIsDarkMode(false);
    }
  }, []);

  // Sync state to DOM classlist for seamless Tailwind transitions
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("hermes_color_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("hermes_color_theme", "light");
    }
  }, [isDarkMode]);

  // Initialization handled by fetchAllSessions

  // Save selected session back to local storage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(
        `hermes_active_session_id_${currentAgentId}`,
        activeSessionId,
      );
    }
  }, [activeSessionId, currentAgentId]);

  // Handle scrolling of chat container
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId, isGenerating]);

  // Fetch all sessions:OpenClaw Agent 从 Gateway 实时拉取(Source of Truth),
  // Hermes 从本地 history.json 读取
  useEffect(() => {
    const fetchAllSessions = async () => {
      try {
          // 第二阶段·纯净启动:不连数据库,创建空白会话
          const defaultSession: ChatSession = {
            id: "session-" + Date.now(),
            title: "新对话",
            agentId: "hermes",
            messages: [],
            createdAt: new Date().toISOString(),
          };
          setSessions([defaultSession]);
          setActiveSessionId(defaultSession.id);
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      }
    };

    fetchAllSessions();
  }, [forceUpdate]);

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    const selectedSess = sessions.find((s) => s.id === id);
    if (!selectedSess) return;

    if (selectedSess.agentId) {
      setCurrentAgentId(selectedSess.agentId);
    }
  };

  // 新建会话:OpenClaw Agent 生成 UUID session key,Hermes 走本地
  const handleCreateSession = async (agentId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const agent = AGENTS[agentId];
        const isOpenClaw = agent?.runtime === "openclaw";

        let sessionId: string;
        if (isOpenClaw) {
          // OpenClaw: 生成 UUID session key,Gateway 在首条消息时自动创建
          const uuid = crypto.randomUUID
            ? crypto.randomUUID()
            : "nexus-" +
              Date.now() +
              "-" +
              Math.random().toString(36).slice(2, 8);
          // 格式对齐 Gateway session key: agent:<agent>:nexus:<uuid>
          const agentKey =
            agentId === "openclaw-main"
              ? "main"
              : agentId.replace("openclaw-", "");
          sessionId = `agent:${agentKey}:nexus:${uuid}`;
        } else {
          sessionId = "session-" + Date.now();
        }

        const newSess: ChatSession = {
          id: sessionId,
          title: "新对话",
          messages: [],
          createdAt: new Date().toISOString(),
          agentId: agentId,
        };

        setSessions((prev) => [newSess, ...prev]);
        setActiveSessionId(sessionId);
        setCurrentAgentId(agentId);
        setTimeout(() => inputRef.current?.focus(), 150);
        resolve();
      }, 300);
    });
  };

  // 重命名会话
  const handleRenameConfirm = (newName: string) => {
    const { sessionId } = renameModalState;
    if (!sessionId) return;

    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, title: newName } : s));
      return updated;
    });
  };

  const handleAgentSwitch = (newAgentId: string) => {
    setCurrentAgentId(newAgentId);
    setActiveSessionId(null);
  };

  // Active Session context object
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Triggering text submission
  const handleSubmitMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating || !activeSessionId || !activeSession)
      return;

    const userMessage: Message = {
      id: "msg-user-" + Date.now(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    // Append to messages list
    const updatedMessages = [...activeSession.messages, userMessage];

    // Determine default dialog title
    let title = activeSession.title;
    if (activeSession.messages.length === 0) {
      // First message defines session header text nicely
      title = input.length > 25 ? input.slice(0, 25) + "..." : input;
    }

    const updatedSession: ChatSession = {
      ...activeSession,
      title,
      messages: updatedMessages,
    };

    // Update frontend state immediately for blazing fast responsive inputs
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? updatedSession : s)),
    );
    setInput("");

    // Create a temporary placeholder message for SSE printing output
    const assistantPlaceholderId = "msg-assistant-" + Date.now();
    const assistantPlaceholder: Message = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString(),
    };

    const finalSessionWithAss = {
      ...updatedSession,
      messages: [...updatedMessages, assistantPlaceholder],
    };

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? finalSessionWithAss : s)),
    );

    setIsGenerating(true);
    resetRetry(); // Reset before new attempt

    // 🔌 真实管线:fetch → 阿里云 /api/chat → Tailscale → MacBook Gateway
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({
            role,
            content,
          })),
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          errDetail = errBody.error || errBody.detail || errDetail;
        } catch {}
        throw new Error(errDetail);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("响应流不可用");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      // 🔥 打字机特效循环:逐块读取 SSE → 实时更新 AI 气泡
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const rawData = trimmed.slice(6);
          if (rawData === "[DONE]") continue;

          try {
            const parsed = JSON.parse(rawData);

            // Gateway 返回的错误
            if (parsed.error) {
              accumulatedText += `\n\n⚠️ ${parsed.error.message || parsed.error}`;
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id !== activeSessionId) return s;
                  return {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantPlaceholderId
                        ? { ...m, content: accumulatedText }
                        : m,
                    ),
                  };
                }),
              );
              continue;
            }

            // 标准 OpenAI delta.content 聚合
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulatedText += delta;
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id !== activeSessionId) return s;
                  return {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantPlaceholderId
                        ? { ...m, content: accumulatedText }
                        : m,
                    ),
                  };
                }),
              );
            }
          } catch {
            // 忽略不完整的 JSON chunk(SSE 分包所致)
          }
        }
      }

      // 处理残留缓冲区
      if (buffer.trim().startsWith("data: ")) {
        const trimmedData = buffer.trim().slice(6);
        if (trimmedData !== "[DONE]") {
          try {
            const parsed = JSON.parse(trimmedData);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) accumulatedText += delta;
          } catch {}
        }
      }

      // 完成:写入最终内容
      const finalContent =
        accumulatedText ||
        "⚠️ MacBook Gateway 返回了空内容,请检查 AI 服务状态。";

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            messages: s.messages.map((m) =>
              m.id === assistantPlaceholderId
                ? { ...m, content: finalContent }
                : m,
            ),
          };
        }),
      );
    } catch (err: any) {
      console.error("💥 管线中断:", err);
      const errorMsg = `\n\n❌ **管线中断**\n\n无法将指令转发至 MacBook Gateway(\`100.83.118.16:18789\`)。\n\n> 🩺 诊断:\`${err?.message || err}\`\n> 🔧 请确认:Tailscale 在线 + Gateway 进程存活。`;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            messages: s.messages.map((m) =>
              m.id === assistantPlaceholderId
                ? { ...m, content: errorMsg }
                : m,
            ),
          };
        }),
      );
    }

    setIsGenerating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage();
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? "dark" : ""}`}>
      {/* Desktop Sidebar */}
      <div className="relative z-20 flex-shrink-0 hidden md:flex flex-col w-[320px] bg-zinc-50/50 dark:bg-[#1e1f20] border-r border-zinc-200 dark:border-[#333538] h-full backdrop-blur-md">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          currentAgentId={currentAgentId}
          isDarkMode={isDarkMode}
          openclawAgents={openclawAgents}
          onAgentSwitch={handleAgentSwitch}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onRenameSession={(id, currentName) => setRenameModalState({ open: true, sessionId: id, currentName })}
          onOpenWizard={() => setIsWizardOpen(true)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 shadow-2xl md:hidden"
            >
              <Sidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                currentAgentId={currentAgentId}
                isDarkMode={isDarkMode}
                openclawAgents={openclawAgents}
                onAgentSwitch={(id) => {
                  handleAgentSwitch(id);
                  setIsMobileSidebarOpen(false);
                }}
                onSelectSession={(id) => {
                  handleSelectSession(id);
                  setIsMobileSidebarOpen(false);
                }}
                onCreateSession={async (id) => {
                  await handleCreateSession(id);
                  setIsMobileSidebarOpen(false);
                }}
                onRenameSession={(id, currentName) => {
                  setRenameModalState({ open: true, sessionId: id, currentName });
                  setIsMobileSidebarOpen(false);
                }}
                onOpenWizard={() => {
                  setIsWizardOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 bg-white/10 dark:bg-[#131314] backdrop-blur-[6px] h-full overflow-hidden">
        {/* Dynamic header bar containing connection credentials */}
        <header className="min-h-[4rem] py-2 md:py-0 flex flex-wrap items-center justify-between px-4 md:px-8 gap-y-2 gap-x-4 bg-white/20 dark:bg-[#131118]/80 backdrop-blur-md border-b border-zinc-200/20 dark:border-[#333538] z-30 select-none">
          <div className="flex items-center flex-wrap gap-1 md:gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden mr-1 p-2 -ml-2 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 md:gap-2.5 pl-1">
              <div
                className="flex items-center justify-center w-6 h-6 rounded-md shadow-sm border border-black/5 dark:border-white/5"
                style={{
                  backgroundColor: AGENTS[currentAgentId]?.color + "20",
                  color: AGENTS[currentAgentId]?.color,
                }} // 20 is approx 12% opacity in hex
              >
                <span className="text-sm leading-none">
                  {AGENTS[currentAgentId]?.emoji}
                </span>
              </div>
              <h2 className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white font-sans flex items-center flex-wrap gap-x-2 gap-y-0.5">
                <span className="whitespace-nowrap">{AGENTS[currentAgentId]?.name}</span>
                <span className="text-zinc-300 dark:text-zinc-700 font-normal">
                  /
                </span>
                <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 line-clamp-1">
                  {
                    AGENTS[currentAgentId]?.description
                      ?.split(",")[0]
                      .split(" · ")[0]
                  }
                </span>
              </h2>
            </div>
            {/* Visual separator line (like Google AI Studio layout) */}
            <div className="hidden md:block h-5 w-[1px] bg-zinc-200 dark:bg-zinc-800/80 mx-2 self-center" />
          </div>

          <div className="flex items-center gap-3">
            <ControlCenter
              networkOk={!networkError}
              linkBrowserToNode={true}
              linkNodeToTunnel={true}
              linkTunnelToMac={!networkError}
              activeAgentName={AGENTS[currentAgentId]?.name || "智能神经元"}
              activeAgentEmoji={AGENTS[currentAgentId]?.emoji || "🧠"}
              activeAgentReady={!!(AGENTS[currentAgentId]?.active && !AGENTS[currentAgentId]?.placeholder)}
              cpuUsage={controlCenterMetrics.cpuUsage}
              memoryUsage={controlCenterMetrics.memoryUsage}
              temperature={controlCenterMetrics.temperature}
              uptime={controlCenterMetrics.uptime}
            />

            {/* Network advice exclamation mark trigger */}
            <div className="relative font-sans flex items-center justify-center" ref={adviceRef}>
              <button
                onClick={() => setIsAdviceOpen(!isAdviceOpen)}
                onMouseEnter={() => setHoveredAdvice(true)}
                onMouseLeave={() => setHoveredAdvice(false)}
                className={`relative p-1.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                  (isAdviceOpen || hoveredAdvice)
                    ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    : "text-zinc-450 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#333538]/50 dark:hover:text-zinc-200"
                }`}
                aria-label="网络接入建议"
                title="网络接入建议"
              >
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </button>

              <AnimatePresence>
                {(isAdviceOpen || hoveredAdvice) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className="absolute right-0 top-full mt-2.5 w-[280px] md:w-[320px] bg-white dark:bg-[#1e1f20] border border-zinc-200 dark:border-[#333538] rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.4)] z-[9999] p-4 text-left pointer-events-auto"
                  >
                    <div className="flex gap-2.5">
                      <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <div className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                        <strong className="text-zinc-900 dark:text-zinc-150 font-semibold font-sans">网络接入建议:</strong>
                        <span className="font-sans">
                          本应用程序通过内置的 Tailscale 专用隧道,将智能会话操作直接委托给您的远程 MacBook 宿主机(基于接口地址 <code>100.83.118.16:8000</code>)。如果提示词未正常响应,请务必确认您的本地 Mac 运行守护进程正常工作。
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => {
                const newTheme = !isDarkMode;
                setIsDarkMode(newTheme);
                document.documentElement.classList.toggle("dark", newTheme);
                localStorage.setItem("hermes_color_theme", newTheme ? "dark" : "light");
              }}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors shadow-none cursor-pointer"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-zinc-500" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-500" />
              )}
            </button>
          </div>
        </header>

        {/* Modal for Network Errors */}
        <AnimatePresence>
          {showNetworkErrorModal && networkError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowNetworkErrorModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-[#1e1f20] border border-zinc-200/50 dark:border-[#333538] rounded-2xl p-6 shadow-2xl max-w-sm w-full flex flex-col gap-5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                        连接异常
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        多智能体网关通信失败
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNetworkErrorModal(false)}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-zinc-50 dark:bg-[#131314] border border-zinc-200/50 dark:border-[#333538] p-4 rounded-xl">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 font-mono tracking-tight leading-relaxed">
                    {networkError}
                  </p>
                  {isRetrying && (
                    <p className="text-xs text-rose-500 mt-2 font-mono">
                      (正在尝试重新连接... 第 {retryCount} 次)
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setShowNetworkErrorModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
                  >
                    忽略
                  </button>
                  <button
                    onClick={async () => {
                      resetRetry();
                      await testConnection();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98]"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
                    />
                    重新连接
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic content core (Tab switching on mobile, multi-column desktop bento layout) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel Column */}
          <div
            className={`flex-1 relative h-full flex flex-col bg-zinc-50/30 dark:bg-[#131314] ${
              activeTab === "chat" ? "flex" : "hidden md:flex"
            }`}
          >
            {AGENTS[currentAgentId]?.placeholder ? (
              <AgentPlaceholder
                agentName={AGENTS[currentAgentId]?.name || "Agent"}
              />
            ) : (
              <>
                {/* Scroll Zone */}
                <div
                  ref={chatContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto py-6 pb-44 scrollbar-thin relative flex flex-col w-full"
                >
                  <div className="w-[95%] md:w-[90%] xl:w-[80%] max-w-none mx-auto flex flex-col flex-1 space-y-6">
                    {activeSession && activeSession.messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-5 pt-12 pb-16 select-none min-h-[55vh]">
                      <div
                        className="h-14 w-14 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-center text-2xl shadow-sm"
                        style={{ borderColor: AGENTS[currentAgentId]?.color }}
                      >
                        {AGENTS[currentAgentId]?.emoji}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-zinc-800 dark:text-white font-sans tracking-tight flex items-center justify-center gap-2">
                          {AGENTS[currentAgentId]?.name}
                          {AGENTS[currentAgentId]?.placeholder ||
                          !AGENTS[currentAgentId]?.active ? (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-normal tracking-normal border border-zinc-200 dark:border-zinc-700">
                              未接入
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-normal tracking-normal border border-emerald-200/50 dark:border-emerald-800/50">
                              已就绪
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
                          {AGENTS[currentAgentId]?.placeholder ||
                          !AGENTS[currentAgentId]?.active
                            ? "该 Agent 尚未接入,请完成配置后开始使用"
                            : AGENTS[currentAgentId]?.personality?.greeting}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 flex-1 flex flex-col pb-20 w-full">
                      <AnimatePresence initial={false}>
                        {activeSession?.messages.map((msg) => {
                          const isUser = msg.role === "user";
                          const msgAgent =
                            AGENTS[activeSession?.agentId || "hermes"];
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 15, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.97 }}
                              transition={{ duration: 0.22, ease: "easeOut" }}
                              className={`flex gap-3.5 w-full md:max-w-[90%] xl:max-w-[85%] ${
                                isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                              }`}
                            >
                              {/* Avatar */}
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold text-[10px] shrink-0 select-none ${
                                  isUser
                                    ? "bg-zinc-100 text-zinc-700"
                                    : "bg-blue-50 text-blue-600"
                                }`}
                              >
                                {isUser ? (
                                  <User className="w-3.5 h-3.5 text-zinc-500" />
                                ) : (
                                  <span className="text-base">
                                    {msgAgent?.emoji}
                                  </span>
                                )}
                              </div>

                              {/* Content block */}
                              <div className="space-y-1 max-w-[85%]">
                                <div className="flex items-center gap-2 px-1 text-zinc-400 text-[9px] uppercase tracking-wider font-mono">
                                  <span className="font-bold text-zinc-500 dark:text-zinc-400">
                                    {isUser
                                      ? "本地用户"
                                      : `${msgAgent?.emoji} ${msgAgent?.name}`}
                                  </span>
                                  <span>•</span>
                                  <span>{msg.timestamp}</span>
                                </div>

                                {isUser ? (
                                  <div
                                    className="px-5 py-3 rounded-2xl bg-[#f0f4f9] dark:bg-[#303134] text-[13px] leading-relaxed text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/20 dark:border-zinc-700/50 [&_p]:!text-zinc-900 dark:[&_p]:!text-zinc-100 [&_ul]:!text-zinc-900 dark:[&_ul]:!text-zinc-100 [&_ol]:!text-zinc-900 dark:[&_ol]:!text-zinc-100 [&_li]:!text-zinc-900 dark:[&_li]:!text-zinc-100 [&_strong]:!text-zinc-950 dark:[&_strong]:!text-white [&_h1]:!text-zinc-950 dark:[&_h1]:!text-white [&_h2]:!text-zinc-950 dark:[&_h2]:!text-white [&_h3]:!text-zinc-950 dark:[&_h3]:!text-white [&_h4]:!text-zinc-950 dark:[&_h4]:!text-white [&_h5]:!text-zinc-950 dark:[&_h5]:!text-white [&_h6]:!text-zinc-950 dark:[&_h6]:!text-white"
                                  >
                                    <MarkdownRenderer content={msg.content} />
                                  </div>
                                ) : !msg.content && (isGenerating || msg.id === "mock-generating") ? (
                                  /* Gorgeous Active Loading Card using the beautiful RefStyleMockup design system */
                                  <div className="space-y-4 w-full flex-col flex items-start max-w-full">
                                    <AIGeneratingState agentName={msgAgent?.name || "Hermes"} />
                                    {msg.id === "mock-generating" && (
                                      <div className="pt-2 transition-all">
                                        <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-2.5 px-1 tracking-wider uppercase flex items-center gap-1.5 select-none">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                                          ❖ 与高保真交互参考图对比 (对比预览)
                                        </div>
                                        <RefStyleMockup />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Standard Assistant message with pristine glassmorphic border and background */
                                  <div className="space-y-3 w-full max-w-full">
                                    <div
                                      className="text-[13px] leading-relaxed text-zinc-900"
                                    >
                                      <MarkdownRenderer content={msg.content} />
                                    </div>
                                    {msg.id === "mock-completed" && (
                                      <div className="pt-1 transition-all">
                                        <RefStyleMockup />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                  </div>
                </div>

                {/* Bottom Dock Input Zone */}
                <div className="absolute bottom-0 left-0 right-0 pt-16 pb-4 md:pb-6 px-4 md:px-6 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent dark:from-[#131314] dark:via-[#131314]/95 dark:to-transparent z-10">
                  {!activeSessionId ? (
                    <div className="flex items-center justify-center py-4 select-none">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-500/80 bg-zinc-100 dark:bg-zinc-900/50 px-6 py-2.5 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
                        🔒 请在左侧列表中选择或新建一个会话以开始
                      </span>
                    </div>
                  ) : (
                    /* [OpenClaw 接驳点]:此处绑定 handleSubmitMessage 发送逻辑 */
                    <form
                      onSubmit={handleSubmitMessage}
                      className="w-[95%] md:w-[85%] xl:w-[75%] max-w-5xl mx-auto relative group animate-fade-in"
                    >
                      <div className="mb-2.5 px-1 text-center sm:text-right select-none text-[10px] text-zinc-450 dark:text-zinc-400 font-normal font-sans">
                        按{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-[#333538] bg-zinc-50 dark:bg-zinc-900/60 font-mono text-[9px]">
                          Enter
                        </kbd>{" "}
                        发送消息,按{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-[#333538] bg-zinc-50 dark:bg-zinc-900/60 font-mono text-[9px]">
                          Shift + Enter
                        </kbd>{" "}
                        录入换行。
                      </div>

                      {/* Outer boundary layer which manages linear glowing border (synced with AIGeneratingState) */}
                      <div className="relative p-[1.5px] rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.25)] bg-zinc-200/60 dark:bg-[#333538] group-hover:bg-zinc-300/60 dark:group-hover:bg-[#434548] focus-within:bg-zinc-400 dark:focus-within:bg-zinc-500 transition-all duration-300">
                        {/* Inner elegant layout with pure white background */}
                        <div className="relative z-10 flex items-center gap-3 bg-white/95 dark:bg-[#1e1f20]/95 backdrop-blur-md rounded-[23px] px-5 py-2.5 transition duration-300">

                          {/* Text input zone */}
                          <textarea
                            ref={inputRef}
                            rows={Math.min(6, input.split('\n').length || 1)}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            placeholder={
                              AGENTS[currentAgentId]?.placeholder ||
                              !AGENTS[currentAgentId]?.active
                                ? `${AGENTS[currentAgentId]?.alias} 尚未接入,无法发送消息`
                                : `Describe an app and let Gemini do the rest`
                            }
                            className="flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none min-h-[24px]"
                            disabled={
                              isGenerating ||
                              !!(
                                AGENTS[currentAgentId]?.placeholder ||
                                !AGENTS[currentAgentId]?.active
                              )
                            }
                          />

                          {/* Submit Trigger (Arrow Send) */}
                          <div className="flex items-center gap-2 shrink-0 self-end mb-0.5 select-none">
                            <ModelSelector />
                            <motion.button
                              type="submit"
                              disabled={
                                !input.trim() ||
                                isGenerating ||
                                !!(
                                  AGENTS[currentAgentId]?.placeholder ||
                                  !AGENTS[currentAgentId]?.active
                                )
                              }
                              whileHover={
                                input.trim() && !isGenerating
                                  ? { scale: 1.05 }
                                  : {}
                              }
                              whileTap={
                                input.trim() && !isGenerating
                                  ? { scale: 0.95 }
                                  : {}
                              }
                              className={`flex items-center justify-center p-2 rounded-full border text-xs font-semibold select-none transition-all duration-200 ${
                                input.trim() &&
                                !isGenerating &&
                                !(
                                  AGENTS[currentAgentId]?.placeholder ||
                                  !AGENTS[currentAgentId]?.active
                                )
                                  ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:shadow-xs cursor-pointer"
                                  : "bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-600 border-zinc-200/10 dark:border-zinc-800/10 cursor-not-allowed"
                              }`}
                              title="发送"
                            >
                              {isGenerating ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </form>
                  )}
                </div>

                {/* Scroll to Bottom Button */}
                <AnimatePresence>
                  {showScrollToBottom && (
                    <motion.button
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={scrollToBottom}
                      className="absolute bottom-32 right-6 md:right-10 z-[15] p-2.5 rounded-xl bg-white dark:bg-white text-zinc-600 dark:text-zinc-700 shadow-[0_4px_14px_rgba(0,0,0,0.15)] border border-zinc-200/60 dark:border-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-100 hover:text-blue-600 dark:hover:text-blue-600 transition-colors"
                      aria-label="回到底部"
                      title="回到底部"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>


        </div>

        {/* Floating background trace bar for complete full-screen routing metrics */}
        <div className="hidden xl:block bg-zinc-100/50 dark:bg-[#131114] border-t border-zinc-200/30 dark:border-[#333538]/50 py-2">
          <div className="w-[95%] md:w-[90%] xl:w-[80%] max-w-none mx-auto px-1 md:px-0">
            <NetworkStatusBar />
          </div>
        </div>
      </div>

      {/* Render Agent Wizard */}
      <AnimatePresence>
        {isWizardOpen && (
          <AgentWizard
            onClose={() => setIsWizardOpen(false)}
            onComplete={async (newAgent) => {
              try {
                const response = await fetch("/api/agents", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(newAgent),
                });
                if (response.ok) {
                  const savedAgent = await response.json();
                  AGENTS[savedAgent.id] = savedAgent;
                  setForceUpdate((p) => p + 1);
                  setIsWizardOpen(false);

                  // Setup floating Green success Toast notice
                  const toastId = Date.now().toString();
                  setToast({
                    id: toastId,
                    message: `✅ ${savedAgent.name} 已接入节点网络`,
                  });
                  setTimeout(() => {
                    setToast((curr) => (curr?.id === toastId ? null : curr));
                  }, 3000);
                }
              } catch (e) {
                console.error("Failed to create agent", e);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating success feedback Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl bg-emerald-500/90 dark:bg-emerald-600/95 backdrop-blur-md text-white font-sans text-xs font-semibold shadow-lg border border-emerald-400/20 dark:border-emerald-500/20 flex items-center gap-2 whitespace-nowrap"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Rename Session Modal */}
      <RenameSessionModal
        open={renameModalState.open}
        currentName={renameModalState.currentName}
        onConfirm={handleRenameConfirm}
        onClose={() => setRenameModalState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
