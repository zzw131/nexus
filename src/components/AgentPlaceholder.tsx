import React from 'react';
import { Sparkles, Construction } from 'lucide-react';

interface AgentPlaceholderProps {
  agentName: string;
}

export function AgentPlaceholder({ agentName }: AgentPlaceholderProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none overflow-hidden h-full min-h-0 w-full relative">
      <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-400 via-transparent to-transparent"></div>
      <div className="relative z-10 w-24 h-24 mb-6 rounded-3xl bg-zinc-200/50 dark:bg-zinc-800/50 flex items-center justify-center shadow-inner">
        <Sparkles className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
      </div>
      <h3 className="relative z-10 text-xl font-bold text-zinc-700 dark:text-zinc-200 mb-2 font-sans tracking-tight">
        {agentName}
      </h3>
      <div className="relative z-10 mb-5 px-3 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-zinc-800/30 text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 shadow-xs">
        <Construction className="w-3.5 h-3.5" />
        <span>预留接口，即将上线</span>
      </div>
      <p className="relative z-10 text-[13px] text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
        该 Agent 正在开发中，敬请期待。你可以先使用 Hermes 核心大脑进行对话。
      </p>
    </div>
  );
}
