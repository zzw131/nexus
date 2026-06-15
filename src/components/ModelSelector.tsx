import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, Wrench, Brain, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";

interface ModelTag {
  text: string;
  color: string;
}

interface ModelDetail {
  contextLength: string;
  hasToolCalling: boolean;
  hasDeepThinking: boolean;
  inputPrice: string;
  outputPrice: string;
  cachedPrice: string;
  providers: { name: string; checked: boolean; icon: string }[];
}

interface ModelItem {
  id: string;
  name: string;
  icon: string;
  tags?: ModelTag[];
  detail: ModelDetail;
}

const MOCK_MODELS: ModelItem[] = [
  {
    id: "ds-v4-pro",
    name: "DeepSeek V4 Pro",
    icon: "🌌",
    tags: [],
    detail: {
      contextLength: "1M tokens",
      hasToolCalling: true,
      hasDeepThinking: true,
      inputPrice: "0.435M 积分/百万令牌",
      outputPrice: "0.87M 积分/百万令牌",
      cachedPrice: "0.004M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "DeepSeek", checked: true, icon: "🌌" }
      ]
    }
  },
  {
    id: "ds-v4-flash",
    name: "DeepSeek V4 Flash",
    icon: "⚡",
    tags: [],
    detail: {
      contextLength: "128K tokens",
      hasToolCalling: true,
      hasDeepThinking: false,
      inputPrice: "0.075M 积分/百万令牌",
      outputPrice: "0.15M 积分/百万令牌",
      cachedPrice: "0.001M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "DeepSeek", checked: true, icon: "🌌" }
      ]
    }
  },
  {
    id: "claude-5-fable",
    name: "Claude Fable 5",
    icon: "☄️",
    tags: [{ text: "新", color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20" }],
    detail: {
      contextLength: "200K tokens",
      hasToolCalling: true,
      hasDeepThinking: true,
      inputPrice: "3.0M 积分/百万令牌",
      outputPrice: "9.0M 积分/百万令牌",
      cachedPrice: "0.3M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Anthropic", checked: true, icon: "☄️" }
      ]
    }
  },
  {
    id: "claude-4.6-sonnet",
    name: "Claude Sonnet 4.6",
    icon: "☀️",
    tags: [{ text: "Pro", color: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20" }],
    detail: {
      contextLength: "200K tokens",
      hasToolCalling: true,
      hasDeepThinking: false,
      inputPrice: "1.5M 积分/百万令牌",
      outputPrice: "4.5M 积分/百万令牌",
      cachedPrice: "0.15M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Anthropic", checked: true, icon: "☄️" }
      ]
    }
  },
  {
    id: "claude-4.8-opus",
    name: "Claude Opus 4.8",
    icon: "🔥",
    tags: [
      { text: "新", color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20" },
      { text: "Pro", color: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20" }
    ],
    detail: {
      contextLength: "200K tokens",
      hasToolCalling: true,
      hasDeepThinking: true,
      inputPrice: "7.5M 积分/百万令牌",
      outputPrice: "22.5M 积分/百万令牌",
      cachedPrice: "0.75M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Anthropic", checked: true, icon: "☄️" }
      ]
    }
  },
  {
    id: "claude-4.7-opus",
    name: "Claude Opus 4.7",
    icon: "🔥",
    tags: [{ text: "Pro", color: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20" }],
    detail: {
      contextLength: "200K tokens",
      hasToolCalling: true,
      hasDeepThinking: false,
      inputPrice: "15.0M 积分/百万令牌",
      outputPrice: "75.0M 积分/百万令牌",
      cachedPrice: "1.5M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Anthropic", checked: true, icon: "☄️" }
      ]
    }
  },
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    icon: "☄️",
    tags: [],
    detail: {
      contextLength: "200K tokens",
      hasToolCalling: true,
      hasDeepThinking: false,
      inputPrice: "0.25M 积分/百万令牌",
      outputPrice: "1.25M 积分/百万令牌",
      cachedPrice: "0.03M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Anthropic", checked: true, icon: "☄️" }
      ]
    }
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    icon: "✨",
    tags: [],
    detail: {
      contextLength: "2M tokens",
      hasToolCalling: true,
      hasDeepThinking: false,
      inputPrice: "0.075M 积分/百万令牌",
      outputPrice: "0.3M 积分/百万令牌",
      cachedPrice: "0.002M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Google", checked: true, icon: "✨" }
      ]
    }
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    icon: "✨",
    tags: [{ text: "Pro", color: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20" }],
    detail: {
      contextLength: "2M tokens",
      hasToolCalling: true,
      hasDeepThinking: true,
      inputPrice: "1.25M 积分/百万令牌",
      outputPrice: "3.75M 积分/百万令牌",
      cachedPrice: "0.01M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Google", checked: true, icon: "✨" }
      ]
    }
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash-Lite",
    icon: "⚡",
    tags: [],
    detail: {
      contextLength: "1M tokens",
      hasToolCalling: true,
      hasDeepThinking: false,
      inputPrice: "0.03M 积分/百万令牌",
      outputPrice: "0.09M 积分/百万令牌",
      cachedPrice: "0.001M 积分/百万令牌",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Google", checked: true, icon: "✨" }
      ]
    }
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    icon: "🍌",
    tags: [],
    detail: {
      contextLength: "32K tokens",
      hasToolCalling: false,
      hasDeepThinking: false,
      inputPrice: "免费",
      outputPrice: "免费",
      cachedPrice: "无",
      providers: [
        { name: "LobeHub", checked: true, icon: "🤖" },
        { name: "Local Host", checked: true, icon: "🍌" }
      ]
    }
  }
];

export function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelItem>(MOCK_MODELS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredModel, setHoveredModel] = useState<ModelItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredModels = MOCK_MODELS.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className="relative inline-block text-left text-[13px] font-sans">
      {/* Trigger: Rounded gray pill/dark button matching screenshot */}
      <button
        id="model-selector-trigger"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-200 border border-zinc-200/20 dark:border-white/5 transition-all duration-200 shadow-sm active:scale-95"
      >
        <span className="text-sm select-none">{selectedModel.icon}</span>
        <span className="font-medium tracking-tight text-[12px]">{selectedModel.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Menu & Hover Detailed Panel */}
      {isOpen && (
        <div
          id="model-selector-popover-wrapper"
          onMouseLeave={() => setHoveredModel(null)}
          className="absolute right-0 bottom-full mb-3 flex items-end gap-3 z-50 transform origin-bottom animate-fade-in"
        >
          {/* Leftside: Pricing/Consumption detailed window shown on hover */}
          {hoveredModel && (
            <div
              id="model-consumption-window"
              className="w-80 p-4 rounded-2xl bg-white dark:bg-[#18181a] border border-zinc-200/50 dark:border-white/10 shadow-[0_12px_45px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_45px_rgba(0,0,0,0.4)] text-left flex flex-col"
            >
              {/* Context Length */}
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-[3px] h-3.5 bg-blue-500 rounded-full"></span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">上下文长度</span>
                </div>
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
                  {hoveredModel.detail.contextLength}
                </span>
              </div>

              {/* Capabilities */}
              <div className="space-y-3 border-b border-zinc-100 dark:border-white/5 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                  <span>能力</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </div>
                {/* Tool Calling */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-350">
                    <Wrench className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                    <span>工具调用</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {hoveredModel.detail.hasToolCalling ? "该模型支持工具调用 (Tool Calling)" : "该模型不支持工具调用"}
                  </span>
                </div>
                {/* Deep Thinking */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-350">
                    <Brain className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                    <span>深度思考</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {hoveredModel.detail.hasDeepThinking ? "该模型支持深度思考" : "该模型暂不支持深度思考"}
                  </span>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-3 border-b border-zinc-100 dark:border-white/5 py-3 border-dashed">
                <div className="flex items-center gap-2">
                  <span className="w-[3px] h-3.5 bg-amber-550 dark:bg-amber-500 rounded-full"></span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                    <span>价格</span>
                    <ChevronDown className="w-3 h-3 text-zinc-400" />
                  </div>
                </div>
                {/* Input Price */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-[#bebebe]">
                    <ArrowUp className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                    <span>输入</span>
                  </div>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    {hoveredModel.detail.inputPrice}
                  </span>
                </div>
                {/* Output Price */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-[#bebebe]">
                    <ArrowDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                    <span>输出</span>
                  </div>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    {hoveredModel.detail.outputPrice}
                  </span>
                </div>
                {/* Cached Price */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-[#bebebe]">
                    <RefreshCw className="w-3 h-3 text-zinc-450 dark:text-zinc-500 scale-90" />
                    <span>输入（缓存读取）</span>
                  </div>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    {hoveredModel.detail.cachedPrice}
                  </span>
                </div>
              </div>

              {/* Providers */}
              <div className="py-2.5">
                <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 block mb-2">
                  使用此模型来自：
                </span>
                <div className="space-y-2">
                  {hoveredModel.detail.providers.map((prov, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <span className="text-sm select-none">{prov.icon}</span>
                        <span>{prov.name}</span>
                      </div>
                      {prov.checked && (
                        <Check className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rightside: Main Dropdown List Menu */}
          <div className="w-64 rounded-2xl bg-white dark:bg-[#18181a] border border-zinc-200/50 dark:border-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_45px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Top Search Bar */}
            <div className="p-2 border-b border-zinc-100 dark:border-white/10">
              <div className="relative flex items-center bg-zinc-100/60 dark:bg-zinc-900/60 rounded-xl px-2.5 py-1.5 border border-transparent focus-within:border-zinc-300/40 dark:focus-within:border-zinc-700/40 transition-all duration-150">
                <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索模型..."
                  className="w-full bg-transparent border-0 outline-none p-0 text-[12px] text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500"
                />
              </div>
            </div>

            {/* Model Item List */}
            <div className="max-h-80 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
              {filteredModels.length > 0 ? (
                filteredModels.map((model) => {
                  const isSelected = model.id === selectedModel.id;
                  return (
                    <button
                      key={model.id}
                      id={`model-item-${model.id}`}
                      type="button"
                      onMouseEnter={() => setHoveredModel(model)}
                      onClick={() => {
                        setSelectedModel(model);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors text-left ${
                        isSelected ? "bg-zinc-200/40 dark:bg-white/5 font-medium" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none shrink-0">{model.icon}</span>
                        <span className={`text-[12.5px] tracking-tight truncate ${isSelected ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`}>
                          {model.name}
                        </span>
                        {model.tags && model.tags.map((tag, badgeIdx) => (
                          <span
                            key={badgeIdx}
                            className={`px-1 rounded text-[9px] font-semibold leading-none tracking-tight scale-90 ${tag.color}`}
                          >
                            {tag.text}
                          </span>
                        ))}
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-zinc-750 dark:text-zinc-300 shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  无匹配的模型
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
