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
  X
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import MarkdownRenderer from "./components/MarkdownRenderer";
import AgentWizard from "./components/AgentWizard";
import {
  HardwareTelemetryCard,
  QuickActionsCard,
  NetworkStatusBar
} from "./components/MacTelemetry";
import { AgentPlaceholder } from "./components/AgentPlaceholder";
import { Message, ChatSession, OpenClawSession, Agent, AGENTS } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { useRetry } from "./hooks/useRetry";

export default function App() {
  // Theme state - default to false (Light Theme)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // States for chat
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pinging, setPinging] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"chat" | "telemetry">("chat");

  // Multi-Agent Gateway routing states
  const [currentAgentId, setCurrentAgentId] = useState<string>("hermes");
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [showNetworkErrorModal, setShowNetworkErrorModal] = useState<boolean>(false);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  
  // ── OpenClaw Gateway 实时会话同步状态 ──
  const [gatewaySessions, setGatewaySessions] = useState<OpenClawSession[]>([]);
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [loadingSessionHistory, setLoadingSessionHistory] = useState(false);

  // ── SSE 连接：实时接收 OpenClaw Gateway 会话列表 ──
  useEffect(() => {
    let es: EventSource | null = null;
    let rt: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (es) { es.close(); es = null; }
      es = new EventSource("/api/openclaw/sessions/stream");
      es.addEventListener("init", (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data);
          if (d.sessions) { setGatewaySessions(d.sessions); setGatewayConnected(true); }
        } catch (_) {}
      });
      es.addEventListener("status", (e: MessageEvent) => {
        try { setGatewayConnected(!!JSON.parse(e.data).connected); } catch (_) {}
      });
      es.onerror = () => {
        setGatewayConnected(false);
        es?.close(); es = null;
        rt = setTimeout(connect, 5000);
      };
    }
    connect();
    return () => { es?.close(); if (rt) clearTimeout(rt); };
  }, []);

  // ── 将 Gateway Session 转为 ChatSession 格式 ──
  const gatewayToChatSession = (gs: OpenClawSession): ChatSession => ({
    id: gs.key,
    title: gs.label || gs.displayName || gs.key.split(":").pop() || "Untitled",
    messages: [],
    createdAt: new Date(gs.updatedAt || Date.now()).toISOString(),
    agentId: "openclaw",
    sessionKey: gs.key,
    kind: gs.kind,
    channel: gs.channel,
    label: gs.label,
    model: gs.model,
    totalTokens: gs.totalTokens,
    estimatedCostUsd: gs.estimatedCostUsd,
    lastMessagePreview: gs.lastMessagePreview,
    updatedAt: gs.updatedAt,
  });

  const { executeWithRetry, isRetrying, retryCount, resetRetry } = useRetry();

  // Test connection to MacBook
  const testConnection = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("/api/health", { signal: controller.signal });
      clearTimeout(timeout);
      
      const data = await res.json();
      if (data.reachable) {
        setNetworkError(null);
      } else {
        setNetworkError("MacBook 不可达，请检查网络连接");
      }
      return data.reachable;
    } catch {
      setNetworkError("无法连接到本地服务器");
      return false;
    }
  };

  // initial check
  useEffect(() => {
    testConnection();
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load agents from backend
  useEffect(() => {
    async function loadAgents() {
      try {
        const response = await fetch("/api/agents");
        if (response.ok) {
          const data = await response.json();
          // clear and replace AGENTS with latest
          for (let key in AGENTS) delete AGENTS[key];
          data.forEach((a: any) => { AGENTS[a.id] = a; });
          setForceUpdate(p => p + 1);
        }
      } catch (err) {
        console.error("Express /api/agents inaccessible:", err);
      }
    }
    loadAgents();
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

  // Load chat session list - Gateway sessions for OpenClaw, local history for others
  useEffect(() => {
    if (currentAgentId === "openclaw") {
      // Use Gateway sessions for OpenClaw agent
      const gwChatSessions = gatewaySessions.map(gatewayToChatSession);
      setSessions(gwChatSessions);
      
      const savedActiveId = localStorage.getItem("hermes_active_session_id_openclaw");
      if (gwChatSessions.length > 0) {
        if (savedActiveId && gwChatSessions.some((s: any) => s.id === savedActiveId)) {
          setActiveSessionId(savedActiveId);
        } else {
          setActiveSessionId(gwChatSessions[0].id);
          localStorage.setItem("hermes_active_session_id_openclaw", gwChatSessions[0].id);
        }
      } else {
        setActiveSessionId(null);
      }
    } else {
      // Local history.json for other agents (Hermes, Claude, etc.)
      async function loadSessions() {
        try {
          const response = await fetch(`/api/history?agentId=${currentAgentId}`);
          if (response.ok) {
            const data = await response.json();
            setSessions(data);
            const savedActiveId = localStorage.getItem(`hermes_active_session_id_${currentAgentId}`);
            if (data.length > 0) {
              if (savedActiveId && data.some((s: any) => s.id === savedActiveId)) {
                setActiveSessionId(savedActiveId);
              } else {
                setActiveSessionId(data[0].id);
                localStorage.setItem(`hermes_active_session_id_${currentAgentId}`, data[0].id);
              }
            } else {
              createSession([], "自动创建的初始会话");
            }
          }
        } catch (err) {
          console.error("Express /api/history inaccessible. Bootstrapping client fallback:", err);
          const mockSess: ChatSession = {
            id: "local-first-run",
            title: "Hermes 智能代理入门指南",
            agentId: currentAgentId,
            messages: [{
              id: "welcome-1",
              role: "assistant",
              content: "### 欢迎使用您的尊享版 Hermes 智能体控制台！\n\n本系统作为一个先进的对端模型，直接在您的目标工作区编译并运行。\n\n- **实时流式响应启用**：通过真实的 HTTP Server-Sent Events (SSE) 代理技术驱动。\n- **精心雕琢的 Bento 仪表盘**：右侧的 Bento 功能区展示了硬件遥测实时数据及快捷操作指令。\n- **今天有什么我可以帮您的？** 欢迎向我提问关于编写代码、系统脚本或者系统架构等指令！",
              timestamp: new Date().toLocaleTimeString()
            }],
            createdAt: new Date().toISOString()
          };
          setSessions([mockSess]);
          setActiveSessionId("local-first-run");
        }
      }
      loadSessions();
    }
  }, [currentAgentId, gatewaySessions]);

  // Save selected session back to local storage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(`hermes_active_session_id_${currentAgentId}`, activeSessionId);
    }
  }, [activeSessionId, currentAgentId]);

  // Handle scrolling of chat container
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId, isGenerating]);

  // Helper function to update history with backend Express API
  const syncSessionToBackend = async (session: ChatSession) => {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session)
      });
    } catch (err) {
      console.warn("Could not sync session to Express storage:", err);
    }
  };

  // Helper to construct a new chat session state
  const createSession = (initialMessages: Message[] = [], customTitle?: string, specificAgentId?: string) => {
    const nextId = "session-" + Date.now();
    const aId = specificAgentId || currentAgentId;
    const newSess: ChatSession = {
      id: nextId,
      title: customTitle || "新对话主题",
      messages: initialMessages,
      createdAt: new Date().toISOString(),
      agentId: aId
    };

    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(nextId);
    setCurrentAgentId(aId);
    syncSessionToBackend(newSess);
    
    // Auto focus input
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const handleAgentSwitch = (newAgentId: string) => {
    setCurrentAgentId(newAgentId);
    const agentSessions = sessions.filter((s) => (s.agentId || "hermes") === newAgentId);
    if (agentSessions.length > 0) {
      setActiveSessionId(agentSessions[0].id);
    } else {
      createSession([], "新对话主题", newAgentId);
    }
  };

  // Switch Active Dialogue - loads Gateway session history if needed
  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id);
    const selectedSess = sessions.find(s => s.id === id);
    if (selectedSess) {
      if (selectedSess.agentId) setCurrentAgentId(selectedSess.agentId);
      
      // If this is a Gateway session without loaded history, fetch it
      if (selectedSess.sessionKey && selectedSess.messages.length === 0) {
        setLoadingSessionHistory(true);
        try {
          const res = await fetch(`/api/openclaw/sessions/history?sessionKey=${encodeURIComponent(selectedSess.sessionKey)}&limit=200`);
          if (res.ok) {
            const data = await res.json();
            const msgs: Message[] = (data.messages || []).map((m: any, i: number) => ({
              id: `gw-${selectedSess.id}-${i}`,
              role: m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : "assistant",
              content: m.content || "",
              timestamp: m.timestamp || "",
            }));
            // Update session with loaded messages
            setSessions(prev => prev.map(s =>
              s.id === id ? { ...s, messages: msgs } : s
            ));
          }
        } catch (err) {
          console.error("Failed to load session history:", err);
        } finally {
          setLoadingSessionHistory(false);
        }
      }
    }
  };

  // Delete Conversation session hook
  const handleDeleteSession = async (id: string) => {
    const isCurrentActive = activeSessionId === id;
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);

    // Sync deletion to back-end REST
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Backend request failed to delete session:", err);
    }

    if (filtered.length > 0) {
      if (isCurrentActive) {
        setActiveSessionId(filtered[0].id);
      }
    } else {
      createSession([], "自动回收的对话会话");
    }
  };

  const handleNewSessionButton = (agentId?: string) => {
    createSession([], `对话会话 ${sessions.length + 1}`, agentId);
  };

  // Active Session context object
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Triggering text submission
  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || !activeSessionId || !activeSession) return;

    const userMessage: Message = {
      id: "msg-user-" + Date.now(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString()
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
      messages: updatedMessages
    };

    // Update frontend state immediately for blazing fast responsive inputs
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? updatedSession : s))
    );
    setInput("");
    syncSessionToBackend(updatedSession);

    // Create a temporary placeholder message for SSE printing output
    const assistantPlaceholderId = "msg-assistant-" + Date.now();
    const assistantPlaceholder: Message = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString()
    };

    const finalSessionWithAss = {
      ...updatedSession,
      messages: [...updatedMessages, assistantPlaceholder]
    };

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? finalSessionWithAss : s))
    );

    setIsGenerating(true);
    resetRetry(); // Reset before new attempt

    try {
      // Send fetch POST to client server side proxy
      const response = await executeWithRetry(() => {
        return fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map(({ role, content }) => ({ role, content })),
            temperature: 0.7,
            agent_id: currentAgentId
          })
        });
      });

      if (!response.ok) {
        throw new Error(`Proxy gateway error (HTTP Status: ${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Local proxy stream unreachable.");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      // Stream evaluation loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Retain the final incomplete chunk segment in our buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data: ")) {
            const rawData = trimmed.slice(6);
            if (rawData === "[DONE]") continue;

            try {
              const parsed = JSON.parse(rawData);

              // Capture server side VM connection diagnostics returned from SSE proxy
              if (parsed.error) {
                accumulatedText += `\n\n**[Connection Diagnostics Info]**:\n${parsed.error}`;
                setSessions((prev) =>
                  prev.map((s) => {
                    if (s.id !== activeSessionId) return s;
                    return {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantPlaceholderId
                          ? { ...m, content: accumulatedText }
                          : m
                      )
                    };
                  })
                );
                continue;
              }

              // Normal completion tokens aggregation
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
                          : m
                      )
                    };
                  })
                );
              }
            } catch (jsonErr) {
              // Gracefully bypass line-splitting JSON evaluation errors on partial chunks
            }
          }
        }
      }

      // Finish parsing residue buffer if any exists
      if (buffer.trim().startsWith("data: ")) {
        const trimmedData = buffer.trim().slice(6);
        if (trimmedData !== "[DONE]") {
          try {
            const parsed = JSON.parse(trimmedData);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulatedText += delta;
            }
          } catch (e) {}
        }
      }

      // Synced finish state
      const finalCompletedSession: ChatSession = {
        ...updatedSession,
        messages: [
          ...updatedMessages,
          {
            ...assistantPlaceholder,
            content: accumulatedText || "*服务端返回内容为空。请仔细检查您的目标 MacBook 上的其它大模型后台服务是否已正确绑定并就绪于 8000 端口。*"
          }
        ]
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? finalCompletedSession : s))
      );
      syncSessionToBackend(finalCompletedSession);

    } catch (err: any) {
      console.error("Dialogue failure:", err);
      // Construct detailed troubleshooting context directly within the conversation window
      const errorFallbackText = `\n\n❌ **对端网关桥接离线**\n\n无法成功将您的提示指令转发到位于 \`100.83.118.16:8000\` 的远程大语言模型服务器。\n\n* **诊断详情信息**: \`${err?.message || err}\`\n* **推荐排查指引**: 请确认您的 Tailscale 隧道客户端连接状态是否通畅。如有必要，可点击右侧 Bento 快捷指令面板中的 **“重启 Llama 模型服务”** 按钮来重新载入对端服务进程。`;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            messages: s.messages.map((m) =>
              m.id === assistantPlaceholderId
                ? { ...m, content: errorFallbackText }
                : m
            )
          };
        })
      );
    } finally {
      setIsGenerating(false);
      // Focus element
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage(e);
    }
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-500 bg-[#fbfbfd] dark:bg-[#09090b] text-[#1d1d1f] dark:text-[#f5f5f7] font-sans selection:bg-blue-500/20 relative`}>
      {/* Dynamic blurred organic gradient circles beneath the premium frosted elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-15 z-0 select-none">
        <div className="absolute top-[45%] left-[55%] -translate-x-1/2 w-[45%] h-[45%] rounded-full bg-purple-200 dark:bg-purple-800/20 blur-[110px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[55%] h-[55%] rounded-full bg-emerald-250 dark:bg-emerald-900/10 blur-[120px]" />
      </div>

      {/* 1. Left Sidebar Component */}
      <div className="hidden md:flex h-full select-none shrink-0 z-10">
        <Sidebar
          key={forceUpdate ? "1" : "0"} // forces Sidebar to re-render when new agent is added
          sessions={sessions}
          activeSessionId={activeSessionId}
          currentAgentId={currentAgentId}
          gatewayConnected={gatewayConnected}
          loadingSessionHistory={loadingSessionHistory}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSessionButton}
          onDeleteSession={handleDeleteSession}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onAgentSwitch={handleAgentSwitch}
          onOpenWizard={() => setIsWizardOpen(true)}
        />
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10 bg-white/30 dark:bg-zinc-950/20">
        {/* Dynamic header bar containing connection credentials */}
        <header className="h-16 flex items-center justify-between px-8 bg-white/30 dark:bg-zinc-950/20 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-800/40 z-10 select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pl-1">
              <div 
                className="flex items-center justify-center w-6 h-6 rounded-md shadow-sm border border-black/5 dark:border-white/5" 
                style={{ backgroundColor: AGENTS[currentAgentId]?.color + '20', color: AGENTS[currentAgentId]?.color }} // 20 is approx 12% opacity in hex
              >
                <span className="text-sm leading-none">{AGENTS[currentAgentId]?.emoji}</span>
              </div>
              <h2 className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white font-sans flex items-center gap-2">
                {AGENTS[currentAgentId]?.name} 
                <span className="text-zinc-300 dark:text-zinc-700 font-normal">/</span> 
                <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                   {AGENTS[currentAgentId]?.description?.split('，')[0].split(' · ')[0]}
                </span>
              </h2>
              {networkError ? (
                <button
                  type="button"
                  onClick={() => setShowNetworkErrorModal(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 ml-2 rounded-full text-[13px] font-bold font-sans border shadow-md bg-rose-500 dark:bg-rose-600 border-rose-600 dark:border-rose-700 text-white hover:bg-rose-600 dark:hover:bg-rose-500 transition-all animate-pulse hover:animate-none hover:scale-105 active:scale-95"
                >
                  <AlertTriangle className="w-4 h-4" />
                  异常详情
                </button>
              ) : AGENTS[currentAgentId]?.active && !AGENTS[currentAgentId]?.placeholder ? (
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 ml-1 rounded-full text-[10px] font-mono border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/30 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  在线
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 ml-1 rounded-full text-[10px] font-mono border bg-zinc-50/50 dark:bg-zinc-900/20 border-zinc-200/30 dark:border-zinc-800/30 text-zinc-500 dark:text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                  未接入
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Small tab switcher for mobile/desktop layout fluidity */}
            <div className="flex md:hidden bg-zinc-100 dark:bg-zinc-900 rounded-lg p-0.5 border border-zinc-200/40 dark:border-zinc-805/40">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${
                  activeTab === "chat"
                    ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                智能对话
              </button>
              <button
                onClick={() => setActiveTab("telemetry")}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${
                  activeTab === "telemetry"
                    ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                控制台监测
              </button>
            </div>

            {/* General latency checker simulation */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-450 dark:text-zinc-500 font-mono">
              {currentAgentId === "openclaw" ? (
                <>
                  <div className={`w-2 h-2 rounded-full ${gatewayConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  <span>{gatewayConnected ? "🐂 牛马在线" : "Gateway 断连"}</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span>中转网关在线</span>
                </>
              )}
            </div>
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
                className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-2xl max-w-sm w-full flex flex-col gap-5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">连接异常</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">多智能体网关通信失败</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNetworkErrorModal(false)}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="bg-zinc-50 dark:bg-[#121215] border border-zinc-200/50 dark:border-zinc-800 p-4 rounded-xl">
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
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
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
            className={`flex-1 flex flex-col justify-between h-full bg-white dark:bg-[#0e0e11] ${
              activeTab === "chat" ? "flex" : "hidden md:flex"
            }`}
          >
            {currentAgentId === 'openclaw' && !gatewayConnected && sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium">正在连接 OpenClaw Gateway...</p>
                <p className="text-xs">等待 100.83.118.16:18789 响应</p>
              </div>
            ) : (
              <>
                {/* Scroll Zone */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin"
                >
                  {/* Optional connection state banner */}
                  <div className="p-3.5 rounded-xl bg-amber-50/30 dark:bg-amber-950/5 border border-amber-100/10 dark:border-amber-950/10 text-amber-800 dark:text-amber-400 text-[11px] flex gap-3 leading-relaxed shadow-3xs">
                    <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <div className="font-sans font-medium">
                      <strong>网络接入建议：</strong>本应用程序通过内置的 Tailscale 专用隧道，将智能会话操作直接委托给您的远程 MacBook 宿主机（基于接口地址 <code>100.83.118.16:8000</code>）。如果提示词未正常响应，请务必确认您的本地 Mac 运行守护进程正常工作。
                    </div>
                  </div>

                  {loadingSessionHistory && activeSession ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <p className="text-sm font-medium">正在加载会话历史...</p>
                      <p className="text-xs text-zinc-500">{activeSession.title}</p>
                    </div>
                  ) : activeSession && activeSession.messages.length === 0 && !loadingSessionHistory ? (
                    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center space-y-5 pt-12 select-none">
                      <div className="h-14 w-14 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-center text-2xl shadow-sm" style={{ borderColor: AGENTS[currentAgentId]?.color }}>
                        {AGENTS[currentAgentId]?.emoji}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-zinc-800 dark:text-white font-sans tracking-tight flex items-center justify-center gap-2">
                          {AGENTS[currentAgentId]?.name}
                          {AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active ? (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-normal tracking-normal border border-zinc-200 dark:border-zinc-700">未接入</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-normal tracking-normal border border-emerald-200/50 dark:border-emerald-800/50">已就绪</span>
                          )}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
                          {AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active
                            ? "该 Agent 尚未接入，请完成配置后开始使用"
                            : AGENTS[currentAgentId]?.personality?.greeting}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <AnimatePresence initial={false}>
                        {activeSession?.messages.map((msg) => {
                          const isUser = msg.role === "user";
                          const msgAgent = AGENTS[activeSession?.agentId || "hermes"];
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 15, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.97 }}
                              transition={{ duration: 0.22, ease: "easeOut" }}
                              className={`flex gap-3.5 max-w-4xl ${
                                isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                              }`}
                            >
                              {/* Avatar */}
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center border font-semibold text-[10px] shrink-0 shadow-2xs select-none ${
                                  isUser
                                    ? "bg-zinc-100 dark:bg-zinc-850 border-zinc-200/50 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-250"
                                    : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200/50 dark:border-zinc-800/50"
                                }`}
                              >
                                {isUser ? <User className="w-3.5 h-3.5 text-zinc-500" /> : <span className="text-base">{msgAgent?.emoji}</span>}
                              </div>

                              {/* Content block */}
                              <div className="space-y-1 max-w-[85%]">
                                <div className="flex items-center gap-2 px-1 text-zinc-400 text-[9px] uppercase tracking-wider font-mono">
                                  <span className="font-bold text-zinc-500 dark:text-zinc-400">
                                    {isUser ? "本地用户" : `${msgAgent?.emoji} ${msgAgent?.name}`}
                                  </span>
                                  <span>•</span>
                                  <span>{msg.timestamp}</span>
                                </div>

                                <div
                                  style={{ borderLeftColor: !isUser ? msgAgent?.color : undefined, borderLeftWidth: !isUser ? '2px' : undefined }}
                                  className={`px-4.5 py-3 rounded-2xl border text-xs leading-relaxed ${
                                    isUser
                                      ? "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-100/30 dark:border-zinc-850/10 text-zinc-800 dark:text-zinc-250 shadow-3xs"
                                      : "bg-white dark:bg-[#16161b] border-[#e4e4e7]/20 dark:border-zinc-800/20 text-zinc-800 dark:text-zinc-200 shadow-xs"
                                  }`}
                                >
                                  <MarkdownRenderer content={msg.content} />
                                  {isGenerating && !msg.content && (
                                    <div className="flex items-center gap-1.5 py-1 text-zinc-400 text-xs font-mono select-none">
                                      <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                      <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                      <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                      <span className="ml-1 text-[10px]">正在解析响应 data stream...</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Bottom Dock Input Zone */}
                <div className="p-4 md:p-6 bg-transparent">
                  <form onSubmit={handleSubmitMessage} className="max-w-2xl mx-auto relative group">
                    <div className="relative flex items-center bg-white dark:bg-[#16161b] border border-[#e4e4e7]/50 dark:border-zinc-800/40 focus-within:border-zinc-300 dark:focus-within:border-zinc-700/80 focus-within:ring-4 focus-within:ring-zinc-900/5 dark:focus-within:ring-zinc-100/5 shadow-md rounded-2xl transition duration-300 px-5 py-2">
                      <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          !activeSessionId 
                            ? "新建对话以开始发送消息..." 
                            : AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active
                            ? `${AGENTS[currentAgentId]?.alias} 尚未接入，无法发送消息`
                            : `向 ${AGENTS[currentAgentId]?.name} 发送消息...`
                        }
                        className="flex-1 max-h-32 resize-none bg-transparent py-2.5 pr-12 text-xs leading-relaxed text-zinc-900 dark:text-zinc-150 placeholder:text-zinc-400 dark:placeholder:text-zinc-505 focus:outline-none"
                        disabled={isGenerating || !activeSessionId || !!(AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active)}
                      />

                      {/* Submission triggers */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 select-none">
                        <motion.button
                          type="submit"
                          disabled={!input.trim() || isGenerating || !activeSessionId || !!(AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active)}
                          whileHover={input.trim() && !isGenerating && activeSessionId && !(AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active) ? { scale: 1.08, y: -0.5 } : {}}
                          whileTap={input.trim() && !isGenerating && activeSessionId && !(AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active) ? { scale: 0.92 } : {}}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                          className={`relative flex items-center justify-center h-8 w-8 rounded-xl text-white dark:text-zinc-950 font-bold transition duration-200 cursor-pointer ${
                            input.trim() && !isGenerating && activeSessionId && !(AGENTS[currentAgentId]?.placeholder || !AGENTS[currentAgentId]?.active)
                              ? "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 scale-100 shadow-sm"
                              : "bg-zinc-100 dark:bg-zinc-850 text-zinc-350 dark:text-zinc-600 scale-95 cursor-not-allowed"
                          }`}
                          aria-label="发送消息"
                          title="发送消息"
                        >
                          {isGenerating ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          )}
                        </motion.button>
                      </div>
                    </div>

                    <div className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-500 font-normal font-sans select-none">
                      按 <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800/40 bg-white/60 dark:bg-zinc-900/60 font-mono text-[9px]">Enter</kbd> 发送消息，按 <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800/40 bg-white/60 dark:bg-zinc-900/60 font-mono text-[9px]">Shift + Enter</kbd> 录入换行。
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* 5. Right Telemetry Bento Column Layout */}
          <div
            className={`w-full md:w-96 shrink-0 border-l border-zinc-200/50 dark:border-zinc-800/40 p-5 bg-zinc-100/40 dark:bg-zinc-950/10 space-y-5 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-250 dark:scrollbar-thumb-zinc-850 select-none ${
              activeTab === "telemetry" ? "block" : "hidden lg:block"
            }`}
          >
            {/* Header section representing the Bento Hub metadata */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/50 dark:border-zinc-800/40">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-sans">
                  目标节点关键遥测指标
                </h3>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                Bento 监控台概览
              </span>
            </div>

            {/* Mac Hardware Telemetry widget */}
            <HardwareTelemetryCard />

            {/* Quick Actions grid widget shortcuts */}
            <QuickActionsCard />

            {/* Bottom status layout flow */}
            <div className="bg-white/50 dark:bg-zinc-900/40 p-4.5 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl">
              <div className="flex items-start gap-3">
                <Layers className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-zinc-805 dark:text-zinc-200 font-sans">
                    底层安全传输架构
                  </h4>
                  <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 mt-1">
                    本系统中所有的模型补全与流式读取，均直接通过 Express 的流式反向代理中间件实现，响应处理延迟低于 50ms 且不产生任何敏感秘钥数据泄露。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating background trace bar for complete full-screen routing metrics */}
        <div className="hidden xl:block bg-zinc-100/50 dark:bg-zinc-950/40 border-t border-zinc-200/30 dark:border-zinc-900/10 px-6 py-2">
          <NetworkStatusBar />
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
                  body: JSON.stringify(newAgent)
                });
                if (response.ok) {
                  const savedAgent = await response.json();
                  AGENTS[savedAgent.id] = savedAgent;
                  setForceUpdate(p => p + 1);
                  setIsWizardOpen(false);

                  // Setup floating Green success Toast notice
                  const toastId = Date.now().toString();
                  setToast({ id: toastId, message: `✅ ${savedAgent.name} 已接入节点网络` });
                  setTimeout(() => {
                    setToast(curr => curr?.id === toastId ? null : curr);
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
    </div>
  );
}
