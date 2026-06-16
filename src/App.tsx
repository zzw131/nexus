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
import { useToast } from "./contexts/ToastContext";
import { PlayfulSessionLoader } from "./components/PlayfulSessionLoader";

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
  // agent_log 思考流状态（喂给极光框）
  const [reasoningText, setReasoningText] = useState<string>("");
  const [isThinkingUI, setIsThinkingUI] = useState<boolean>(false);
  const { addToast } = useToast();
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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

  const { executeWithRetry, isRetrying, retryCount, resetRetry } = useRetry();

  // Test connection to MacBook
  const testConnection = async () => {
    /* 注释后端请求，改用本地模拟
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
    */
    setNetworkError(null);
    return true;
  };

  // initial check
  useEffect(() => {
    testConnection();
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // 🔌 分页上滑加载：每个会话独立追踪游标 & 加载状态
  const [pageStateMap, setPageStateMap] = useState<Record<string, {
    hasMore: boolean;
    nextBefore: string | null;
    isLoadingOlder: boolean;
  }>>({});

  // Load agents from backend
  useEffect(() => {
    async function loadAgents() {
      /* 注释后端请求，改用本地模拟
      try {
        const response = await fetchWithTimeout("/api/agents", {}, 1500);
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
      */
      // 本地已经有默认 AGENTS，无需额外处理
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

  // Handle scrolling of chat container
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId, isGenerating]);

  // 🔌 上滑触顶侦测：IntersectionObserver 监听顶部哨兵锚点
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = chatContainerRef.current;
    if (!sentinel || !container || !activeSessionId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const pageState = pageStateMap[activeSessionId];
          if (pageState?.hasMore && !pageState?.isLoadingOlder) {
            loadOlderMessages(activeSessionId);
          }
        }
      },
      {
        root: container,
        rootMargin: "80px 0px 0px 0px", // 提前 80px 触发，更丝滑
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeSessionId, pageStateMap]);

  // 🔌 持久化穿透：从 Gateway + 本地 history.json 拉取真实会话列表
  useEffect(() => {
    const fetchAllSessions = async () => {
      try {
        setSessionsLoading(true);
        let allSessions: ChatSession[] = [];

        // ── 1. 本地 Hermes 会话（仅元数据，消息体分页懒加载）──
        try {
          const historyRes = await fetchWithTimeout("/api/history", {}, 1200);
          if (historyRes.ok) {
            const localMeta = await historyRes.json();
            const localSessions: ChatSession[] = localMeta.map((m: any) => ({
              id: m.id,
              title: m.title,
              messages: [],  // 空数组，点击会话时懒加载
              createdAt: m.createdAt,
              agentId: m.agentId || "hermes",
            }));
            allSessions = [...localSessions];
          }
        } catch (e) {
          console.error("Local history unavailable:", e);
        }

        // ── 2. OpenClaw 会话：从 Gateway 100% 实时拉取 ──
        try {
          const clawRes = await fetchWithTimeout("/api/sessions", {}, 2000);
          if (clawRes.ok) {
            const clawSessions = await clawRes.json();
            const mappedClawSessions: ChatSession[] = clawSessions.map(
              (cs: any) => {
                let frontendAgentId = "openclaw-main";
                if (cs.agentId === "jianshen")
                  frontendAgentId = "openclaw-jianshen";

                return {
                  id: cs.key,
                  title: cs.displayName || cs.label || "未命名会话",
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

        // ── 3. 排序：最新在前 ──
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
            setActiveSessionId(allSessions[0]?.id || null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        setSessionsLoading(false);
      }
    };

    fetchAllSessions();
  }, [forceUpdate]);

  const handleSelectSession = async (id: string) => {
    if (activeSessionId === id && !isSessionLoading) return;
    setIsSessionLoading(true);
    setActiveSessionId(id);
    const selectedSess = sessions.find((s) => s.id === id);
    if (!selectedSess) {
      setIsSessionLoading(false);
      return;
    }

    if (selectedSess.agentId) {
      setCurrentAgentId(selectedSess.agentId);
    }

    // 判断是否为 OpenClaw 远程会话
    const isRemote =
      AGENTS[selectedSess.agentId || ""]?.runtime === "openclaw" ||
      id.startsWith("agent:");

    if (isRemote) {
      // 🔌 分页加载：首次仅拉取最新 20 条，后续上滑触发懒加载
      try {
        const res = await fetchWithTimeout(
          `/api/sessions/${encodeURIComponent(id)}/history?limit=20`,
          {},
          3000
        );
        if (res.ok) {
          const data = await res.json();
          const rawMessages = data.messages || [];
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
                  content = combined.length > 200 ? "💭 " + combined.slice(0, 200) + "…" : "💭 " + combined;
                } else {
                  const toolBlocks = rawContent
                    .filter((b: any) => b?.type === "toolCall" && b?.name)
                    .map((b: any) => `🔧 ${b.name}`);
                  content = toolBlocks.join(", ");
                }
              }
            }
            const ts = item?.timestamp;
            return {
              id: item?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: item?.role === "assistant" ? "assistant" : "user",
              content: content || "",
              timestamp: ts
                ? new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
                : "",
            };
          });

          setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, messages: mappedMessages } : s)),
          );

          // 建立分页游标状态
          setPageStateMap((prev) => ({
            ...prev,
            [id]: {
              hasMore: data.hasMore ?? false,
              nextBefore: data.nextBefore ?? null,
              isLoadingOlder: false,
            },
          }));
        }
      } catch (err) {
        console.error("Failed to fetch session history:", err);
      }
    } else {
      // Hermes 本地会话：分页加载首屏消息
      try {
        const res = await fetchWithTimeout(
          `/api/history/${encodeURIComponent(id)}/messages?limit=20`,
          {},
          1500
        );
        if (res.ok) {
          const data = await res.json();
          setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, messages: data.messages || [] } : s)),
          );
          setPageStateMap((prev) => ({
            ...prev,
            [id]: {
              hasMore: data.hasMore ?? false,
              nextBefore: data.nextBefore ?? null,
              isLoadingOlder: false,
            },
          }));
        }
      } catch (err) {
        console.error("Failed to load local messages:", err);
      }
    }
    setIsSessionLoading(false);
  };

  // 新建会话：OpenClaw Agent 生成 UUID session key，Hermes 走本地
  const handleCreateSession = async (agentId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const agent = AGENTS[agentId];
        const isOpenClaw = agent?.runtime === "openclaw";

        let sessionId: string;
        if (isOpenClaw) {
          // OpenClaw: 生成 UUID session key，Gateway 在首条消息时自动创建
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

  // 🔌 持久化穿透：重命名会话 → 后端落盘
  const handleRenameConfirm = async (newName: string) => {
    const { sessionId } = renameModalState;
    if (!sessionId || !newName.trim()) return;
    
    const trimmedName = newName.trim();
    
    // 1. 先更新前端状态（乐观更新）
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, title: trimmedName } : s));
      const renamedSession = updated.find((s) => s.id === sessionId);
      if (renamedSession && AGENTS[renamedSession.agentId || "hermes"]?.runtime !== "openclaw") {
        syncLocalSession(renamedSession);
      }
      return updated;
    });

    addToast("success", `会话已成功重命名为 "${trimmedName}"！`);

    // 2. 🔌 OpenClaw 会话：持久化 rename 到后端 rename-map.json
    const sess = sessions.find((s) => s.id === sessionId);
    if (sess && AGENTS[sess.agentId || "hermes"]?.runtime === "openclaw") {
      try {
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/rename`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: trimmedName }),
          }
        );
        if (!res.ok) {
          console.error("Rename persist failed:", await res.text());
        }
      } catch (err) {
        console.error("Rename API unreachable:", err);
      }
    }
  };

  // 🔌 本地会话持久化（Hermes 等本地 Agent → history.json）
  const syncLocalSession = async (session: ChatSession) => {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
    } catch (err) {
      console.error("Failed to sync local session:", err);
    }
  };

  // 🔌 上滑加载更早消息（含滚动高度补偿，禁止跳动）
  const loadOlderMessages = async (sessionId: string) => {
    const pageState = pageStateMap[sessionId];
    if (!pageState?.hasMore || pageState?.isLoadingOlder) return;

    const sess = sessions.find((s) => s.id === sessionId);
    if (!sess) return;

    const isRemote =
      AGENTS[sess.agentId || "hermes"]?.runtime === "openclaw" ||
      sessionId.startsWith("agent:");

    // 标记加载中
    setPageStateMap((prev) => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], isLoadingOlder: true },
    }));

    // 📐 滚动补偿：记录当前 scrollHeight（DOM 更新前）
    const container = chatContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    try {
      let url: string;
      if (isRemote) {
        url = `/api/sessions/${encodeURIComponent(sessionId)}/history?limit=20`;
      } else {
        url = `/api/history/${encodeURIComponent(sessionId)}/messages?limit=20`;
      }
      if (pageState.nextBefore) {
        url += `&before=${encodeURIComponent(pageState.nextBefore)}`;
      }

      const res = await fetchWithTimeout(url, {}, isRemote ? 3000 : 1500);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const rawMessages: any[] = data.messages || [];

      if (rawMessages.length === 0) {
        setPageStateMap((prev) => ({
          ...prev,
          [sessionId]: { ...prev[sessionId], hasMore: false, isLoadingOlder: false },
        }));
        return;
      }

      // 映射消息格式（Gateway 消息需转换）
      let newMessages: Message[];
      if (isRemote) {
        newMessages = rawMessages.map((item: any) => {
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
                content = combined.length > 200 ? "💭 " + combined.slice(0, 200) + "…" : "💭 " + combined;
              } else {
                const toolBlocks = rawContent
                  .filter((b: any) => b?.type === "toolCall" && b?.name)
                  .map((b: any) => `🔧 ${b.name}`);
                content = toolBlocks.join(", ");
              }
            }
          }
          const ts = item?.timestamp;
          return {
            id: item?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: item?.role === "assistant" ? "assistant" : "user",
            content: content || "",
            timestamp: ts
              ? new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
              : "",
          };
        });
      } else {
        newMessages = rawMessages;
      }

      // unshift 旧消息到头部
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return { ...s, messages: [...newMessages, ...s.messages] };
        }),
      );

      // 📐 滚动补偿：DOM 更新后修正 scrollTop，禁止跳动
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const heightAdded = newScrollHeight - prevScrollHeight;
          container.scrollTop += heightAdded;
        }
      });

      setPageStateMap((prev) => ({
        ...prev,
        [sessionId]: {
          hasMore: data.hasMore ?? false,
          nextBefore: data.nextBefore ?? null,
          isLoadingOlder: false,
        },
      }));
    } catch (err: any) {
      console.error("loadOlderMessages failed:", err);
      setPageStateMap((prev) => ({
        ...prev,
        [sessionId]: { ...prev[sessionId], isLoadingOlder: false },
      }));
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

    // 本地持久化同步（仅 Hermes 本地会话）
    if (AGENTS[currentAgentId]?.runtime !== "openclaw") {
      syncLocalSession(updatedSession);
    }

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

    // ── 实时 SSE 流式管线（安全缓冲池 + agent_log 靶向注入）──
    let streamBuffer = ""; // 按 \n\n 切割，防范网络截断

    try {
      const response = await executeWithRetry(() => {
        return fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        throw new Error(`Proxy gateway error (HTTP Status: ${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream unreachable.");
      }

      const decoder = new TextDecoder();
      let accumulatedText = "";
      let firstContentReceived = false;

      // 启动极光思考框
      setIsThinkingUI(true);
      setReasoningText("");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });

        // 严格按 \n\n 切割完整 SSE 事件
        while (true) {
          const idx = streamBuffer.indexOf("\n\n");
          if (idx === -1) break;

          const rawEvent = streamBuffer.slice(0, idx);
          streamBuffer = streamBuffer.slice(idx + 2);

          const lines = rawEvent.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const rawData = trimmed.slice(6);
            if (rawData === "[DONE]") continue;

            try {
              const parsed = JSON.parse(rawData);

              // ── agent_log 靶向注入 → 极光框 ──
              if (parsed.agent_log) {
                setReasoningText(prev => prev + "\n" + parsed.agent_log);
                continue;
              }

              // ── 错误诊断 ──
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

              // ── 正文流式累加 + 极光框卸载 ──
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                if (!firstContentReceived) {
                  firstContentReceived = true;
                  setIsThinkingUI(false);
                }
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
              // 非 JSON 行静默跳过
            }
          }
        }
      }

      // ── 流结束，强制卸载极光框 ──
      setIsThinkingUI(false);

      // 尾部残余处理
      if (streamBuffer.trim().startsWith("data: ")) {
        const trimmedData = streamBuffer.trim().slice(6);
        if (trimmedData !== "[DONE]") {
          try {
            const parsed = JSON.parse(trimmedData);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) accumulatedText += delta;
          } catch (e) {}
        }
      }

      const finalCompletedSession: ChatSession = {
        ...updatedSession,
        messages: [
          ...updatedMessages,
          {
            ...assistantPlaceholder,
            content: accumulatedText || "*对端返回内容为空*",
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
      setIsThinkingUI(false);
      console.error("Dialogue failure:", err);
      const errorFallbackText = `\n\n❌ **对端网关桥接离线**\n\n无法成功将您的提示指令转发到远程大语言模型服务器。\n\n* **诊断详情信息**: \`${err?.message || err}\``;
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
                      ?.split("，")[0]
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
                    {isSessionLoading ? (
                      <PlayfulSessionLoader
                        agentName={AGENTS[currentAgentId]?.name || "Hermes 核心大脑"}
                        agentEmoji={AGENTS[currentAgentId]?.emoji || "🧠"}
                      />
                    ) : activeSession && activeSession.messages.length === 0 ? (
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
                            ? "该 Agent 尚未接入，请完成配置后开始使用"
                            : AGENTS[currentAgentId]?.personality?.greeting}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 flex-1 flex flex-col pb-20 w-full">
                      {/* 🔌 上滑加载指示器 + 顶部哨兵锚点 */}
                      <div
                        ref={topSentinelRef}
                        className="h-1 w-full shrink-0"
                        aria-hidden="true"
                      />
                      {pageStateMap[activeSessionId || ""]?.isLoadingOlder && (
                        <div className="flex items-center justify-center gap-2 py-3 text-zinc-400 select-none">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[11px] font-mono tracking-wide">加载更早的记录…</span>
                        </div>
                      )}
                      <AnimatePresence initial={false}>
                        {activeSession?.messages.map((msg, idx) => {
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
                                ) : (isThinkingUI && isGenerating && idx === (activeSession?.messages.length - 1)) ? (
                                  /* AI 思考中 · 极光视窗 */
                                  <div className="space-y-4 w-full flex-col flex items-start max-w-full">
                                    <AIGeneratingState agentName={msgAgent?.name || "Hermes"} reasoningText={reasoningText} />
                                  </div>
                                ) : (
                                  /* Standard Assistant message with pristine glassmorphic border and background */
                                  <div className="space-y-3 w-full max-w-full">
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
                    /* [OpenClaw 接驳点]：此处绑定 handleSubmitMessage 发送逻辑 */
                    <form
                      onSubmit={handleSubmitMessage}
                      className="w-[95%] md:w-[85%] xl:w-[75%] max-w-5xl mx-auto relative group animate-fade-in"
                    >
                      <div className="mb-2.5 px-1 text-center sm:text-right select-none text-[10px] text-zinc-450 dark:text-zinc-400 font-normal font-sans">
                        按{" "}
                        <kbd className="px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-[#333538] bg-zinc-50 dark:bg-zinc-900/60 font-mono text-[9px]">
                          Enter
                        </kbd>{" "}
                        发送消息，按{" "}
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
