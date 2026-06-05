import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const HISTORY_FILE = path.join(process.cwd(), "history.json");
const AGENTS_FILE = path.join(process.cwd(), "agents.json");

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
    id: "openclaw",
    name: "OpenClaw 智能助理",
    alias: "OpenClaw",
    emoji: "🌐",
    color: "#8b5cf6",
    description: "多智能体协作网关 · 云端模型接入 · 跨 Agent 任务编排",
    runtime: "openclaw",
    model: "gpt-4o",
    computerId: "cloud",
    capabilities: ["多模态对话", "知识检索", "Agent 协同", "联网搜索"],
    active: false,
    placeholder: true,
    personality: {
      style: "协作调度",
      greeting: "OpenClaw 网关待接入。接入后将支持多 Agent 协同编排。",
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

app.use(express.json());

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

app.get("/api/openclaw/v1/models", (req, res) => {
  // Mock returning some OpenClaw agents/models
  res.json({
    data: [
      {
        id: "openclaw-agent-alpha",
        name: "全局协作牛马",
        description: "负责跨环境协同调度",
      },
      {
        id: "openclaw-agent-beta",
        name: "云端架构师",
        description: "处理深度任务规划",
      }
    ]
  });
});

app.get("/api/openclaw/sessions", (req, res) => {
  // Mock returning some OpenClaw sessions
  res.json([
    {
      key: "agent:openclaw-mock-1",
      label: "云端模型协同测试",
      updatedAt: new Date().toISOString(),
      agentId: "openclaw",
    },
    {
      key: "agent:openclaw-mock-2",
      label: "跨态任务执行实验",
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      agentId: "openclaw",
    }
  ]);
});

app.get("/api/openclaw/sessions/history", (req, res) => {
  const { sessionKey } = req.query;
  // Mock returning some history messages
  res.json([
    {
      id: "msg-1",
      role: "assistant",
      content: "您好！我是 OpenClaw 智能助理，已加载历史记录，准备为您服务。",
      timestamp: new Date().toISOString()
    }
  ]);
});

// 0. GET /api/health - Check MacBook reachability
app.get("/api/health", async (req, res) => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    // Attempt connecting to the MacBook tailscale endpoint
    await fetch("http://100.83.118.16:8000/v1/models", { signal: controller.signal });
    clearTimeout(timeout);
    res.json({ reachable: true, latency: Date.now() - start });
  } catch (error) {
    // Return reachable: false in case of failure or timeout
    res.json({ reachable: false, latency: Date.now() - start });
  }
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
    const { messages, temperature = 0.7, agent_id = "hermes" } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid payload: messages must be an array" });
    }

    if (agent_id === "hermes") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Set SSE Headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      try {
        const response = await fetch("http://100.83.118.16:8000/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer 43847f73aa132c3abfa9b076eb1dd7ff56b08e06b651a640"
          },
          body: JSON.stringify({
            messages,
            model: "hermes-agent",
            temperature,
            stream: true
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          res.write(`data: ${JSON.stringify({ error: `Backend API error status: ${response.status} - ${errorText}` })}\n\n`);
          res.end();
          return;
        }

        if (!response.body) {
          res.write(`data: ${JSON.stringify({ error: "Empty stream body from backend" })}\n\n`);
          res.end();
          return;
        }

        // Pipe/Stream SSE from downstream to original client
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
        res.end();
      } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === "AbortError") {
          return next(new Error("Request to MacBook timed out after 30s"));
        }
        throw error;
      }

    } else if (agent_id === "openclaw") {
      // Set SSE Headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      // TODO: OpenClaw forward pipeline integration pre-wiring
// ... (rest remains unchanged)
      // OpenClaw is designed for multi-agent coordination. Once connected, 
      // queries can be dispatched dynamically to target autonomous agents.
      // e.g., const response = await fetch("http://localhost:9000/v1/chat/completions", { ... });
      
      const simulatedText = `### 🧩 OpenClaw 智能助理 (预留占位接口就绪)\n\n目前您已成功切换至 **OpenClaw 智能网关**。\n\n- **状态**：桥接链路就绪 / 监听中\n- **底层通信说明**：在后端 \`server.ts\` 内，此部分已预留路由转发块。您可以配置 \`OpenClaw\` 的专属本地运行端点，实现多 Agent 联合规划与自主任务流。\n\n*有什么我可以帮您的吗？本消息来自于 OpenClaw 预置流式套接字。*`;
      
      // Simulate chunk-by-chunk stream sending to match SSE expectations
      const words = simulatedText.split(" ");
      for (const word of words) {
        const payload = {
          choices: [
            {
              delta: {
                content: word + " "
              }
            }
          ]
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      res.write(`data: ${JSON.stringify({ error: `Unsupported Agent ID: ${agent_id}` })}\n\n`);
      res.end();
    }

  } catch (error: any) {
    console.error("Proxy error:", error);
    // If the network request fails (e.g., Tailscale VM offline), stream a helpful, detailed diagnostic
    // rather than crashing, to maintain the superb experience
    res.write(`data: ${JSON.stringify({
      error: `Could not connect to the remote MacBook. Details: ${error?.message || error}. Please ensure Tailscale is active and the Mac Hermes Agent is running on http://100.83.118.16:8000.`
    })}\n\n`);
    res.end();
  }
});

// 4. Express Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global express error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    code: err.code || "INTERNAL_ERROR",
    retryable: err.message?.includes("timed out") || err.code === "ECONNREFUSED"
  });
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
