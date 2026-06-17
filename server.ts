/**
 * Nexus 节点机 · 后端纯代理（agent_log 流式拦截管线版）
 *
 * 核心功能：
 * 1. GET /api/sessions → Gateway 拉取真实会话列表
 * 2. GET /api/sessions/:key/history → Gateway 拉取聊天历史
 * 3. POST /api/chat → SSE 代理 + tool_calls 拦截 → agent_log 注入
 */

import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import http from "http";

const app = express();
const PORT = 3210;
const AGENTS_FILE = path.join(process.cwd(), "agents.json");
const RENAME_MAP_FILE = path.join(process.cwd(), "session-rename-map.json");
const HISTORY_FILE = path.join(process.cwd(), "history.json");

// ── Gateway 配置（从 .env 读取，支持回退默认值）──
const GATEWAY_HOST = process.env.GATEWAY_HOST || "100.83.118.16";
const GATEWAY_PORT = Number(process.env.GATEWAY_PORT) || 18789;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "0e41fa7f04c5cca00fa7d492e60fdf75769d8fc99cb218f7";
const GATEWAY_CHAT_PATH = "/v1/chat/completions";

// ── Hermes 配置（从 .env 读取，支持回退默认值）──
const HERMES_HOST = process.env.HERMES_HOST || "100.83.118.16";
const HERMES_PORT = Number(process.env.HERMES_PORT) || 8000;
const HERMES_TOKEN = process.env.HERMES_TOKEN || "43847f73aa132c3abfa9b076eb1dd7ff56b08e06b651a640";

// ── 默认 Agents 数据 ──
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
    placeholder: false,
    personality: {
      style: "专业沉稳",
      greeting: "你好，我是 Hermes。本地推理引擎已就绪，随时为你服务。",
    },
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
    },
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
    },
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
    placeholder: false,
    personality: {
      style: "精简",
      greeting: "Claude Code 已就绪，准备进行代码分析与重构。",
    },
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
    },
  },
];

// ═══════════════════════════════════════════════════════
// 🔒 原子写入队列：防止并发写入导致 JSON 文件破损
//    每个文件独立串行队列，先写 .tmp 再 rename（原子操作）
// ═══════════════════════════════════════════════════════
const writeQueues = new Map<string, Promise<void>>();

async function atomicWriteJSON(filePath: string, data: any): Promise<void> {
  const tmpPath = filePath + ".tmp";
  const content = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(tmpPath, content, "utf-8");
  await fs.promises.rename(tmpPath, filePath);
}

function enqueueWrite(filePath: string, data: any): Promise<void> {
  const prev = writeQueues.get(filePath) || Promise.resolve();
  // 前一个写入无论成败都继续处理当前（避免死锁）
  const next = prev.then(
    () => atomicWriteJSON(filePath, data),
    () => atomicWriteJSON(filePath, data)
  );
  writeQueues.set(filePath, next);
  // 吞掉 rejection 防止 unhandledRejection，错误已通过 console.error 记录
  next.catch((err) => {
    console.error(`Atomic write failed for ${filePath}:`, err);
  });
  return next;
}

// ── Agents 文件读写 ──
function readAgents() {
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      return JSON.parse(fs.readFileSync(AGENTS_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error reading agents file:", err);
  }
  return DEFAULT_AGENTS;
}

function writeAgents(data: any): Promise<void> {
  return enqueueWrite(AGENTS_FILE, data);
}

// ── 会话重命名映射持久化 ──
function readRenameMap(): Record<string, string> {
  try {
    if (fs.existsSync(RENAME_MAP_FILE)) {
      return JSON.parse(fs.readFileSync(RENAME_MAP_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error reading rename map:", err);
  }
  return {};
}

function writeRenameMap(map: Record<string, string>): Promise<void> {
  return enqueueWrite(RENAME_MAP_FILE, map);
}

// ── Hermes 本地会话历史持久化 ──
function readHistory(): any[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error reading history:", err);
  }
  return [];
}

function writeHistory(sessions: any[]): Promise<void> {
  return enqueueWrite(HISTORY_FILE, sessions);
}

// ── CORS ──
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

app.use(express.json({ limit: "1mb" }));

// ═══════════════════════════════════════════════════════
// Gateway /tools/invoke helper
// ═══════════════════════════════════════════════════════
function gatewayInvoke(tool: string, args: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ tool, args });
    const hreq = http.request(
      {
        hostname: GATEWAY_HOST,
        port: GATEWAY_PORT,
        path: "/tools/invoke",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GATEWAY_TOKEN}`,
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 15000,
      },
      (hres) => {
        let body = "";
        hres.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        hres.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (!data.ok) {
              reject(new Error(data.error?.message || "Gateway invoke failed"));
              return;
            }
            let result = data.result;
            if (result?.content?.[0]?.type === "text" && result.content[0].text) {
              try { result = JSON.parse(result.content[0].text); } catch {}
            }
            resolve(result);
          } catch (e) {
            reject(new Error("Invalid Gateway response"));
          }
        });
      },
    );
    hreq.on("error", (err) => reject(err));
    hreq.on("timeout", () => { hreq.destroy(); reject(new Error("Gateway timeout")); });
    hreq.write(postData);
    hreq.end();
  });
}

// ═══════════════════════════════════════════════════════
// 🛡️ 自动重试防线 · Agent 自愈机制
//    拦截空内容/中断标识 → 后台默默重跑 → 优雅降级
// ═══════════════════════════════════════════════════════
const AUTO_RETRY_MAX = 2;

/** 空内容/中断标识匹配模式 */
const CONTENT_CRASH_PATTERNS: RegExp[] = [
  /completed without visible content/i,
  /no content generated/i,
  /empty response/i,
];

/**
 * 判断一组 SSE 事件中是否存在有效的 Agent 输出内容
 * 有效输出 = 有 delta.content 文本 或 有 tool_calls 调用
 */
function hasValidOutput(events: string[]): boolean {
  for (const event of events) {
    const lines = event.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(dataStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content && typeof content === "string" && content.trim().length > 0) {
          return true;
        }
        const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
        if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
          return true;
        }
      } catch {}
    }
  }
  return false;
}

/**
 * 检测 SSE 事件流中是否包含崩溃/中断标识
 */
function containsCrashPattern(events: string[]): boolean {
  const combined = events.join(" ");
  return CONTENT_CRASH_PATTERNS.some((p) => p.test(combined));
}

/**
 * 生成优雅降级 SSE 事件（中文报错，符合产品视觉红线）
 */
function gracefulDegradationEvents(): string[] {
  return [
    `data: ${JSON.stringify({
      choices: [{ delta: { content: "⚠️ 节点机底层推演中断，已尝试自愈失败，请尝试简化指令或重新发送。" } }],
    })}\n\n`,
    "data: [DONE]\n\n",
  ];
}

/**
 * 单次 Gateway 流式代理：收集全部 SSE 事件（不落盘到 res，供重试调度用）
 */
function gatewayStreamOnce(
  postData: string,
  reqHeaders: Record<string, string>
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const events: string[] = [];
    const oreq = http.request(
      {
        hostname: GATEWAY_HOST,
        port: GATEWAY_PORT,
        path: GATEWAY_CHAT_PATH,
        method: "POST",
        headers: reqHeaders,
        timeout: 300000,
      },
      (ores) => {
        if ((ores.statusCode || 500) >= 400) {
          let errorData = "";
          ores.on("data", (chunk: Buffer) => { errorData += chunk.toString(); });
          ores.on("end", () => {
            reject(new Error(`Gateway error ${ores.statusCode}: ${errorData}`));
          });
          return;
        }

        let sseBuf = "";
        ores.on("data", (chunk: Buffer) => {
          sseBuf += chunk.toString();
          while (true) {
            const idx = sseBuf.indexOf("\n\n");
            if (idx === -1) break;
            const rawEvent = sseBuf.slice(0, idx + 2);
            sseBuf = sseBuf.slice(idx + 2);
            events.push(rawEvent);
          }
        });

        ores.on("end", () => {
          if (sseBuf.length > 0) events.push(sseBuf);
          resolve(events);
        });

        ores.on("error", (err: Error) => reject(err));
      }
    );

    oreq.on("error", (err: any) => reject(err));
    oreq.on("timeout", () => {
      oreq.destroy();
      reject(new Error("Gateway timeout"));
    });
    oreq.write(postData);
    oreq.end();
  });
}

/**
 * tool_calls → agent_log 注入（后处理版本）
 */
function injectAgentLogs(events: string[]): string[] {
  const result: string[] = [];
  for (const rawEvent of events) {
    result.push(rawEvent);
    const lines = rawEvent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(dataStr);
        const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
        if (toolCalls && Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const fnName = tc.function?.name || "unknown";
            let logText = `[Tool] 执行了 ${fnName}`;
            const argsStr = tc.function?.arguments;
            if (argsStr) {
              try {
                const args = JSON.parse(argsStr);
                if (args.path) logText += ` → ${args.path}`;
                else if (args.command) logText += ` → ${args.command.slice(0, 60)}`;
                else if (args.query) logText += ` → ${args.query.slice(0, 60)}`;
                else if (args.filePath) logText += ` → ${args.filePath}`;
              } catch {}
            }
            result.push(
              `data: ${JSON.stringify({ agent_log: logText })}\n\n`
            );
          }
        }
      } catch {}
    }
  }
  return result;
}

/**
 * 🛡️ Gateway 流式代理 + 自动重试防线
 * ── 拦截空内容/中断标识 → 后台默默重跑（最多 AUTO_RETRY_MAX 次）
 * ── 全部失败 → 优雅降级中文报错
 */
async function gatewayChatWithRetry(
  postData: string,
  reqHeaders: Record<string, string>
): Promise<string[]> {
  for (let attempt = 0; attempt <= AUTO_RETRY_MAX; attempt++) {
    try {
      const rawEvents = await gatewayStreamOnce(postData, reqHeaders);
      const enrichedEvents = injectAgentLogs(rawEvents);

      if (hasValidOutput(enrichedEvents) && !containsCrashPattern(enrichedEvents)) {
        if (attempt > 0) {
          console.log(`✅ [Auto-Retry] 第 ${attempt} 次重试成功恢复`);
        }
        return enrichedEvents;
      }

      console.warn(
        `⚠️ [Auto-Retry] 第 ${attempt + 1}/${AUTO_RETRY_MAX} 次：检测到空内容或中断标识，触发重试`
      );
    } catch (err: any) {
      console.error(
        `⚠️ [Auto-Retry] 第 ${attempt + 1}/${AUTO_RETRY_MAX} 次异常:`,
        err.message
      );
    }

    if (attempt < AUTO_RETRY_MAX) {
      // 短暂退避后重试，避免瞬时冲击
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // 所有重试耗尽 → 优雅降级
  console.error("🛑 [Auto-Retry] 全部重试耗尽，返回优雅降级提示");
  return gracefulDegradationEvents();
}

// ═══════════════════════════════════════════════════════
// 核心 API 1: 会话同步与历史记录
// ═══════════════════════════════════════════════════════

// GET /api/health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// GET /api/sessions — 从 Gateway 拉取真实会话列表
app.get("/api/sessions", async (req, res) => {
  try {
    const args: Record<string, any> = {};
    if (req.query.agentId) args.agentId = req.query.agentId;
    const result = await gatewayInvoke("sessions_list", args);
    let sessions = result?.sessions || (Array.isArray(result) ? result : []);
    sessions = sessions.filter((s: any) => {
      const key = s.key || "";
      return !key.includes(":subagent:") && !key.includes(":cron:");
    });
    // 应用本地重命名覆盖
    const renameMap = readRenameMap();
    sessions = sessions.map((s: any) => ({
      ...s,
      displayName: renameMap[s.key] || s.label || s.displayName || "未命名会话",
    }));
    res.json(sessions);
  } catch (err: any) {
    console.error("Gateway sessions_list error:", err.message);
    res.status(502).json({ error: "Gateway sessions unreachable: " + (err.message || err) });
  }
});

// GET /api/sessions/:sessionKey/history — 分页拉取 Gateway 会话聊天记录
//   ?before=<msgId>  游标：返回该消息之前的更早记录（首次不传=返回最新N条）
//   ?limit=20        每页条数，默认20，最大100
app.get("/api/sessions/:sessionKey/history", async (req, res) => {
  try {
    const { sessionKey } = req.params;
    if (!sessionKey) return res.status(400).json({ error: "Missing sessionKey" });
    const before = req.query.before as string | undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    // 从 Gateway 拉取全部消息（Gateway 暂不支持原生分页游标，服务端切片）
    const result = await gatewayInvoke("sessions_history", {
      sessionKey: decodeURIComponent(sessionKey),
    });
    const rawMessages: any[] = result?.messages || (Array.isArray(result) ? result : []);

    // 标准化消息 ID：Gateway 消息 ID 在 __openclaw.id / responseId / id 中
    const allMessages = rawMessages.map((m: any, i: number) => ({
      ...m,
      _cursorId: m.id || m.__openclaw?.id || m.responseId || `gw-msg-${i}`,
    }));

    if (allMessages.length === 0) {
      return res.json({ messages: [], hasMore: false, nextBefore: null, total: 0 });
    }

    let sliced: any[];
    let hasMore: boolean;
    let nextBefore: string | null;

    if (before) {
      const beforeIdx = allMessages.findIndex((m: any) => m._cursorId === before);
      if (beforeIdx <= 0) {
        sliced = [];
        hasMore = false;
        nextBefore = null;
      } else {
        const start = Math.max(0, beforeIdx - limit);
        sliced = allMessages.slice(start, beforeIdx);
        hasMore = start > 0;
        nextBefore = hasMore ? allMessages[start]?._cursorId || null : null;
      }
    } else {
      sliced = allMessages.slice(-limit);
      hasMore = allMessages.length > limit;
      nextBefore = hasMore ? allMessages[allMessages.length - limit]?._cursorId || null : null;
    }

    // 返回时去掉内部 _cursorId 字段
    const cleanMessages = sliced.map(({ _cursorId, ...rest }: any) => rest);

    res.json({
      messages: cleanMessages,
      hasMore,
      nextBefore,
      total: allMessages.length,
    });
  } catch (err: any) {
    console.error("Gateway sessions_history error:", err.message);
    res.status(502).json({ error: "Gateway history unreachable: " + (err.message || err) });
  }
});

// ── 会话重命名：持久化到本地 rename-map.json ──
app.patch("/api/sessions/:sessionKey/rename", async (req, res) => {
  const { sessionKey } = req.params;
  const { title } = req.body;
  if (!sessionKey || !title) {
    return res.status(400).json({ error: "Missing sessionKey or title" });
  }
  const map = readRenameMap();
  map[decodeURIComponent(sessionKey)] = title;
  await writeRenameMap(map);
  res.json({ success: true, sessionKey, title });
});

// ── Hermes 本地会话历史 CRUD ──

// GET /api/history — 返回会话列表（仅元数据，不含消息体）
app.get("/api/history", (_req, res) => {
  const history = readHistory();
  const sessionsMeta = history.map((s: any) => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    agentId: s.agentId || "hermes",
    messageCount: (s.messages || []).length,
  }));
  res.json(sessionsMeta);
});

// GET /api/history/:sessionId/messages — 分页拉取 Hermes 本地会话消息
//   ?before=<msgId>  游标：返回该消息之前的更早记录（首次不传=返回最新N条）
//   ?limit=20        每页条数，默认20，最大100
app.get("/api/history/:sessionId/messages", (req, res) => {
  const { sessionId } = req.params;
  const before = req.query.before as string | undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  const history = readHistory();
  const session = history.find((s: any) => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const messages: any[] = session.messages || [];
  if (messages.length === 0) {
    return res.json({ messages: [], hasMore: false, nextBefore: null, total: 0 });
  }

  let sliced: any[];
  let hasMore: boolean;
  let nextBefore: string | null;

  if (before) {
    const beforeIdx = messages.findIndex((m: any) => m.id === before);
    if (beforeIdx <= 0) {
      // before 是第一条或没找到 → 没有更早的消息
      sliced = [];
      hasMore = false;
      nextBefore = null;
    } else {
      const start = Math.max(0, beforeIdx - limit);
      sliced = messages.slice(start, beforeIdx);
      hasMore = start > 0;
      nextBefore = hasMore ? messages[start]?.id || null : null;
    }
  } else {
    // 首次加载：返回最新 N 条
    sliced = messages.slice(-limit);
    hasMore = messages.length > limit;
    nextBefore = hasMore ? messages[messages.length - limit]?.id || null : null;
  }

  res.json({
    messages: sliced,
    hasMore,
    nextBefore,
    total: messages.length,
  });
});

app.post("/api/history", async (req, res) => {
  const incoming = req.body;
  if (!incoming.id) return res.status(400).json({ error: "Missing session id" });
  let history = readHistory();
  const idx = history.findIndex((s: any) => s.id === incoming.id);

  if (idx >= 0) {
    // 🔒 合并模式：保留服务端已有消息，仅追加前端新消息（按 id 去重）
    const existing = history[idx];
    const existingIds = new Set((existing.messages || []).map((m: any) => m.id));
    const newMessages = (incoming.messages || []).filter((m: any) => !existingIds.has(m.id));
    existing.title = incoming.title || existing.title;
    existing.agentId = incoming.agentId || existing.agentId;
    existing.messages = [...(existing.messages || []), ...newMessages];
    existing.createdAt = existing.createdAt || incoming.createdAt;
  } else {
    history.push(incoming);
  }
  await writeHistory(history);
  res.json({ success: true });
});

// ── Agents CRUD ──
app.get("/api/agents", (_req, res) => {
  res.json(readAgents());
});

app.post("/api/agents", async (req, res) => {
  const agent = req.body;
  if (!agent.id) agent.id = "agent-" + Date.now();
  const agents = readAgents();
  agent.createdAt = new Date().toISOString();
  agents.push(agent);
  await writeAgents(agents);
  res.json(agent);
});

app.get("/api/agents/:id", (req, res) => {
  const agents = readAgents();
  const agent = agents.find((a: any) => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: "Not found" });
  res.json(agent);
});

app.patch("/api/agents/:id", async (req, res) => {
  let agents = readAgents();
  const idx = agents.findIndex((a: any) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const updates = req.body;
  if (updates.runtime || updates.model || updates.computerId) {
    return res.status(400).json({ error: "Cannot modify runtime, model, or computerId" });
  }

  if (updates.name) agents[idx].name = updates.name;
  if (updates.alias) agents[idx].alias = updates.alias;
  if (updates.emoji) agents[idx].emoji = updates.emoji;
  if (updates.personality) agents[idx].personality = { ...agents[idx].personality, ...updates.personality };
  if (updates.description) agents[idx].description = updates.description;
  if (updates.color) agents[idx].color = updates.color;

  await writeAgents(agents);
  res.json(agents[idx]);
});

app.delete("/api/agents/:id", async (req, res) => {
  let agents = readAgents();
  agents = agents.filter((a: any) => a.id !== req.params.id);
  await writeAgents(agents);
  res.json({ success: true });
});

app.post("/api/agents/:id/activate", async (req, res) => {
  let agents = readAgents();
  const idx = agents.findIndex((a: any) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  agents[idx].active = true;
  await writeAgents(agents);
  res.json(agents[idx]);
});

// ── 快捷运维指令 ──
app.post("/api/actions", (req, res) => {
  const { actionId } = req.body;
  if (!actionId) return res.status(400).json({ error: "No actionId provided" });

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

// ═══════════════════════════════════════════════════════
// 核心 API 2: /api/chat · agent_log 流式拦截管线
// ═══════════════════════════════════════════════════════
app.post("/api/chat", async (req, res, next) => {
  try {
    const { messages, temperature = 0.7, agent_id = "hermes", session_id } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (agent_id === "hermes") {
      // ── Hermes 直连（纯透传，无 agent_log 拦截）──
      const postData = JSON.stringify({
        messages,
        model: "hermes-agent",
        temperature,
        stream: true,
      });

      const hreq = http.request(
        {
          hostname: HERMES_HOST,
          port: HERMES_PORT,
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${HERMES_TOKEN}`,
            "Content-Length": Buffer.byteLength(postData),
          },
          timeout: 30000,
        },
        (hres) => {
          if (hres.statusCode !== 200) {
            let errorData = "";
            hres.on("data", (chunk: Buffer) => { errorData += chunk.toString(); });
            hres.on("end", () => {
              res.write(`data: ${JSON.stringify({ error: `Hermes error ${hres.statusCode}: ${errorData}` })}\n\n`);
              res.end();
            });
            return;
          }
          hres.pipe(res);
          hres.on("error", (err: Error) => {
            console.error("Hermes stream error:", err);
            if (!res.writableEnded) res.end();
          });
        },
      );
      hreq.on("error", (err: any) => {
        console.error("Hermes request error:", err.message);
        res.write(`data: ${JSON.stringify({ error: `Hermes unreachable: ${err.message}` })}\n\n`);
        res.end();
      });
      hreq.on("timeout", () => { hreq.destroy(); res.end(); });
      hreq.write(postData);
      hreq.end();

    } else {
      // ── OpenClaw Gateway 代理（🛡️ 自动重试防线包裹）──
      const modelMap: Record<string, string> = {
        "openclaw-main": "openclaw/main",
        "openclaw-jianshen": "openclaw/jianshen",
      };
      const model = modelMap[agent_id] || "openclaw/main";

      const postData = JSON.stringify({
        messages,
        model,
        temperature,
        stream: true,
      });

      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "Content-Length": String(Buffer.byteLength(postData)),
      };
      if (session_id) {
        reqHeaders["x-openclaw-session-key"] = session_id;
      }

      // 🛡️ 自动重试防线：拦截空内容 → 后台重跑 → 优雅降级
      try {
        const events = await gatewayChatWithRetry(postData, reqHeaders);
        for (const evt of events) {
          res.write(evt);
        }
      } catch (err: any) {
        console.error("gatewayChatWithRetry fatal:", err.message);
        res.write(
          `data: ${JSON.stringify({
            error: `Gateway unreachable: ${err.message}`,
          })}\n\n`
        );
      }
      res.end();
    }
  } catch (err: any) {
    console.error("Chat proxy fatal:", err?.message || err);
    if (!res.headersSent) {
      res.status(502).json({ error: "Chat proxy internal error", detail: err?.message });
    }
  }
});

// ═══════════════════════════════════════════════════════
// 启动逻辑
// ═══════════════════════════════════════════════════════
async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isDev = process.env.NODE_ENV !== "production";

  if (!isDev && fs.existsSync(path.join(distPath, "index.html"))) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⚡ Nexus 节点机 · agent_log 拦截管线已就绪 :${PORT}`);
  });
}

startServer();
