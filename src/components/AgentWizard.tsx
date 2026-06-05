import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Server, Cpu, Check, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";

interface AgentWizardProps {
  onClose: () => void;
  onComplete: (newAgent: any) => void;
}

export default function AgentWizard({ onClose, onComplete }: AgentWizardProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    name: "",
    alias: "",
    emoji: "🤖",
    description: "",
    computeNode: "mac",
    runtime: "",
    model: ""
  });

  const runtimes = [
    { id: "llama", name: "llama.cpp", desc: "本地推理引擎", color: "border-emerald-500/50", bg: "bg-emerald-500/10" },
    { id: "openclaw", name: "OpenClaw Gateway", desc: "多智能体协作网关", color: "border-purple-500/50", bg: "bg-purple-500/10" },
    { id: "claude", name: "Claude Code", desc: "Anthropic 命令行工具", color: "border-orange-500/50", bg: "bg-orange-500/10" },
    { id: "codex", name: "Codex", desc: "OpenAI 代码核心", color: "border-blue-500/50", bg: "bg-blue-500/10" }
  ];

  const modelsByRuntime: Record<string, { id: string, name: string, window: string, speed: string }[]> = {
    llama: [
      { id: "qwen-14b", name: "Qwen 2.5 14B Q4_K_M", window: "32K", speed: "⚡⚡⚡" },
      { id: "llama-3", name: "Llama 3 8B Instruct", window: "8K", speed: "⚡⚡⚡⚡" }
    ],
    openclaw: [
      { id: "gpt-4o", name: "GPT-4o (Azure)", window: "128K", speed: "⚡⚡" },
      { id: "gemini-1.5", name: "Gemini 1.5 Pro", window: "1M", speed: "⚡⚡⚡" }
    ],
    claude: [
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", window: "200K", speed: "⚡⚡⚡" }
    ],
    codex: [
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", window: "128K", speed: "⚡⚡⚡" }
    ]
  };

  const currentModels = config.runtime ? modelsByRuntime[config.runtime] || [] : [];

  const handleNext = () => {
    if (step === 1 && (!config.name || !config.alias)) return;
    if (step === 3 && !config.runtime) return;
    if (step === 4 && !config.model) return;
    
    if (step < 5) {
      setStep(s => s + 1);
    } else {
      // Complete
      const randomId = "agent-" + Date.now();
      const runtimeDef = runtimes.find(r => r.id === config.runtime);
      let newColor = "#818cf8"; // defaults to indigo
      if (runtimeDef) {
         if (runtimeDef.id === "llama") newColor = "#10b981"; // emerald
         if (runtimeDef.id === "openclaw") newColor = "#a855f7"; // purple
         if (runtimeDef.id === "claude") newColor = "#f97316"; // orange
         if (runtimeDef.id === "codex") newColor = "#3b82f6"; // blue
      }
      
      onComplete({
        id: randomId,
        name: config.name,
        alias: config.alias,
        emoji: config.emoji || "🤖",
        color: newColor,
        description: config.description || "自定义接驳引擎模式",
        runtime: config.runtime,
        model: config.model,
        computerId: config.computeNode,
        capabilities: ["动态接入"],
        active: true,
        personality: {
          style: "默认",
          greeting: `你好，我是 ${config.alias}。引擎已就绪。`
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-white dark:bg-[#121215] border border-zinc-200/50 dark:border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              接入新 Agent 引擎
            </h2>
            <button 
              onClick={onClose} 
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-1 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: step >= i ? "100%" : "0%" }}
                  className="h-full bg-indigo-500"
                />
              </div>
            ))}
          </div>
          <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
            Step {step} of 5
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto max-h-[60vh] min-h-[300px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-4">设定基本身份</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Agent 名称 *</label>
                    <input 
                      type="text" 
                      value={config.name} 
                      onChange={e => setConfig({...config, name: e.target.value})} 
                      placeholder="例：Hermes 核心大脑" 
                      className="w-full mt-1.5 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">简短别名 *</label>
                      <input 
                        type="text" 
                        value={config.alias} 
                        onChange={e => setConfig({...config, alias: e.target.value})} 
                        placeholder="例：Hermes" 
                        className="w-full mt-1.5 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Emoji 图标</label>
                      <input 
                        type="text" 
                        value={config.emoji} 
                        onChange={e => setConfig({...config, emoji: e.target.value})} 
                        placeholder="🤖" 
                        className="w-full mt-1.5 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500 text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">描述文案</label>
                    <textarea 
                      value={config.description} 
                      onChange={e => setConfig({...config, description: e.target.value})} 
                      placeholder="输入该 Agent 的简略描述与适用场景..." 
                      className="w-full mt-1.5 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500 min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">选择运行位置</h3>
                  <p className="text-xs text-zinc-500 mb-4">请指定该 Agent 引擎部署在哪台物理或者云端计算节点上</p>
                </div>
                
                <div 
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${config.computeNode === "mac" ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
                  onClick={() => setConfig({...config, computeNode: "mac"})}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                        <Cpu className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">MacBook 本地节点</div>
                        <div className="text-[10px] font-mono text-zinc-500">100.83.118.16</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      在线
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">⭐ 选择运行引擎 (Runtime)</h3>
                  <p className="text-xs text-rose-500 font-semibold mb-4 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> 提示：引擎类型一经创建不可更改
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {runtimes.map(rt => (
                    <div 
                      key={rt.id}
                      onClick={() => setConfig({...config, runtime: rt.id, model: ""})}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${config.runtime === rt.id ? `${rt.color} ${rt.bg}` : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
                    >
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">{rt.name}</div>
                      <div className="text-[10px] text-zinc-500 leading-relaxed">{rt.desc}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">选择载入模型</h3>
                  <p className="text-xs text-zinc-500 mb-4">根据您的引擎 ({runtimes.find(r => r.id === config.runtime)?.name}) 选择适配模型</p>
                </div>
                
                <div className="space-y-2">
                  {currentModels.map(mod => (
                    <div 
                      key={mod.id}
                      onClick={() => setConfig({...config, model: mod.id})}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${config.model === mod.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm" : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
                    >
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{mod.name}</div>
                        <div className="flex gap-3 text-[10px] text-zinc-500 mt-1">
                          <span>窗口: {mod.window}</span>
                          <span>速度: {mod.speed}</span>
                        </div>
                      </div>
                      {config.model === mod.id && <Check className="w-4 h-4 text-indigo-500" />}
                    </div>
                  ))}
                  
                  <div className="mt-3">
                     <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">手动指定模型 ID</label>
                     <input 
                       type="text"
                       value={currentModels.some(m => m.id === config.model) ? "" : config.model}
                       onChange={e => setConfig({...config, model: e.target.value})}
                       placeholder="或输入自定义 HuggingFace 路径等..."
                       className="w-full mt-1.5 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:border-indigo-500"
                     />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">配置一览与确认</h3>
                </div>
                
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 relative overflow-hidden">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{config.emoji}</div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{config.name}</div>
                      <div className="text-[10px] text-zinc-500">{config.alias}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 font-mono text-[10px]">
                    <div className="text-zinc-500">运行节点</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">{config.computeNode === "mac" ? "100.83.118.16" : config.computeNode}</div>
                    <div className="text-zinc-500">引擎 (Runtime)</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">{runtimes.find(r => r.id === config.runtime)?.name}</div>
                    <div className="text-zinc-500">模型 ID</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right truncate overflow-hidden">{config.model}</div>
                  </div>
                </div>

                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400 text-xs font-semibold flex gap-2 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  ⚠️ Agent 创建后，引擎类型和运行位置不可修改。确认后将立即在本地注入节点配置。
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
          <button 
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
              step === 1 ? "opacity-0 pointer-events-none" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            <ArrowLeft className="w-3 h-3" />
            上一步
          </button>
          
          <button 
            onClick={handleNext}
            disabled={(step === 1 && (!config.name || !config.alias)) || (step === 3 && !config.runtime) || (step === 4 && !config.model)}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
          >
            {step === 5 ? "确认创建" : (
              <>下一步 <ArrowRight className="w-3 h-3" /></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
