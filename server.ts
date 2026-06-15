/**
 * Nexus 节点机 · 后端纯代理（第二阶段·实时流管线版）
 * 
 * 功能：接收前端 /api/chat 请求 → 纯透明转发至 MacBook OpenClaw Gateway
 *       SSE 流式透传 → 前端打字机渲染
 * 
 * 【铁律】不碰数据库、不碰 prisma、不碰 history.json、不存储任何消息
 */

import express from "express";
import path from "path";
import fs from "fs";
import http from "http";

const app = express();
const PORT = 3210;

// ── Gateway 配置 ──
const GATEWAY_HOST = "100.83.118.16";
const GATEWAY_PORT = 18789;
const GATEWAY_TOKEN = "0e41fa7f04c5cca00fa7d492e60fdf75769d8fc99cb218f7";
const GATEWAY_CHAT_PATH = "/v1/chat/completions";
const PROXY_TIMEOUT_MS = 300_000; // 5 分钟

// ── CORS ──
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// ── JSON 解析 ──
app.use(express.json({ limit: "1mb" }));

// ── 健康检查 ──
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── /api/chat · 绝对纯净水管 → MacBook Gateway ──
app.post("/api/chat", (req, res) => {
  try {
    const { messages, temperature } = req.body;

    // 参数校验
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages 数组不能为空" });
      return;
    }

    // 构造发给 Gateway 的请求体
    const payload = JSON.stringify({
      model: "openclaw",
      messages,
      stream: true,
      temperature: temperature ?? 0.7,
      max_tokens: 4096,
    });

    console.log(`🚰 [水管] 转发 ${messages.length} 条消息 → Gateway`);

    const proxyReq = http.request(
      {
        hostname: GATEWAY_HOST,
        port: GATEWAY_PORT,
        path: GATEWAY_CHAT_PATH,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GATEWAY_TOKEN}`,
          "Content-Length": Buffer.byteLength(payload),
          Accept: "text/event-stream",
        },
        timeout: PROXY_TIMEOUT_MS,
      },
      (proxyRes) => {
        const statusCode = proxyRes.statusCode || 500;

        // Gateway 返回非 2xx → 收集错误信息返回前端
        if (statusCode >= 400) {
          let body = "";
          proxyRes.on("data", (chunk: Buffer) => (body += chunk.toString()));
          proxyRes.on("end", () => {
            console.error(`❌ Gateway 返回 ${statusCode}: ${body.slice(0, 300)}`);
            if (!res.headersSent) {
              res.status(502).json({
                error: "Gateway 返回错误",
                status: statusCode,
                detail: body.slice(0, 500),
              });
            }
          });
          return;
        }

        // ✅ 正常流式响应 → 设置 SSE 头并管道透传
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        proxyRes.pipe(res);

        proxyRes.on("error", (err) => {
          console.error("Gateway 流中断:", err.message);
          if (!res.writableEnded) res.end();
        });
      }
    );

    // ── 错误处理（绝不抛出未捕获异常）──
    proxyReq.on("error", (err: NodeJS.ErrnoException) => {
      console.error("🔴 Gateway 连接失败:", err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Gateway 不可达",
          detail: err.message,
          hint: "请确认 MacBook Tailscale 在线，Gateway 运行于 100.83.118.16:18789",
        });
      }
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      console.error("⏰ Gateway 请求超时");
      if (!res.headersSent) {
        res.status(504).json({ error: "Gateway 请求超时" });
      }
    });

    proxyReq.write(payload);
    proxyReq.end();
  } catch (err: any) {
    // ── 最终兜底，绝不崩溃 ──
    console.error("💥 /api/chat 致命异常:", err?.message || err);
    if (!res.headersSent) {
      res.status(502).json({
        error: "代理内部异常",
        detail: err?.message || String(err),
      });
    }
  }
});

// ── 启动 ──
async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isDev = process.env.NODE_ENV !== "production";

  if (!isDev && fs.existsSync(path.join(distPath, "index.html"))) {
    // 生产：静态托管
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // 开发：vite dev server
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⚡ Zzw · Nexus 节点机 → Gateway 水管已接通 :${PORT}`);
  });
}

startServer();
