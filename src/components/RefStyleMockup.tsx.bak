import React from "react";
import { Zap, ChevronDown } from "lucide-react";

export function RefStyleMockup() {
  return (
    <div className="relative w-full max-w-xl mx-auto rounded-[24px] overflow-hidden p-[1px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
      {/* Animated Conic Gradient Layer */}
      <div className="absolute inset-[-200%] m-auto w-[400%] aspect-square animate-[spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_20deg,theme(colors.red.400)_40deg,theme(colors.orange.400),theme(colors.amber.300),theme(colors.emerald.400),theme(colors.cyan.400),theme(colors.blue.500),theme(colors.indigo.500),theme(colors.purple.500),theme(colors.pink.400),theme(colors.red.400)_320deg,transparent_340deg,transparent_360deg)]" />

      {/* Inner White Mask (Background) & Content Wrapper */}
      <div className="relative w-full bg-white dark:bg-[#131118] rounded-[22.5px] overflow-hidden transition-all duration-300">
      
      {/* 1. Full-Width Header Area */}
      <div className="relative w-full px-6 py-4.5 md:px-8 md:py-5 backdrop-blur-md bg-zinc-50/80 dark:bg-zinc-900/40 border-b border-zinc-200/50 dark:border-white/5 flex items-center justify-between gap-4 select-none rounded-t-[22.5px]">
          {/* Lightning Bolt Icon (Animated sweep/pulse) */}
          <div className="relative flex items-center justify-center text-zinc-800 dark:text-zinc-100 shrink-0">
            <Zap className="w-[18px] h-[18px] text-zinc-900 dark:text-neutral-50 fill-none stroke-[1.8] animate-pulse" />
            {/* Soft inner glow */}
            <div className="absolute inset-[-4px] rounded-full bg-amber-400/10 blur-[2px] animate-pulse" />
          </div>

          {/* Central Translucent White Capsule Pill (The loading bar) */}
          <div className="flex-1 h-5.5 bg-white shadow-sm dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/20 rounded-full relative overflow-hidden select-none">
            {/* Realistically loading progress bar */}
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400/50 via-indigo-400/50 to-purple-400/50 rounded-full animate-loader-progress" />
          </div>

          {/* Right Chevron Down Dropdown */}
          <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 transition-transform duration-300 group-hover:translate-y-[1px]" />
        </div>

      {/* 2. High-Density Typography Card Body */}
      <div className="p-6 md:p-8 pt-4 md:pt-5 space-y-2 select-text rounded-b-[22.5px]">
        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
          Add low-latency responses
        </h4>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
          Add lightning-fast, real-time responses to your app using Flash-Lite. Perfect for instant auto-completes, or conversational agents that feel alive.
        </p>
      </div>
      </div>
    </div>
  );
}
