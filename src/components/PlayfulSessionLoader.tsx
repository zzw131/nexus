import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cpu, Terminal, Radio, Sparkles, Layers, ShieldCheck, Database, Coffee, HelpCircle, Flame, Cat, GlassWater } from "lucide-react";

interface PlayfulSessionLoaderProps {
  agentName?: string;
  agentEmoji?: string;
}

const FUNNY_POOL = [
  { text: "🍳 正在帮 CPU 煎个双面蛋，降低量子纠缠温度...", icon: Cpu, color: "text-blue-500" },
  { text: "💾 正在给闪存芯片吹气，以清理由于幻觉积累的陈年老尘...", icon: Radio, color: "text-amber-400" },
  { text: "🛸 正在拦截向外星人发送的未经授权加密脑电波信号...", icon: Sparkles, color: "text-purple-400" },
  { text: "🐱 成功诱捕了一只正在踩键盘的橘猫，系统输入恢复正常...", icon: Cat, color: "text-emerald-400" },
  { text: "🍕 正在向后端服务器外卖分配一份虚拟披萨作为思考燃料...", icon: Flame, color: "text-rose-500" },
  { text: "🔮 正在通过玄学罗盘推演最优的代码编译超级频率...", icon: HelpCircle, color: "text-indigo-400" },
  { text: "🧪 正在试图说服控制台报错 bug 们自我和解并原谅人类...", icon: ShieldCheck, color: "text-teal-400" },
  { text: "☕ 正在向虚拟机注入双份浓缩美式，激发极致响应延迟...", icon: Coffee, color: "text-amber-600" },
  { text: "🎪 正在组织底层的 if-else 逻辑链路进行马戏团空中杂耍...", icon: Layers, color: "text-sky-400" },
  { text: "🧘 正在引导核心线程进行深度禅修，清空死锁的世俗烦恼...", icon: GlassWater, color: "text-violet-400" },
  { text: "🦖 正在阻止经典恐龙小游戏里的绿翼龙抢占当前的渲染管线...", icon: Terminal, color: "text-lime-500" },
  { text: "🧦 正在通过量子力学，跨视窗寻找昨天神秘失踪的袜子片区...", icon: Database, color: "text-fuchsia-400" }
];

export function PlayfulSessionLoader({
  agentName = "Hermes 核心大脑",
  agentEmoji = "🧠",
}: PlayfulSessionLoaderProps) {
  const [funnyText, setFunnyText] = useState("");

  // Cycle through funny loading texts
  useEffect(() => {
    const selectRandom = () => {
      const idx = Math.floor(Math.random() * FUNNY_POOL.length);
      setFunnyText(FUNNY_POOL[idx].text);
    };

    selectRandom();
    const interval = setInterval(selectRandom, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto select-none min-h-[55vh]">
      
      {/* Visual Track Area for the rolling brain */}
      <div className="relative w-72 h-20 flex items-end justify-center mb-8 border-b border-dashed border-zinc-200 dark:border-zinc-800/80 pb-0.5">
        
        {/* Holographic Ambient Glow beneath the track line */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-blue-500/15 to-transparent blur-xs" />
        
        {/* Rolling Agent card */}
        <motion.div
          animate={{
            x: [-85, 85],
            rotate: [-360, 360],
          }}
          transition={{
            x: {
              duration: 3.2,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            },
            rotate: {
              duration: 3.2,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }
          }}
          className="relative z-10 w-16 h-16 rounded-[22px] bg-gradient-to-tr from-white to-zinc-50 dark:from-[#1e1f20] dark:to-[#2a2b2d] border border-zinc-200/50 dark:border-zinc-800/80 flex flex-col items-center justify-center shadow-md cursor-grab active:cursor-grabbing"
        >
          {/* Subtle inner ring ornament */}
          <div className="absolute inset-[3px] rounded-[18px] border border-dashed border-zinc-200/30 dark:border-zinc-800/30 pointer-events-none" />
          
          <span className="text-2xl leading-none drop-shadow-sm">
            {agentEmoji}
          </span>
          <span className="text-[7.5px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase mt-0.5 font-bold">
            LIVE
          </span>
        </motion.div>
      </div>

      {/* Main Status Text */}
      <div className="space-y-1 text-center w-full max-w-md">
        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
          正在载入 {agentName} 秘境空间...
        </h4>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tracking-normal">
          端口 :3000 • 遥测核心激活中 • 离线数据索引
        </p>
      </div>

      {/* Single Dynamic Playful Phrase (Swaps elegantly) */}
      <div className="h-10 flex items-center justify-center w-full max-w-md mt-6 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/30 dark:border-zinc-800/30 rounded-xl py-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={funnyText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="text-xs text-zinc-500 dark:text-zinc-400 font-sans text-center tracking-tight"
          >
            {funnyText}
          </motion.p>
        </AnimatePresence>
      </div>

    </div>
  );
}
