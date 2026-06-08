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
  X,
  Lock,
  Menu,
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import MarkdownRenderer from "./components/MarkdownRenderer";
import AgentWizard from "./components/AgentWizard";
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

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
  // v5.0 影子缓存：Gateway 离线降级标记
  const [isGatewayOffline, setIsGatewayOffline] = useState<boolean>(false);
  // ── 鉴权状态 ──
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const token = localStorage.getItem("nexus_token");
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role === "ADMIN" && payload.exp * 1000 > Date.now();
    } catch {
      localStorage.removeItem("nexus_token");
      return false;
    }
  });
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("nexus_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "认证失败");
        return;
      }
      localStorage.setItem("nexus_token", data.token);
      setIsAdmin(true);
      setLoginPassword("");
    } catch {
      setLoginError("网络错误，请重试");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("nexus_token");
    setIsAdmin(false);
  };

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
        setIsGatewayOffline(false); // Gateway 恢复，清除离线标记
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
          data.forEach((a: any) => {
            AGENTS[a.id] = a;
          });

          setForceUpdate((p) => p + 1);
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

  // Fetch all sessions：OpenClaw Agent 从 Gateway 实时拉取（Source of Truth），
  // Hermes 从本地 history.json 读取
  useEffect(() => {
    const fetchAllSessions = async () => {
      try {
        let allSessions: ChatSession[] = [];

        // ── 1. 本地 Hermes 会话 ──
        const historyRes = await fetch("/api/history");
        if (historyRes.ok) {
          const localSessions = await historyRes.json();
          allSessions = [...localSessions];
        }

        // ── 2. OpenClaw 会话：从 Gateway 100% 实时拉取 ──
        try {
          const clawRes = await fetch("/api/openclaw/sessions");
          if (clawRes.ok) {
            const clawSessions = await clawRes.json();
            const mappedClawSessions: ChatSession[] = clawSessions.map(
              (cs: any) => {
                let frontendAgentId = "openclaw-main";
                if (cs.agentId === "jianshen") frontendAgentId = "openclaw-jianshen";

                return {
                  id: cs.key,
                  title: cs.customTitle || cs.title || cs.label || cs.displayName || "未命名会话",
                  messages: [],
                  createdAt: cs.updatedAt
                    ? new Date(cs.updatedAt).toISOString()
                    : new Date().toISOString(),
                  agentId: frontendAgentId,
                };
              },
            );
            allSessions = [...allSessions, ...mappedClawSessions];
          }
        } catch (clawErr) {
          console.error("Gateway sessions unreachable:", clawErr);
        }

        // ── 3. 排序 ──
        allSessions.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        if (allSessions.length > 0) {
          setSessions(allSessions);
          const activeAgent =
            localStorage.getItem("hermes_current_agent_id") || "hermes";
          const savedActiveId = localStorage.getItem(
            `hermes_active_session_id_${activeAgent}`,
          );
          if (
            savedActiveId &&
            allSessions.some((s) => s.id === savedActiveId)
          ) {
            setActiveSessionId(savedActiveId);
          } else {
            setActiveSessionId(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      }
    };

    fetchAllSessions();
  }, [forceUpdate]);

  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id);
    const selectedSess = sessions.find((s) => s.id === id);
    if (!selectedSess) return;

    if (selectedSess.agentId) {
      setCurrentAgentId(selectedSess.agentId);
    }

    const isRemote =
      AGENTS[selectedSess.agentId || ""]?.runtime === "openclaw" ||
      id.startsWith("agent:");

    if (isRemote) {
      try {
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(id)}/history`,
        );
        if (res.ok) {
          const data = await res.json();
          const rawMessages = data.messages || (Array.isArray(data) ? data : []);
          const historySource: string = data.source || "gateway";

          if (historySource === "cache") {
            setIsGatewayOffline(true);
          } else {
            setIsGatewayOffline(false);
          }
          const mappedMessages: Message[] = rawMessages.map(
            (item: any) => {
              let content = "";
              const rawContent = item?.content;

              if (typeof rawContent === "string") {
                content = rawContent;
              } else if (Array.isArray(rawContent) && rawContent.length > 0) {
                const textBlocks = rawContent
                  .filter((b: any) => b?.type === "text" && b?.text)
                  .map((b: any) => b.text);

                if (textBlocks.length > 0) {
                  content = textBlocks.join("\n");
                } else {
                  const thinkingBlocks = rawContent
                    .filter((b: any) => b?.type === "thinking" && b?.thinking)
                    .map((b: any) => b.thinking);
                  if (thinkingBlocks.length > 0) {
                    const combined = thinkingBlocks.join(" ");
                    content = combined.length > 200
                      ? "💭 " + combined.slice(0, 200) + "…"
                      : "💭 " + combined;
                  } else {
                    const toolBlocks = rawContent
                      .filter((b: any) => b?.type === "toolCall" && b?.name)
                      .map((b: any) => `🔧 ${b.name}`);
                    content = toolBlocks.join(", ");
                  }
                }
              }

              const ts = item?.timestamp;
              const timeStr = ts
                ? new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
                : "";

              return {
                id: item?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: item?.role === "assistant" ? "assistant" : "user",
                content: content || "",
                timestamp: timeStr,
              };
            },
          );

          setSessions((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, messages: mappedMessages } : s,
            ),
          );
        }
      } catch (err) {
        console.error("Failed to fetch session history:", err);
      }
    }
  };

  const handleCreateSession = async (agentId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const agent = AGENTS[agentId];
        const isOpenClaw = agent?.runtime === "openclaw";

        let sessionId: string;
        if (isOpenClaw) {
          const uuid = crypto.randomUUID
            ? crypto.randomUUID()
            : "nexus-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
          const agentKey = agentId === "openclaw-main" ? "main" : agentId.replace("openclaw-", "");
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

  const syncLocalSession = async (session: ChatSession) => {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(session),
      });
    } catch (err) {
      console.error("Failed to sync local session:", err);
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s)),
    );

    try {
      const res = await fetch("/api/openclaw/sessions/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sessionId, newTitle }),
      });
      if (!res.ok) {
        console.error("重命名 API 返回错误:", res.status);
      }
    } catch (err) {
      console.error("重命名请求失败（UI 已刷新，下次拉取恢复）:", err);
    }
  };

  const handleAgentSwitch = (newAgentId: string) => {
    setCurrentAgentId(newAgentId);
    setActiveSessionId(null);
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || !activeSessionId || !activeSession)
      return;
    
    if (isGatewayOffline) return;

    const userMessage: Message = {
      id: "msg-user-" + Date.now(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    const updatedMessages = [...activeSession.messages, userMessage];

    let title = activeSession.title;
    if (activeSession.messages.length === 0) {
      title = input.length > 25 ? input.slice(0, 25) + "..." : input;
    }

    const updatedSession: ChatSession = {
      ...activeSession,
      title,
      messages: updatedMessages,
    };

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? updatedSession : s)),
    );
    setInput("");

    if (AGENTS[currentAgentId]?.runtime !== "openclaw") {
      syncLocalSession(updatedSession);
    }

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
    resetRetry();

    try {
      const response = await executeWithRetry(() => {
        return fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            messages: updatedMessages.map(({ role, content }) => ({
              role,
              content,
            })),
            temperature: 0.7,
            agent_id: currentAgentId,
            session_id: activeSessionId,
          }),
        });
      });

      if (!response.ok) {
        throw new Error(
          `Proxy gateway error (HTTP Status: ${response.status})`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Local proxy stream unreachable.");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data: ")) {
            const rawData = trimmed.slice(6);
            if (rawData === "[DONE]") continue;

            try {
              const parsed = JSON.parse(rawData);

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
                          : m,
                      ),
                    };
                  }),
                );
                continue;
              }

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
            } catch (jsonErr) {
              // bypass partial JSON parse errors
            }
          }
        }
      }

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

      const finalCompletedSession: ChatSession = {
        ...updatedSession,
        messages: [
          ...updatedMessages,
          {
            ...assistantPlaceholder,
            content:
              accumulatedText ||
              "*服务端返回内容为空。请仔细检查您的目标 MacBook 上的其它大模型后台服务是否已正确绑定并就绪于 8000 端口。*",
          },
        ],
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? finalCompletedSession : s)),
      );
      if (AGENTS[currentAgentId]?.runtime !== "openclaw") {
        syncLocalSession(finalCompletedSession);
      }
    } catch (err: any) {
      console.error("Dialogue failure:", err);
      const errorFallbackText = `\n\n❌ **对端网关桥接离线**\n\n无法成功将您的提示指令转发到位于 \`100.83.118.16:8000\` 的远程大语言模型服务器。\n\n* **诊断详情信息**: \`${err?.message || err}\`\n* **推荐排查指引**: 请确认您的 Tailscale 隧道客户端连接状态是否通畅。如有必要，可点击右侧 Bento 快捷指令面板中的 **"重启 Llama 模型服务"** 按钮来重新载入对端服务进程。`;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            messages: s.messages.map((m) =>
              m.id === assistantPlaceholderId
                ? { ...m, content: errorFallbackText }
                : m,
            ),
          };
        }),
      );
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage(e);
    }
  };

  return (
    <div
      className={`flex h-screen w-full overflow-hidden transition-all duration-500 bg-[#ffe6bf] dark:bg-[#110e0b] bg-gradient-to-tr from-[#ffe6bf]/80 via-[#e2fbeb]/70 to-[#c7f4ff]/80 dark:from-[#110e0b]/50 dark:via-[#0c0d10]/95 dark:to-[#0a1012]/50 text-[#1d1d1f] dark:text-[#f5f5f7] font-sans selection:bg-blue-500/20 relative`}
    >
      {/* Dynamic blurred organic gradient circles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.95] dark:opacity-40 z-0 select-none">
        <div className="absolute top-[-10%] left-[-5%] w-[65%] h-[65%] rounded-full bg-amber-200/50 dark:bg-amber-500/10 blur-[130px] animate-pulse" style={{ animationDuration: "10s" }} />
        <div className="absolute top-[15%] left-[30%] w-[60%] h-[60%] rounded-full bg-emerald-200/50 dark:bg-emerald-500/10 blur-[140px] animate-pulse" style={{ animationDuration: "12s", animationDelay: "2s" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[65%] rounded-full bg-cyan-200/50 dark:bg-sky-500/10 blur-[130px]" />
      </div>

      {/* 1. Left Sidebar Component */}
      <div className="hidden md:flex h-full select-none shrink-0 z-10">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          currentAgentId={currentAgentId}
          isDarkMode={isDarkMode}
          isAdmin={isAdmin}
          openclawAgents={openclawAgents}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onAgentSwitch={handleAgentSwitch}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onRenameSession={handleRenameSession}
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
                isAdmin={isAdmin}
                openclawAgents={openclawAgents}
                onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
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
                onRenameSession={async (id, newTitle) => {
                  await handleRenameSession(id, newTitle);
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
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10 bg-white/10 dark:bg-zinc-950/20 backdrop-blur-[6px]">
        {/* Dynamic header bar */}
        <header className="min-h-[4rem] py-2 md:py-0 flex flex-wrap items-center justify-between px-4 md:px-8 gap-y-2 gap-x-4 bg-white/20 dark:bg-[#131118]/30 backdrop-blur-md border-b border-zinc-200/20 dark:border-zinc-800/20 z-10 select-none">
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
                }}
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
                      ?.split("，")[0]
                      .split(" · ")[0]
                  }
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
              ) : isGatewayOffline ? (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 ml-2 rounded-full text-[13px] font-bold font-sans border shadow-md bg-amber-500 dark:bg-amber-600 border-amber-600 dark:border-amber-700 text-white animate-pulse">
                  📡 离线只读
                </div>
              ) : AGENTS[currentAgentId]?.active &&
                !AGENTS[currentAgentId]?.placeholder ? (
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
            {/* Small tab switcher for mobile */}
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

            {/* Network status + admin logout */}
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold font-sans border bg-zinc-100 dark:bg-zinc-800 border-zinc-200/50 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                >
                  登出
                </button>
              )}
              <div className="flex items-center gap-1.5 text-xs text-zinc-450 dark:text-zinc-500 font-mono">
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span>中转网关在线</span>
              </div>
            </div>
          </div>
        </header>

        {/* Network Error Modal */}
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

        {/* Dynamic content core */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel Column */}
          <div
            className={`flex-1 flex flex-col justify-between h-full bg-white/20 dark:bg-[#0c0c0e]/30 backdrop-blur-md ${
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
                  className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin"
                >
                  {/* Gateway Offline Banner */}
                  {isGatewayOffline && (
                    <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/10 border-2 border-amber-300/60 dark:border-amber-700/40 text-amber-800 dark:text-amber-300 text-[12px] flex gap-3 leading-relaxed shadow-md animate-pulse">
                      <span className="text-lg shrink-0">📡</span>
                      <div className="font-sans font-semibold space-y-1">
                        <p>Gateway 连接失败，当前处于<strong>离线只读模式</strong></p>
                        <p className="text-[11px] font-normal text-amber-600 dark:text-amber-400/80">
                          聊天记录来自本地影子缓存（MySQL），无法发送新消息。请检查 MacBook Tailscale 连接状态。
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Info banner */}
                  <div className="p-3.5 rounded-xl bg-amber-50/30 dark:bg-amber-950/5 border border-amber-100/10 dark:border-amber-950/10 text-amber-800 dark:text-amber-400 text-[11px] flex gap-3 leading-relaxed shadow-3xs">
                    <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <div className="font-sans font-medium">
                      <strong>网络接入建议：</strong>本应用程序通过内置的
                      Tailscale 专用隧道，将智能会话操作直接委托给您的远程
                      MacBook 宿主机（基于接口地址{" "}
                      <code>100.83.118.16:8000</code>
                      ）。如果提示词未正常响应，请务必确认您的本地 Mac
                      运行守护进程正常工作。
                    </div>
                  </div>

                  {activeSession && activeSession.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center space-y-5 pt-12 select-none">
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
                          const msgAgent =
                            AGENTS[activeSession?.agentId || "hermes"];
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
                                  <div className="px-6 py-4.5 rounded-3xl border border-white/60 dark:border-white/10 bg-white/80 dark:bg-[#1e1c26]/60 backdrop-blur-md text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 shadow-[0_4px_20px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.05)] hover:border-zinc-300/70 dark:hover:border-zinc-700/50 transition-all duration-300">
                                    <MarkdownRenderer content={msg.content} />
                                  </div>
                                ) : !msg.content && isGenerating ? (
                                  /* Loading state with gorgeous AIGeneratingState */
                                  <div className="space-y-4 w-full flex-col flex items-start max-w-xl">
                                    <AIGeneratingState agentName={msgAgent?.name || "Hermes"} />
                                  </div>
                                ) : (
                                  /* Standard Assistant message with glassmorphic border */
                                  <div className="space-y-3 w-full max-w-xl">
                                    <div className="px-6 py-4.5 rounded-3xl border border-white/80 dark:border-white/10 text-[13px] leading-relaxed bg-white/90 dark:bg-[#131118]/80 backdrop-blur-md text-zinc-800 dark:text-zinc-200 shadow-[0_4px_24px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-zinc-300 dark:hover:border-zinc-700/60 transition-all duration-300">
                                      <MarkdownRenderer content={msg.content} />
                                    </div>
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

                {/* Bottom Dock Input Zone */}
                <div className="p-4 md:p-6 bg-transparent">
                  {!activeSessionId ? (
                    <div className="flex items-center justify-center py-4 select-none">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-500/80 bg-zinc-100 dark:bg-zinc-900/50 px-6 py-2.5 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
                        🔒 请在左侧列表中选择或新建一个会话以开始
                      </span>
                    </div>
                  ) : isGatewayOffline ? (
                    <div className="flex items-center justify-center py-4 select-none">
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-6 py-2.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                        📡 Gateway 离线 · 只读模式 — 发送消息功能已暂停
                      </span>
                    </div>
                  ) : !isAdmin ? (
                    <div className="max-w-md mx-auto">
                      <form onSubmit={handleLogin} className="relative flex flex-col gap-3">
                        <div className="relative flex items-center bg-white dark:bg-[#16161b] border border-zinc-200/50 dark:border-zinc-800/40 focus-within:border-zinc-300 dark:focus-within:border-zinc-700/80 focus-within:ring-4 focus-within:ring-zinc-900/5 dark:focus-within:ring-zinc-100/5 shadow-md rounded-2xl transition duration-300 px-5 py-2">
                          <input
                            type="password"
                            value={loginPassword}
                            onChange={(e) => { setLoginPassword(e.target.value); setLoginError(""); }}
                            placeholder="请输入管理员密码"
                            className="flex-1 bg-transparent py-2.5 pr-20 text-xs leading-relaxed text-zinc-900 dark:text-zinc-150 placeholder:text-zinc-400 dark:placeholder:text-zinc-505 focus:outline-none"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <button
                              type="submit"
                              disabled={!loginPassword.trim()}
                              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                                loginPassword.trim()
                                  ? "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm cursor-pointer"
                                  : "bg-zinc-100 dark:bg-zinc-850 text-zinc-350 dark:text-zinc-600 cursor-not-allowed"
                              }`}
                            >
                              <Lock className="w-3 h-3" />
                              认证
                            </button>
                          </div>
                        </div>
                        {loginError && (
                          <p className="text-center text-[11px] text-red-500 dark:text-red-400 font-medium">{loginError}</p>
                        )}
                        <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 font-sans">
                          🔒 管理员认证后可发送消息和管理会话
                        </p>
                      </form>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSubmitMessage}
                      className="max-w-2xl mx-auto relative group"
                    >
                      <div className="relative flex items-center bg-white/70 dark:bg-[#131118]/85 backdrop-blur-md border border-zinc-200/40 dark:border-zinc-800/40 focus-within:border-zinc-350 dark:focus-within:border-zinc-700/80 focus-within:ring-4 focus-within:ring-zinc-900/5 dark:focus-within:ring-zinc-100/5 shadow-2xs rounded-2xl transition duration-300 px-5 py-2">
                        <textarea
                          ref={inputRef}
                          rows={1}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            AGENTS[currentAgentId]?.placeholder ||
                            !AGENTS[currentAgentId]?.active
                              ? `${AGENTS[currentAgentId]?.alias} 尚未接入，无法发送消息`
                              : `向 ${AGENTS[currentAgentId]?.name} 发送消息...`
                          }
                          className="flex-1 max-h-32 resize-none bg-transparent py-2.5 pr-12 text-xs leading-relaxed text-zinc-900 dark:text-zinc-150 placeholder:text-zinc-400 dark:placeholder:text-zinc-505 focus:outline-none"
                          disabled={
                            isGenerating ||
                            !!(
                              AGENTS[currentAgentId]?.placeholder ||
                              !AGENTS[currentAgentId]?.active
                            )
                          }
                        />

                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 select-none">
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
                              input.trim() &&
                              !isGenerating &&
                              !(
                                AGENTS[currentAgentId]?.placeholder ||
                                !AGENTS[currentAgentId]?.active
                              )
                                ? { scale: 1.08, y: -0.5 }
                                : {}
                            }
                            whileTap={
                              input.trim() &&
                              !isGenerating &&
                              !(
                                AGENTS[currentAgentId]?.placeholder ||
                                !AGENTS[currentAgentId]?.active
                              )
                                ? { scale: 0.92 }
                                : {}
                            }
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 15,
                            }}
                            className={`relative flex items-center justify-center h-8 w-8 rounded-xl text-white dark:text-zinc-950 font-bold transition duration-200 cursor-pointer ${
                              input.trim() &&
                              !isGenerating &&
                              !(
                                AGENTS[currentAgentId]?.placeholder ||
                                !AGENTS[currentAgentId]?.active
                              )
                                ? "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 scale-100 shadow-sm"
                                : "bg-zinc-100 dark:bg-zinc-850 text-zinc-350 dark:text-zinc-600 scale-95 cursor-not-allowed"
                            }`}
                            aria-label="发送消息"
                            title="发送消息"
                          >
                            {isGenerating ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                                />
                              </svg>
                            )}
                          </motion.button>
                        </div>
                      </div>

                      <div className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-500 font-normal font-sans select-none">
                        按{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800/40 bg-white/60 dark:bg-zinc-900/60 font-mono text-[9px]">
                          Enter
                        </kbd>{" "}
                        发送消息，按{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800/40 bg-white/60 dark:bg-zinc-900/60 font-mono text-[9px]">
                          Shift + Enter
                        </kbd>{" "}
                        录入换行。
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 5. Right Telemetry Bento Column Layout */}
          <div
            className={`w-full md:w-96 shrink-0 border-l border-zinc-200/20 dark:border-zinc-800/20 p-5 bg-white/10 dark:bg-[#131118]/25 backdrop-blur-md space-y-5 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-250 dark:scrollbar-thumb-zinc-850 select-none ${
              activeTab === "telemetry" ? "block" : "hidden lg:block"
            }`}
          >
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

            <HardwareTelemetryCard />
            <QuickActionsCard />

            <div className="bg-white/50 dark:bg-zinc-900/40 p-4.5 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl">
              <div className="flex items-start gap-3">
                <Layers className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-zinc-805 dark:text-zinc-200 font-sans">
                    底层安全传输架构
                  </h4>
                  <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 mt-1">
                    本系统中所有的模型补全与流式读取，均直接通过 Express
                    的流式反向代理中间件实现，响应处理延迟低于 50ms
                    且不产生任何敏感秘钥数据泄露。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating background trace bar */}
        <div className="hidden xl:block bg-zinc-100/50 dark:bg-zinc-950/40 border-t border-zinc-200/30 dark:border-zinc-900/10 px-6 py-2">
          <NetworkStatusBar />
        </div>
      </div>

      {/* Agent Wizard */}
      <AnimatePresence>
        {isWizardOpen && (
          <AgentWizard
            onClose={() => setIsWizardOpen(false)}
            onComplete={async (newAgent) => {
              try {
                const response = await fetch("/api/agents", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  body: JSON.stringify(newAgent),
                });
                if (response.ok) {
                  const savedAgent = await response.json();
                  AGENTS[savedAgent.id] = savedAgent;
                  setForceUpdate((p) => p + 1);
                  setIsWizardOpen(false);

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

      {/* Toast */}
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
