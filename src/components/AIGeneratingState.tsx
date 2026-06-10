import React from "react";

/**
 * AIGeneratingState (AI正在思考时的流式状态组件)
 * 
 * 核心功能：
 * 1. 负责在 AI 给定回复前（或正在输出时）显示动态加载动画。
 * 2. 包含一个极其科技感的彩带扫光边缘特效（Animated Conic Gradient Layer）。
 * 3. 并配合内层的细微进度条和骨架屏脉冲动画（Skeleton & Loader Progress）。
 * 4. 支持 reasoningText 实时打字机文字显示。
 *
 * 与主应用剥离，极大增强了组件的独立模块化及代码阅读性。
 */
interface AIGeneratingStateProps {
  agentName: string;
  reasoningText?: string;
}

export function AIGeneratingState({
  agentName = "Hermes",
  reasoningText = "",
}: AIGeneratingStateProps) {
  return (
    <div className="space-y-4 w-full max-w-xl">
      <div className="relative w-full rounded-[24px] overflow-hidden p-[1px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        {/* Animated Conic Gradient Layer */}
        <div className="absolute inset-[-200%] m-auto w-[400%] aspect-square animate-[spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_20deg,theme(colors.red.400)_40deg,theme(colors.orange.400),theme(colors.amber.300),theme(colors.emerald.400),theme(colors.cyan.400),theme(colors.blue.500),theme(colors.indigo.500),theme(colors.purple.500),theme(colors.pink.400),theme(colors.red.400)_320deg,transparent_340deg,transparent_360deg)]" />

        {/* Inner White Mask (Background) & Content Wrapper */}
        <div className="relative w-full bg-white dark:bg-[#131118] rounded-[22.5px] overflow-hidden transition-all duration-300">
        
          {/* Full-Width Header Area */}
          <div className="relative w-full px-5.5 py-4 backdrop-blur-md bg-zinc-50/80 dark:bg-zinc-900/40 border-b border-zinc-200/50 dark:border-white/5 flex items-center justify-between gap-4 select-none rounded-t-[22.5px]">
            {/* Logo Container inside capsule */}
            <div className="relative flex items-center justify-center w-5.5 h-5.5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-[10px] shadow-sm shrink-0">
              <span>N</span>
              {/* Pulsing indicator */}
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            </div>

            {/* Translucent pill loader bar */}
            <div className="flex-1 h-4.5 bg-white shadow-sm dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/20 rounded-full relative overflow-hidden select-none">
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400/50 via-indigo-400/50 to-purple-400/50 rounded-full animate-loader-progress" />
            </div>

            {/* Running Pulse state dots */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>

          {reasoningText ? (
            /* ── 思考态：实时打字机文字显示 ── */
            <div className="p-5.5 pt-4 select-text rounded-b-[22.5px]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <h4 className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
                  {agentName} 神经网络处理中...
                </h4>
              </div>
              
              {/* Real-time typing/reasoning text area with typewriter-style blinking indicator */}
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-sans whitespace-pre-wrap leading-relaxed mt-3 px-1 break-words">
                {reasoningText}
                <span className="inline-block w-[2px] h-3.5 bg-blue-500/80 dark:bg-blue-400/80 animate-pulse ml-1.5 align-middle" />
              </p>
            </div>
          ) : (
            /* ── 初始加载态：骨架屏脉冲动画 ── */
            <div className="p-5.5 pt-4 space-y-3.5 select-text bg-white/40 dark:bg-[#131118]/45 rounded-b-[22.5px]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <h4 className="text-[13px] font-bold text-zinc-850 dark:text-zinc-100 font-sans tracking-tight animate-pulse">
                  {agentName} 神经网络节点正在处理流式输出...
                </h4>
              </div>
              <div className="space-y-2">
                <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg w-[95%] animate-pulse" />
                <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg w-[80%] animate-pulse" style={{ animationDelay: "200ms" }} />
                <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg w-[45%] animate-pulse" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
