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

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 1500) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export default function App() {
  // Theme state - default to false (Light Theme)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pinging, setPinging] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"chat" | "telemetry">("chat");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  
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
    if (token) {
      // 🔍 Auth Debug: 打印当前 Token 前 30 字符 + 剩余时长，便于排查 401
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const remainingMs = payload.exp * 1000 - Date.now();
        const remainingMin = Math.round(remainingMs / 60000);
        console.log("[Auth Debug] Token preview:", token.substring(0, 30) + "...", "| role:", payload.role, "| expires in:", remainingMin > 0 ? `${remainingMin}min` : "EXPIRED");
      } catch {
        console.warn("[Auth Debug] Token present but cannot decode jwt payload");
      }
      return { Authorization: `Bearer ${token}` };
    }
    console.warn("[Auth Debug] No token in localStorage — sending request without Authorization header");
    return {};
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

  const handleLogout = (reason?: string) => {
    localStorage.removeItem("nexus_token");
    setIsAdmin(false);
    if (reason) {
      setLoginError(reason);
    }
  };

  // ── 思考态:SSE 流中实时解析 <think> 标签 ──
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [reasoningText, setReasoningText] = useState<string>("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // ── 无限滚动分页状态 ──
  const [currentHistoryPage, setCurrentHistoryPage] = useState<number>(1);
  const [hasMoreHistory, setHasMoreHistory] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const { executeWithRetry, isRetrying, retryCount, resetRetry } = useRetry();

  // ── 思考标签实时解析器:从累积文本中分离 <think> 与正式回答 ──
  const parseThinkingState = (text: string): {
    isThinking: boolean;
    reasoningText: string;
    displayContent: string;
  } => {
    const thinkOpen = text.indexOf("<think>");
    if (thinkOpen === -1) {
      return { isThinking: false, reasoningText: "", displayContent: text };
    }
    const thinkClose = text.indexOf("</think>", thinkOpen + 7);
    if (thinkClose === -1) {
      // 仍在思考态中
      const reasoning = text.substring(thinkOpen + 7);
      const display = text.substring(0, thinkOpen);
      return { isThinking: true, reasoningText: reasoning, displayContent: display };
    }
    // 思考已结束:提取思考文本 + 正式回答
    const reasoning = text.substring(thinkOpen + 7, thinkClose);
    const before = text.substring(0, thinkOpen);
    const after = text.substring(thinkClose + 8);
    return { isThinking: false, reasoningText: reasoning, displayContent: before + after };
  };

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

  // ── 全局 fetch 拦截器：统一处理 401，自动触发 logout ──
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const response = await originalFetch(...args);
        // 任何 fetch 返回 401 都触发强制登出（排除 /api/auth/login）
        if (response.status === 401) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
          if (!url.includes('/api/auth/login')) {
            console.warn('[Auth Guard] 401 detected on:', url, '→ forcing logout');
            localStorage.removeItem('nexus_token');
            setIsAdmin(false);
            setLoginError('会话凭证已失效，请重新输入管理员密码');
          }
        }
        return response;
      } catch (err) {
        throw err;
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

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

  // 🔐 页面加载时主动调用服务端 /api/auth/verify 验证 Token 有效性
  // 防止「幽灵 Token」：客户端 JWT 解析通过（role=ADMIN, exp 未到期）
  // 但服务端 JWT_SECRET 已变更导致验签失败 → 所有 API 返回 401
  useEffect(() => {
    const token = localStorage.getItem("nexus_token");
    if (!token) return; // 未登录，不需要验证

    // 先做客户端快速检查
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 <= Date.now()) {
        // token 已过期，直接清除
        console.warn("[Auth Verify] Token expired client-side, clearing");
        localStorage.removeItem("nexus_token");
        setIsAdmin(false);
        setLoginError("会话已过期，请重新登录");
        return;
      }
    } catch {
      console.warn("[Auth Verify] Token malformed, clearing");
      localStorage.removeItem("nexus_token");
      setIsAdmin(false);
      return;
    }

    // 调用服务端验证端点
    fetch("/api/auth/verify", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          console.warn("[Auth Verify] Token rejected by server (status:" + res.status + ") → clearing ghost token");
          localStorage.removeItem("nexus_token");
          setIsAdmin(false);
          setLoginError("会话凭证已失效（服务端验证失败），请重新登录");
        } else {
          console.log("[Auth Verify] Token validated successfully by server ✅");
        }
      })
      .catch((err) => {
        // 网络错误不强制登出（可能是离线），保留 token 等恢复后重试
        console.warn("[Auth Verify] Cannot reach server for token verification:", err.message);
      });
  }, []);

  // Handle scrolling of chat container (auto-scroll to bottom, skip when loading history)
  useEffect(() => {
    if (chatContainerRef.current && !isLoadingHistory) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId, isGenerating, isLoadingHistory]);

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

        // ── 2. OpenClaw 会话：从 Gateway 100% 实时拉取（不读本地 history.json）──
        try {
          const clawRes = await fetch("/api/openclaw/sessions");
          if (clawRes.ok) {
            const clawSessions = await clawRes.json();
            const mappedClawSessions: ChatSession[] = clawSessions.map(
              (cs: any) => {
                // 根据 agentId 映射到前端的 agent_id
                let frontendAgentId = "openclaw-main";
                if (cs.agentId === "jianshen") frontendAgentId = "openclaw-jianshen";

                return {
                  id: cs.key,
                  title: cs.customTitle || cs.title || cs.label || cs.displayName || "未命名会话",
                  messages: [], // 消息按需实时拉取
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

    // 判断是否为 OpenClaw 远程会话
    const isRemote =
      AGENTS[selectedSess.agentId || ""]?.runtime === "openclaw" ||
      id.startsWith("agent:");

    if (isRemote) {
      // ✅ 每次点击都实时向 Gateway 拉取最新聊天记录(分页:第1页,30条/页)
      setCurrentHistoryPage(1);
      setHasMoreHistory(true);
      try {
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(id)}/history?page=1&limit=30`,
          { headers: { ...getAuthHeaders() } }
        );
        if (res.ok) {
          const history = await res.json();
          const rawMessages = Array.isArray(history.messages) ? history.messages : [];
          setHasMoreHistory(!!history.hasMore);
          const mappedMessages: Message[] = rawMessages.map((item: any) => {
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
                  content =
                    combined.length > 200
                      ? "💭 " + combined.slice(0, 200) + "..."
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
              ? new Date(ts).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return {
              id:
                item?.id ||
                `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: item?.role === "assistant" ? "assistant" : "user",
              content: content || "",
              timestamp: timeStr,
            };
          });

          setSessions((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, messages: mappedMessages } : s,
            ),
          );
        }
      } catch (err) {
        console.error("Failed to fetch session history:", err);
      }
    } else {
      // 本地 Agent:重置分页状态
      setCurrentHistoryPage(1);
      setHasMoreHistory(false);
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
  const handleRenameConfirm = async (newName: string) => {
    const { sessionId } = renameModalState;
    if (!sessionId) return;

    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, title: newName } : s));
      const renamedSession = updated.find((s) => s.id === sessionId);
      if (renamedSession && AGENTS[renamedSession.agentId || "hermes"]?.runtime !== "openclaw") {
        syncLocalSession(renamedSession);
      }
      return updated;
    });

    // 同步重命名到 Gateway
    try {
      const res = await fetch("/api/openclaw/sessions/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sessionId, newTitle: newName }),
      });
      if (!res.ok) {
        console.error("重命名 API 返回错误:", res.status);
      }
    } catch (err) {
      console.error("重命名请求失败（UI 已刷新，下次拉取恢复）:", err);
    }
  };

  // 本地会话持久化（仅 Hermes 等本地 Agent，OpenClaw 以 Gateway 为 Source of Truth）
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

    if (isGatewayOffline) return;

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

    // 本地持久化同步(仅 Hermes 本地会话)
    if (AGENTS[currentAgentId]?.runtime !== "openclaw") {
      syncLocalSession(updatedSession);
    }

    // Create a temporary placeholder message for SSE printing output
    const assistantPlaceholderId = "msg-assistant-" + Date.now();
    setStreamingMessageId(assistantPlaceholderId);
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

    // 🔍 发出请求前打印当前鉴权头（便于排查 401）
    console.log("[Auth Debug] Current Auth Headers:", getAuthHeaders());

    // ── 真实 SSE 流式通道:连接 /api/chat 代理到 Hermes/OpenClaw Gateway ──
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
        // 🔴 401 鉴权失败：立即清除假 Token 并强制退回登录界面
        if (response.status === 401) {
          handleLogout("会话凭证已失效，请重新输入管理员密码");
          throw new Error("鉴权失败：Token 已过期或无效，已强制退出登录");
        }
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

                // ── 实时解析 <think> 标签:思考态 ↔ 正式回答态动态切换 ──
                const { isThinking: thinking, reasoningText: reasoning, displayContent } =
                  parseThinkingState(accumulatedText);

                setIsThinking(thinking);
                setReasoningText(reasoning);

                setSessions((prev) =>
                  prev.map((s) => {
                    if (s.id !== activeSessionId) return s;
                    return {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantPlaceholderId
                          ? { ...m, content: displayContent }
                          : m,
                      ),
                    };
                  }),
                );
              }
            } catch (jsonErr) {
              // Gracefully bypass partial JSON chunks
            }
          }
        }
      }

      // Flush residue buffer
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

      // ── 阅后即焚:仅保留 displayContent,思考文本不入最终持久化 ──
      const finalParsed = parseThinkingState(accumulatedText);
      const cleanContent = finalParsed.displayContent || accumulatedText;

      // 清理思考态状态
      setIsThinking(false);
      setReasoningText("");
      setStreamingMessageId(null);

      const finalCompletedSession: ChatSession = {
        ...updatedSession,
        messages: [
          ...updatedMessages,
          {
            ...assistantPlaceholder,
            content:
              cleanContent ||
              "*服务端返回内容为空。请检查 MacBook 上的大模型后台服务是否已正确绑定 8000 端口。*",
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

      setIsThinking(false);
      setReasoningText("");
      setStreamingMessageId(null);

      const errorFallbackText = `\n\n❌ **对端网关桥接离线**\n\n无法成功将您的提示指令转发到位于 \`100.83.118.16:8000\` 的远程大语言模型服务器。\n\n* **诊断详情信息**: \`${err?.message || err}\`\n* **推荐排查指引**: 请确认您的 Tailscale 隧道客户端连接状态是否通畅。如有必要,可点击右侧 Bento 快捷指令面板中的 **"重启 Llama 模型服务"** 按钮来重新载入对端服务进程。`;

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
    }

    setIsGenerating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage();
    }
  };

  // ── 无限滚动:触顶加载更早的历史记录 + Scroll Anchoring 防跳 ──
  const handleChatScroll = async () => {
    const container = chatContainerRef.current;
    if (!container || isLoadingHistory || !hasMoreHistory || !activeSessionId) return;

    // 触顶阈值:scrollTop ≤ 5px
    if (container.scrollTop > 5) return;

    const activeSess = sessions.find((s) => s.id === activeSessionId);
    if (!activeSess) return;

    setIsLoadingHistory(true);
    const prevScrollHeight = container.scrollHeight;

    try {
      const nextPage = currentHistoryPage + 1;
      const res = await fetchWithTimeout(
        `/api/sessions/${encodeURIComponent(activeSessionId)}/history?page=${nextPage}&limit=30`,
        { headers: { ...getAuthHeaders() } },
        3000
      );
      if (!res.ok) throw new Error("Failed to fetch older history");

      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        const rawMessages: any[] = data.messages;
        // Gateway 返回最新在前 → 反转后 prepend
        const olderMessages: Message[] = rawMessages.reverse().map((item: any) => {
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
                  ? "💭 " + combined.slice(0, 200) + "..."
                  : "💭 " + combined;
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
        });

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s;
            return { ...s, messages: [...olderMessages, ...s.messages] };
          }),
        );

        setCurrentHistoryPage(nextPage);
        setHasMoreHistory(!!data.hasMore);

        // ── Scroll Anchoring:利用 scrollHeight 差值重置 scrollTop,防止画面跳动 ──
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop =
              chatContainerRef.current.scrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMoreHistory(false);
      }
    } catch (err) {
      console.error("Failed to load more history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // ── 鉴权守卫：未登录时渲染登录界面，禁止访问主聊天 ──
  if (!isAdmin) {
    return (
      <div className={`flex h-screen overflow-hidden ${isDarkMode ? "dark" : ""}`}>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#f0f4f9] via-white to-zinc-50 dark:from-[#0f0e13] dark:via-[#131118] dark:to-zinc-950 p-6">
          {/* 背景装饰 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-400/10 dark:bg-purple-500/5 rounded-full blur-3xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md"
          >
            {/* 品牌区域 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border border-blue-200/30 dark:border-blue-500/20 mb-4 shadow-sm">
                <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-sans">
                Nexus 节点机
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
                多智能体协作控制台 · 需要管理员认证
              </p>
            </div>

            {/* 登录卡片 */}
            <div className="bg-white/80 dark:bg-[#1a1820]/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-lg">
              {loginError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 text-red-700 dark:text-red-400 text-sm flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </motion.div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 tracking-wide">
                    管理员密码
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    placeholder="请输入管理员密码"
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLogin(e);
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!loginPassword.trim()}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    loginPassword.trim()
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:scale-[0.98] cursor-pointer"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  认证并进入控制台
                </button>
              </form>

              <p className="mt-4 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                Nexus 节点机 v5 · 仅限授权管理员访问
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? "dark" : ""}`}>
      {/* Desktop Sidebar */}
      <div className="relative z-20 flex-shrink-0 hidden md:flex flex-col w-[320px] bg-zinc-50/50 dark:bg-[#0f0e13]/80 border-r border-zinc-200 dark:border-zinc-800/80 h-full backdrop-blur-md">
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
      <div className="flex-1 flex flex-col min-w-0 relative z-10 bg-white/10 dark:bg-zinc-950/20 backdrop-blur-[6px] h-full overflow-hidden">
        {/* Dynamic header bar containing connection credentials */}
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
                        <strong className="text-zinc-900 dark:text-zinc-150 font-semibold font-sans">网络接入建议：</strong>
                        <span className="font-sans">
                          本应用程序通过内置的 Tailscale 专用隧道，将智能会话操作直接委托给您的远程 MacBook 宿主机（基于接口地址 <code>100.83.118.16:8000</code>）。如果提示词未正常响应，请务必确认您的本地 Mac 运行守护进程正常工作。
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

        {/* Dynamic content core (Tab switching on mobile, multi-column desktop bento layout) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel Column */}
          <div
            className={`flex-1 relative h-full bg-zinc-50/30 dark:bg-[#0f0e13]/10 ${
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
                  onScroll={handleChatScroll}
                  className="absolute inset-0 overflow-y-auto px-6 py-6 pb-44 space-y-6 scrollbar-thin flex flex-col"
                >
                  {/* Optional connection state banner */}
                  <div className="p-3.5 rounded-xl bg-amber-50/30 dark:bg-amber-950/5 border border-amber-100/10 dark:border-amber-950/10 text-amber-800 dark:text-amber-400 text-[11px] flex gap-3 leading-relaxed shadow-3xs">
                    <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <div className="font-sans font-medium">
                      <strong>网络接入建议:</strong>本应用程序通过内置的
                      Tailscale 专用隧道,将智能会话操作直接委托给您的远程
                      MacBook 宿主机(基于接口地址{" "}
                      <code>100.83.118.16:8000</code>
                      )。如果提示词未正常响应,请务必确认您的本地 Mac
                      运行守护进程正常工作。
                    </div>
                  </div>

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
                      {/* ── 无限滚动:顶部加载指示器 ── */}
                      {isLoadingHistory && (
                        <div className="flex items-center justify-center py-4 gap-2 text-zinc-400 dark:text-zinc-500 select-none">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[11px] font-mono">正在加载更早的对话记录...</span>
                        </div>
                      )}
                      <AnimatePresence initial={false}>
                        {(activeSession?.messages || []).filter((msg) => !msg.content.includes("上下文压缩")).map((msg, index) => {
                          const isUser = msg.role === "user";
                          const isCurrentlyGenerating = isGenerating && !isUser && index === (activeSession?.messages || []).filter((msg) => !msg.content.includes("上下文压缩")).length - 1;
                          const msgAgent =
                            AGENTS[activeSession?.agentId || "hermes"];

                          // ── 流式全包裹：只要还在生成，锁在 AIGeneratingState 流光框内，不渲染任何外部气泡容器 ──
                          if (isCurrentlyGenerating) {
                            return (
                              <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                              >
                                <AIGeneratingState
                                  agentName={msgAgent?.name || "Agent"}
                                  reasoningText={msg.content}
                                />
                              </motion.div>
                            );
                          }

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
                                    className="px-5 py-3 rounded-2xl bg-[#f0f4f9] text-[13px] leading-relaxed text-zinc-900"
                                  >
                                    <MarkdownRenderer content={msg.content} />
                                  </div>
                                ) : (
                                  /* 生成结束：华丽变身为正式 Markdown 气泡 */
                                  <div className="space-y-3 w-full max-w-xl">
                                    <div
                                      className="text-[13px] leading-relaxed text-zinc-900"
                                    >
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
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-transparent z-10">
                  {!activeSessionId ? (
                    <div className="flex items-center justify-center py-4 select-none">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-500/80 bg-zinc-100 dark:bg-zinc-900/50 px-6 py-2.5 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
                        🔒 请在左侧列表中选择或新建一个会话以开始
                      </span>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSubmitMessage}
                      className="w-[95%] md:w-[85%] xl:w-[75%] max-w-5xl mx-auto relative group animate-fade-in"
                    >
                      {/* Outer boundary layer which manages linear glowing border */}
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
                                ? `${AGENTS[currentAgentId]?.alias} 尚未接入，无法发送消息`
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

                      <div className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-500 font-normal font-sans select-none">
                        按{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800/40 bg-white/60 dark:bg-zinc-900/60 font-mono text-[9px]">
                          Enter
                        </kbd>{" "}
                        发送消息,按{" "}
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
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
