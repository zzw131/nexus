// 写死单一模型 — 当前仅使用 DeepSeek V4 Pro，无需切换

export function ModelSelector() {
  return (
    <div className="relative inline-block text-left text-[13px] font-sans">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200 border border-zinc-200/20 dark:border-white/5 transition-all duration-200 shadow-sm">
        <span className="text-sm select-none">🌌</span>
        <span className="font-medium tracking-tight text-[12px]">DeepSeek V4 Pro</span>
      </div>
    </div>
  );
}
