export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  agentId?: string; // which agent this session belongs to
}

export interface HardwareStats {
  cpuLoad: number;
  memoryUsage: number;
  cpuTemp: number;
  diskUsage: number;
  uptime: string;
}

export interface ServerAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  command: string;
}

export interface OpenClawAgent {
  id: string;
  name: string;
}

export interface OpenClawSession {
  key: string;
  agentId: string;
  label: string;
  displayName: string;
  channel: string;
  status: "done" | "running" | "idle";
  updatedAt: number;
  totalTokens: number;
  estimatedCostUsd: number;
  model: string;
  kind?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  alias: string;
  emoji: string;
  color: string;
  description: string;
  runtime: string;
  model: string;
  computerId: string;
  active: boolean;
  capabilities: string[];
  placeholder?: boolean;
  personality: {
    style: string;
    greeting: string;
  };
  createdAt?: string;
}

export type Agent = AgentConfig;

export const AGENTS: Record<string, Agent> = {
  hermes: {
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
  openclaw: {
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
  claude: {
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
  codex: {
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
};
