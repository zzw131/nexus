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
    description:
      "端侧大语言模型推理引擎，基于 llama.cpp · 高频指令调度 · 本地隐私安全",
    runtime: "llama",
    model: "llama-3-8b-instruct",
    computerId: "mac",
    capabilities: ["文本对话", "代码生成", "指令调度", "系统运维"],
    active: true,
    personality: {
      style: "专业沉稳",
      greeting: "你好，我是 Hermes。本地推理引擎已就绪，随时为你服务。",
    },
  },
  "openclaw-main": {
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
  "openclaw-jianshen": {
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
    },
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
    },
  },
};
