import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

// ── 进程级错误兜底：防止 Node 16 http 流 ECONNRESET 导致 crash loop ──
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err?.message || err);
  if ((err as any)?.code === "ECONNRESET" || (err as any)?.code === "EPIPE" || (err as any)?.code === "ETIMEDOUT") {
    console.error("[FATAL] Network disruption — process stays alive");
    return;
  }
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", (reason as any)?.message || reason);
});

const prisma = new PrismaClient();

const app = express();
const PORT = parseInt(process.env.PORT || "3210", 10);
const HISTORY_FILE = path.join(process.cwd(), "history.json");
const AGENTS_FILE = path.join(process.cwd(), "agents.json");
const JWT_SECRET = process.env.JWT_SECRET || "nexus-default-jwt-secret-change-me";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme123";

// ═══════════════════════════════════════════════════════
// 🔴 架构纠偏：双端持久化 + 增量同步
// 云端 .jsonl 目录 — 与 MySQL 形成双活写入
// ═══════════════════════════════════════════════════════
const JSONL_DIR = path.join(process.cwd(), "sessions");

function ensureJsonlDir() {
  if (!fs.existsSync(JSONL_DIR)) {
    fs.mkdirSync(JSONL_DIR, { recursive: true });
    console.log("[jsonl] Created sessions directory:", JSONL_DIR);
  }
}

// 🔴 双活写入：同时写 MySQL（主）和云端 .jsonl（副）
// 每条消息一行 JSON，格式与 Gateway 本地 .jsonl 对齐
function appendToJsonl(sessionId: string, role: "user" | "assistant", content: string) {
  try {
    ensureJsonlDir();
    // 会话 ID 可能含特殊字符（: / \），替换为安全文件名
    const safeName = sessionId.replace(/[:\/\\]/g, "_") + ".jsonl";
    const line = JSON.stringify({ role, content, timestamp: new Date().toISOString() }) + "\n";
    fs.appendFileSync(path.join(JSONL_DIR, safeName), line, "utf-8");
  } catch (err) {
    console.error("[jsonl] Append failed for session", sessionId, ":", err);
  }
}

// 便捷函数：同时写入 MySQL + 云端 JSONL（双活）
// 返回 Promise，由调用方自行 .catch
function dualPersistMessages(sessionId: string, userContent: string, assistantContent: string) {
  const now = Date.now();
  const uid = Math.random().toString(36).slice(2, 8);

  // 🔴 前置：确保 Session 表中有记录，避免 Message 表外键约束失败
  // Gateway 自动创建 session 但可能未写入 Session 表
  const ensureSession = prisma.session.upsert({
    where: { id: sessionId },
    update: { updatedAt: new Date() },
    create: { id: sessionId, customTitle: null },
  });

  // MySQL 写入（主）
  const mysqlPromise = ensureSession.then(() =>
    prisma.message.createMany({
      data: [
        {
          id: `msg-${now}-${uid}-u`,
          sessionId,
          role: "user",
          content: userContent,
        },
        {
          id: `msg-${now + 1}-${uid}-a`,
          sessionId,
          role: "assistant",
          content: assistantContent,
        },
      ],
    }),
  );

  // 云端 JSONL 写入（副，同步立即落盘）
  appendToJsonl(sessionId, "user", userContent);
  appendToJsonl(sessionId, "assistant", assistantContent);

  return mysqlPromise;
}

// Default initial agents mapping to AGENTS in types.ts
const DEFAULT_AGENTS = [
  {
    id: "hermes",
    name: "Hermes 核心大脑",
    alias: "Hermes",
    emoji: "🧠",
    color: "#10b981",
    description: "端侧大语言模型推理引擎，基于 llama.cpp · 高频指令调度 · 本地隐私安全",
    runtime: "llama",
    model: "llama-3-8b-instruct",
    computerId: "mac",
    capabilities: ["文本对话", "代码生成", "指令调度", "系统运维"],
    active: true,
    personality: {
      style: "专业沉稳",
      greeting: "你好，我是 Hermes。本地推理引擎已就绪，随时为你服务。",
    }
  },
  {
    id: "openclaw-main",
    name: "全局协作牛马",
    alias: "全局协作牛马",
    emoji: "🐂",
    color: "#f59e0b",
    description: "全局协作秘书 · 多智能体任务调度 · 云端模型接入",
    runtime: "openclaw",
    model: "openclaw/main",
    computerId: "cloud",
    capabilities: ["多模态对话", "知识检索", "Agent 协同", "任务调度"],
    active: true,
    placeholder: false,
    personality: {
      style: "抽象幽默",
      greeting: "🐂 全局协作牛马已就绪，老板请下令！",
    }
  },
  {
    id: "openclaw-jianshen",
    name: "健身教练",
    alias: "健身教练",
    emoji: "💪",
    color: "#ef4444",
    description: "AI 健身教练 · 训练计划制定 · 饮食追踪管理",
    runtime: "openclaw",
    model: "openclaw/jianshen",
    computerId: "cloud",
    capabilities: ["训练计划", "饮食管理", "体测分析", "进度追踪"],
    active: true,
    placeholder: false,
    personality: {
      style: "激励专业",
      greeting: "💪 健身教练已上线！今天练哪个部位？",
    }
  },
  {
    id: "claude",
    name: "Claude Code CLI",
    alias: "Claude",
    emoji: "⚡",
    color: "#d97757",
    description: "Anthropic 命令行助手 · 强大多项目重构",
    runtime: "claude",
    model: "claude-3-5-sonnet",
    computerId: "cloud",
    capabilities: ["代码生成", "工程重构"],
    active: true,
    personality: {
      style: "精简",
      greeting: "Claude Code 已就绪，准备进行代码分析与重构。",
    }
  },
  {
    id: "codex",
    name: "Codex 编程引擎",
    alias: "Codex",
    emoji: "🛠️",
    color: "#3b82f6",
    description: "OpenAI 代码补全核心 · 上下文感知",
    runtime: "codex",
    model: "gpt-4-turbo",
    computerId: "cloud",
    capabilities: ["代码补全"],
    active: false,
    placeholder: true,
    personality: {
      style: "极简",
      greeting: "Codex 引擎当前处于未激活状态。",
    }
  }
];

function readAgents() {
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      const data = fs.readFileSync(AGENTS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading agents file, falling back to default:", err);
  }
  return DEFAULT_AGENTS;
}

function writeAgents(data: any) {
  try {
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing agents file:", err);
  }
}

// Native robust CORS header definitions
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// ═══════════════════════════════════════════════════════
// Gateway 代理：仅保留 /v1/chat/completions 流式透传
// Sessions API 改用下方 /api/sessions 显式路由
// ═══════════════════════════════════════════════════════

// Gateway 基础配置
// 全走 Tailscale 内网（100.83.118.16 → MacBook Gateway）
const GATEWAY_HOST = "100.83.118.16";
const GATEWAY_PORT = 18789;
const GATEWAY_TOKEN = "0e41fa7f04c5cca00fa7d492e60fdf75769d8fc99cb218f7";

// ── Sessions API：直查 MySQL，零依赖 Gateway/Tailscale ──
// 从 Message 表提取所有唯一 sessionId，LEFT JOIN Session 获取 customTitle

function deriveAgentId(sessionKey: string): string {
  if (sessionKey.startsWith("agent:jianshen:")) return "openclaw-jianshen";
  if (sessionKey.startsWith("agent:main:")) return "openclaw-main";
  if (sessionKey.startsWith("session-")) return "hermes";
  // 纯 UUID → 默认为 openclaw-main（大部分 UUID 来自 OpenClaw 聊天）
  return "openclaw-main";
}

async function fetchSessionsFromMySQL() {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      m.sessionId AS sessionKey,
      s.customTitle,
      COUNT(*) AS msgCount,
      MIN(m.createdAt) AS firstMessageAt,
      MAX(m.createdAt) AS lastMessageAt
    FROM Message m
    LEFT JOIN Session s ON s.id = m.sessionId
    GROUP BY m.sessionId
    ORDER BY MAX(m.createdAt) DESC
  `;

  return rows.map((row: any) => {
    const key = row.sessionKey || "";
    return {
      key,
      title: row.customTitle || "未命名会话",
      customTitle: row.customTitle || null,
      msgCount: Number(row.msgCount),
      createdAt: row.firstMessageAt ? new Date(row.firstMessageAt).toISOString() : null,
      updatedAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
      agentId: deriveAgentId(key),
    };
  });
}

// GET /api/sessions — 从 MySQL 直查所有会话列表
app.get("/api/sessions", async (req, res) => {
  try {
    let sessions = await fetchSessionsFromMySQL();

    // 可选 agentId 过滤
    if (req.query.agentId) {
      const agentId = req.query.agentId as string;
      sessions = sessions.filter((s: any) => s.agentId === agentId);
    }

    res.json(sessions);
  } catch (err: any) {
    console.error("[mysql/sessions] Query failed:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Database session query failed: " + (err.message || err) });
    }
  }
});

// ── 同轮次 assistant 消息合并（前端每轮只显示一个 AI 头像）──
// 规则：连续的 assistant 消息合并为一条，保留第一条的 id，content 合并为扁平数组
function mergeConsecutiveAssistants(messages: any[]): any[] {
  if (!Array.isArray(messages) || messages.length === 0) return messages;

  const result: any[] = [];
  let i = 0;

  while (i < messages.length) {
    const current = messages[i];

    // 非 assistant 消息直接透传
    if (!current || current.role !== "assistant") {
      result.push(current);
      i++;
      continue;
    }

    // 连续 assistant 消息块：保留第一条的 id/metadata，合并所有 content
    const base = { ...current };
    const contents: any[] = [];

    const collect = (content: any) => {
      if (Array.isArray(content)) {
        for (const item of content) {
          contents.push(item);
        }
      } else if (typeof content === "string") {
        contents.push({ type: "text", text: content });
      } else if (content && typeof content === "object") {
        contents.push(content);
      }
    };

    while (i < messages.length && messages[i] && messages[i].role === "assistant") {
      collect(messages[i].content);
      i++;
    }

    base.content = contents;
    result.push(base);
  }

  return result;
}

// ── v6.0 CQRS 落盘：直接从 MySQL Message 表查询历史，废弃 Gateway 穿透 ──

// 🔧 v6.3 契约修复：提取 UUID 查询策略
// 数据库 Message.sessionId 存储的是纯 UUID（如 a4454b68-...），
// 但 Gateway session key 带前缀（如 agent:main:dashboard:a4454b68-...）。
// 优先提取末段 UUID 查询，回退到完整 key 查询。
function extractLookupIds(fullKey: string): string[] {
  const candidates: string[] = [];
  // 1. 完整 key（Gateway session key 格式）
  candidates.push(fullKey);
  // 2. 如果 key 含 ":"，提取末段作为 UUID 候选
  if (fullKey.includes(":")) {
    const lastSegment = fullKey.split(":").pop();
    if (lastSegment && lastSegment.length > 0) {
      candidates.push(lastSegment);
    }
  }
  return candidates;
}

// GET /api/sessions/:sessionKey/history — 从 MySQL Message 表直查会话聊天记录
app.get("/api/sessions/:sessionKey/history", async (req, res) => {
  try {
    const { sessionKey } = req.params;
    if (!sessionKey) return res.status(400).json({ error: "Missing sessionKey" });

    const decodedKey = decodeURIComponent(sessionKey);

    // ── 分页参数 ──
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10) || 50));

    // ── 多候选查询：优先 UUID，回退到完整 key ──
    const lookupIds = extractLookupIds(decodedKey);
    let messages: any[] = [];
    let total = 0;

    for (const lookupId of lookupIds) {
      [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: { sessionId: lookupId },
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.message.count({ where: { sessionId: lookupId } }),
      ]);
      if (messages.length > 0) {
        console.log(`[history] Found ${total} msgs using sessionId="${lookupId}" (from "${decodedKey}")`);
        break;
      }
    }

    if (messages.length === 0) {
      console.log(`[history] No messages found for "${decodedKey}" (tried: ${lookupIds.join(", ")})`);
    }

    const hasMore = (page * limit) < total;

    // 将 Prisma 结果映射为前端期望格式
    const mappedMessages = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
    }));

    res.json({ source: "mysql", messages: mappedMessages, total, page, limit, hasMore });
  } catch (err: any) {
    console.error("[history] MySQL query failed:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "History query failed: " + (err.message || err) });
    }
  }
});

app.use(express.json());

// ── POST /api/auth/login ────────────────────────────────────────
// 管理员登录：验证密码，签发 JWT（角色 ADMIN，有效期 24h）
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign({ role: "ADMIN" }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ token, role: "ADMIN" });
});

// ── GET /api/auth/verify ─────────────────────────────────────────
// 🔐 页面加载时主动验证 token 有效性（防止幽灵 Token：客户端解析通过但服务端验签失败）
app.get("/api/auth/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin role required" });
    }
    res.json({ valid: true, role: decoded.role, exp: decoded.exp });
  } catch (err: any) {
    const msg = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ error: msg });
  }
});

// ── 全局鉴权中间件 ──────────────────────────────────────────────
// GET / OPTIONS: 游客放行
// POST / PUT / DELETE / PATCH: 需 Bearer Token，角色 ADMIN
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin role required for write operations" });
    }
    next();
  } catch (err: any) {
    const msg = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ error: msg });
  }
});

// ── GET /api/openclaw/sessions ──────────────────────────────────
// 🔧 v7 架构补漏：直查 MySQL，不再穿透 Gateway/Tailscale
// 保留 /api/openclaw/sessions 路由以兼容旧前端，内部委托到 MySQL 查询
// ─────────────────────────────────────────────────────────────────
app.get("/api/openclaw/sessions", async (req, res) => {
  try {
    const sessions = await fetchSessionsFromMySQL();
    res.json(sessions);
  } catch (err: any) {
    console.error("[openclaw/sessions] MySQL fallback failed:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Session query failed: " + (err.message || err) });
    }
  }
});

// ── POST /api/openclaw/sessions/rename ─────────────────────────
// 接收 { sessionId, newTitle }，Prisma upsert 存储自定义标题
// ─────────────────────────────────────────────────────────────────
app.post("/api/openclaw/sessions/rename", async (req, res) => {
  const { sessionId, newTitle } = req.body;

  if (!sessionId || typeof newTitle !== "string") {
    return res.status(400).json({ error: "Missing sessionId or newTitle" });
  }

  try {
    await prisma.session.upsert({
      where: { id: sessionId },
      update: { customTitle: newTitle },
      create: { id: sessionId, customTitle: newTitle },
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error("[openclaw/sessions/rename] Prisma error:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Database error: " + e.message });
    }
  }
});

// Helper to read history
function readHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading history file, falling back to memory:", err);
  }
  return [];
}

// Helper to write history
function writeHistory(data: any) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing history file:", err);
  }
}

// /api/openclaw/sessions 和 /api/openclaw/sessions/rename 已在上面显式路由
// 均直查 MySQL，零依赖 Gateway/Tailscale

// 0. GET /api/health - Check MacBook reachability (Node 16: no fetch, use http.get)
app.get("/api/health", (_req, res) => {
  const start = Date.now();
  let sent = false;
  const reply = (data: Record<string, any>) => {
    if (sent || res.headersSent) return;
    sent = true;
    res.json(data);
  };
  const hreq = http.get("http://100.83.118.16:8000/v1/models", { timeout: 2000 }, (hres) => {
    // Consume response to avoid memory leak, then report reachable
    hres.resume();
    hres.on("end", () => {
      reply({ reachable: true, latency: Date.now() - start });
    });
  });
  hreq.on("error", () => {
    reply({ reachable: false, latency: Date.now() - start });
  });
  hreq.on("timeout", () => {
    hreq.destroy();
    reply({ reachable: false, latency: Date.now() - start });
  });
});

// 1. GET /api/history - Retrieve all chat sessions
app.get("/api/history", (req, res) => {
  const { agentId } = req.query;
  let history = readHistory();
  if (agentId) {
    history = history.filter((session: any) => session.agentId === agentId);
  }
  res.json(history);
});

// 2. POST /api/history - Update or append a chat session
app.post("/api/history", (req, res) => {
  const session = req.body;
  if (!session || !session.id) {
    return res.status(400).json({ error: "Missing session or session ID" });
  }

  let history = readHistory();
  const existingIndex = history.findIndex((s: any) => s.id === session.id);

  if (existingIndex !== -1) {
    history[existingIndex] = { ...history[existingIndex], ...session };
  } else {
    history.unshift(session); // Insert newest first
  }

  writeHistory(history);
  res.json({ success: true, session });
});

// 2.5 DELETE /api/history/:id - Clear a session from registry
app.delete("/api/history/:id", (req, res) => {
  const { id } = req.params;
  let history = readHistory();
  history = history.filter((s: any) => s.id !== id);
  writeHistory(history);
  res.json({ success: true });
});

// 2.7 GET /api/agents - Retrieve available agents list
app.get("/api/agents", (req, res) => {
  res.json(readAgents());
});

app.post("/api/agents", (req, res) => {
  const agent = req.body;
  if (!agent.id) agent.id = "agent-" + Date.now();
  const agents = readAgents();
  agent.createdAt = new Date().toISOString();
  agents.push(agent);
  writeAgents(agents);
  res.json(agent);
});

app.get("/api/agents/:id", (req, res) => {
  const agents = readAgents();
  const agent = agents.find((a: any) => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: "Not found" });
  res.json(agent);
});

app.patch("/api/agents/:id", (req, res) => {
  let agents = readAgents();
  const idx = agents.findIndex((a: any) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  
  const updates = req.body;
  // Deny updates to immutable fields
  if (updates.runtime || updates.model || updates.computerId) {
    return res.status(400).json({ error: "Cannot modify runtime, model, or computerId after creation" });
  }

  // Only allow updating specific fields
  if (updates.name) agents[idx].name = updates.name;
  if (updates.alias) agents[idx].alias = updates.alias;
  if (updates.emoji) agents[idx].emoji = updates.emoji;
  if (updates.personality) agents[idx].personality = { ...agents[idx].personality, ...updates.personality };
  if (updates.description) agents[idx].description = updates.description;
  if (updates.color) agents[idx].color = updates.color;

  writeAgents(agents);
  res.json(agents[idx]);
});

app.delete("/api/agents/:id", (req, res) => {
  let agents = readAgents();
  agents = agents.filter((a: any) => a.id !== req.params.id);
  writeAgents(agents);

  // Clear related history
  let history = readHistory();
  history = history.filter((s: any) => s.agentId !== req.params.id);
  writeHistory(history);

  res.json({ success: true });
});

app.post("/api/agents/:id/activate", (req, res) => {
  let agents = readAgents();
  const idx = agents.findIndex((a: any) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  agents[idx].active = true;
  writeAgents(agents);
  res.json(agents[idx]);
});

app.post("/api/actions", (req, res) => {
  const { actionId } = req.body;
  if (!actionId) return res.status(400).json({ error: "No actionId provided" });

  // Simulate process time
  setTimeout(() => {
    let result = { message: "操作执行成功", data: {} };
    if (actionId === "ping") {
      result = { message: "Ping 节点测速完成：延迟 18ms", data: { ping: 18 } };
    } else if (actionId === "llama_logs") {
      result = { message: "日志读取成功，后台守护核心活跃。暂无排队等候空槽。", data: {} };
    } else if (actionId === "restart_worker") {
      result = { message: "重启 Llama 服务成功：VRAM 已重置", data: {} };
    } else if (actionId === "flush_cache") {
      result = { message: "刷新中转服务器缓存成功", data: {} };
    }
    res.json(result);
  }, 1000);
});

// 3. POST /api/chat - SSE Streaming Proxy to the MAC Hermes Agent or OpenClaw
app.post("/api/chat", async (req, res, next) => {
  try {
    const { messages, temperature = 0.7, agent_id = "hermes", session_id } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid payload: messages must be an array" });
    }

    if (agent_id === "hermes") {
      // ⚠️ Node 16 无原生 fetch，使用 http.request 替代
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const postData = JSON.stringify({
        messages,
        model: "hermes-agent",
        temperature,
        stream: true
      });

      const hreq = http.request({
        hostname: "100.83.118.16",
        port: 8000,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer 43847f73aa132c3abfa9b076eb1dd7ff56b08e06b651a640",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 30000,
      }, (hres) => {
        if (hres.statusCode !== 200) {
          let errorData = "";
          hres.on("data", (chunk: Buffer) => { errorData += chunk.toString(); });
          hres.on("end", () => {
            res.write(`data: ${JSON.stringify({ error: `Backend API error status: ${hres.statusCode} - ${errorData}` })}\n\n`);
            res.end();
          });
          return;
        }

        // SSE 流式透传 + 累积完整回复用于落盘
        let hermesBuffer = "";
        let hermesFullResponse = "";
        hres.on("data", (chunk: Buffer) => {
          hermesBuffer += chunk.toString();
          const lines = hermesBuffer.split("\n");
          hermesBuffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") && !line.startsWith("data: [DONE]")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) hermesFullResponse += delta;
              } catch {}
            }
          }
          res.write(chunk);
        });

        hres.on("end", () => {
          // flush remaining buffer
          if (hermesBuffer.startsWith("data: ") && hermesBuffer !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(hermesBuffer.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) hermesFullResponse += delta;
            } catch {}
          }
          // 🔴 架构纠偏 v2：双端持久化（MySQL + 云端 .jsonl）+ 完整双向落盘
          if (session_id && hermesFullResponse) {
            const lastUserMsg = messages[messages.length - 1];
            const userContent = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg?.content || "");
            dualPersistMessages(session_id, userContent, hermesFullResponse)
              .catch((e: any) => console.error("[dualPersist] hermes:", e.message));
          }
          res.end();
        });

        hres.on("error", (err: Error) => {
          console.error("Hermes stream pipe error:", err);
          if (!res.writableEnded) res.end();
        });
      });

      hreq.on("error", (err: any) => {
        console.error("Hermes request error:", err.message);
        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
        }
        res.write(`data: ${JSON.stringify({ error: `Could not connect to MacBook Hermes. ${err.message || err}` })}\n\n`);
        res.end();
      });

      hreq.on("timeout", () => {
        hreq.destroy();
        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
        }
        res.write(`data: ${JSON.stringify({ error: "Request to MacBook timed out after 30s" })}\n\n`);
        res.end();
      });

      hreq.write(postData);
      hreq.end();

    } else if (agent_id === "openclaw-main" || agent_id === "openclaw-jianshen") {
      // ── OpenClaw Gateway SSE 流式代理 (Node 16: http.request) ──
      // session_id 通过 x-openclaw-session-key header 传递，实现双端漫游
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const modelMap: Record<string, string> = {
        "openclaw-main": "openclaw/main",
        "openclaw-jianshen": "openclaw/jianshen",
      };
      const model = modelMap[agent_id] || "openclaw/main";

      // 🔴 架构纠偏 v2：当 session_id 存在时，仅发送最后一条用户消息给 Gateway
      // Gateway 通过 x-openclaw-session-key 从本地 .jsonl 加载会话上下文
      // 这样 Gateway 收到的唯一新消息就是刚发送的用户输入，必然保存到本地 .jsonl 中
      const msgsForGateway = session_id
        ? [messages[messages.length - 1]]
        : messages;

      const postData = JSON.stringify({
        messages: msgsForGateway,
        model,
        temperature,
        stream: true
      });

      // 构建请求头：session_id 存在时携带 x-openclaw-session-key
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
        "Content-Length": String(Buffer.byteLength(postData)),
      };
      if (session_id) {
        reqHeaders["x-openclaw-session-key"] = session_id;
      }

      const oreq = http.request({
        hostname: GATEWAY_HOST,
        port: GATEWAY_PORT,
        path: "/v1/chat/completions",
        method: "POST",
        headers: reqHeaders,
        timeout: 120000,
      }, (ores) => {
        if (ores.statusCode !== 200) {
          let errorData = "";
          ores.on("data", (chunk: Buffer) => { errorData += chunk.toString(); });
          ores.on("end", () => {
            res.write(`data: ${JSON.stringify({ error: `OpenClaw Gateway error ${ores.statusCode}: ${errorData}` })}\n\n`);
            res.end();
          });
          return;
        }

        // SSE 流式透传 + 累积完整回复用于落盘
        let oclawBuffer = "";
        let oclawFullResponse = "";
        ores.on("data", (chunk: Buffer) => {
          oclawBuffer += chunk.toString();
          const lines = oclawBuffer.split("\n");
          oclawBuffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") && !line.startsWith("data: [DONE]")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) oclawFullResponse += delta;
              } catch {}
            }
          }
          res.write(chunk);
        });

        ores.on("end", () => {
          // flush remaining buffer
          if (oclawBuffer.startsWith("data: ") && oclawBuffer !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(oclawBuffer.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) oclawFullResponse += delta;
            } catch {}
          }
          // 🔴 架构纠偏 v2：双端持久化（MySQL + 云端 .jsonl）+ 完整双向落盘
          if (session_id && oclawFullResponse) {
            const lastUserMsg = messages[messages.length - 1];
            const userContent = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg?.content || "");
            dualPersistMessages(session_id, userContent, oclawFullResponse)
              .catch((e: any) => console.error("[dualPersist] openclaw:", e.message));
          }
          res.end();
        });

        ores.on("error", (err: Error) => {
          console.error("OpenClaw stream pipe error:", err);
          if (!res.writableEnded) res.end();
        });
      });

      oreq.on("error", (err: any) => {
        console.error("OpenClaw request error:", err.message);
        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
        }
        res.write(`data: ${JSON.stringify({ error: `Request to OpenClaw Gateway failed: ${err.message || err}` })}\n\n`);
        res.end();
      });

      oreq.on("timeout", () => {
        oreq.destroy();
        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
        }
        res.write(`data: ${JSON.stringify({ error: "Request to OpenClaw Gateway timed out after 120s" })}\n\n`);
        res.end();
      });

      oreq.write(postData);
      oreq.end();
    } else {
      res.write(`data: ${JSON.stringify({ error: `Unsupported Agent ID: ${agent_id}` })}\n\n`);
      res.end();
    }

  } catch (error: any) {
    console.error("Proxy error:", error);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
    }
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        error: `Could not connect to the remote MacBook. Details: ${error?.message || error}.`
      })}\n\n`);
      res.end();
    }
  }
});

// 4. Express Error Handling Middleware（防御性：不因 headers 已发送而崩溃）
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global express error:", err);
  if (res.headersSent) {
    // 响应已发送，无法再修改 headers，仅关闭连接
    if (!res.writableEnded) res.end();
    return;
  }
  try {
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      code: err.code || "INTERNAL_ERROR",
      retryable: err.message?.includes("timed out") || err.code === "ECONNREFUSED"
    });
  } catch (e) {
    console.error("Global error handler failed:", e);
    if (!res.writableEnded) res.end();
  }
});

// 启动逻辑：优先检查 dist/ 目录，存在则生产模式，否则动态加载 vite dev server
// 这样不依赖 NODE_ENV，彻底避免 dev 模式下 vite/rollup 原生模块加载失败
async function startServer() {
  const distPath = path.join(process.cwd(), "dist");

  if (fs.existsSync(path.join(distPath, "index.html"))) {
    // 生产模式：直接服务预构建的静态文件
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // 开发模式：动态加载 vite dev server
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`[sessions] MySQL-backed: /api/sessions + /api/openclaw/sessions`);
  });
}

startServer();
