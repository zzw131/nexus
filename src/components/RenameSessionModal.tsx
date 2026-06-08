import React, { useState, useEffect, useRef } from "react";
import { X, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RenameSessionModalProps {
  isOpen: boolean;
  sessionName: string;
  onClose: () => void;
  onConfirm: (newName: string) => void;
}

export default function RenameSessionModal({
  isOpen,
  sessionName,
  onClose,
  onConfirm,
}: RenameSessionModalProps) {
  const [newName, setNewName] = useState(sessionName);
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部 sessionName 变化 & 自动聚焦
  useEffect(() => {
    if (isOpen) {
      setNewName(sessionName);
      // 延迟聚焦，等动画完成
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 150);
    }
  }, [isOpen, sessionName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onKeyDown={handleKeyDown}
        >
          {/* 🌌 弥散极光渐变背景层 */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#fef9c3] via-[#dcfce7]/70 to-[#e0f2fe]/40" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#fef9c3]/30 via-transparent to-[#dcfce7]/20 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-tl from-[#e0f2fe]/30 via-transparent to-[#fef9c3]/20 blur-3xl" />

          {/* 🌫️ 模糊遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* ✨ 毛玻璃卡片 */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative z-10 w-full max-w-sm bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl shadow-black/5 overflow-hidden"
          >
            {/* 装饰：顶部细线 */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent" />

            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1a1a2e]/5 flex items-center justify-center">
                    <Pencil className="w-4 h-4 text-[#1a1a2e]" />
                  </div>
                  <h2 className="text-sm font-bold text-[#1a1a2e] tracking-tight">
                    重命名会话
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-[#64748b] hover:text-[#1a1a2e] hover:bg-[#1a1a2e]/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 说明文字 */}
              <p className="text-xs text-[#64748b] leading-relaxed">
                为会话设置一个新名称，方便后续查找和管理。
              </p>

              {/* 输入框：胶囊形 */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入会话名称"
                  className="w-full px-4 py-3 pr-10 text-sm font-medium text-[#1a1a2e] placeholder:text-[#94a3b8] bg-white/80 backdrop-blur-sm border border-black/5 focus:border-black/20 focus:ring-4 focus:ring-black/5 rounded-full outline-none transition-all duration-200"
                />
                <Pencil className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              </div>

              {/* 按钮组：胶囊形 */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-[#64748b] hover:text-[#1a1a2e] bg-white/50 hover:bg-white/80 backdrop-blur-sm border border-black/5 rounded-full transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-full transition-all cursor-pointer ${
                    newName.trim()
                      ? "bg-[#1a1a2e] text-white hover:bg-[#2d2d44] shadow-md shadow-black/10 hover:shadow-lg hover:shadow-black/15 active:scale-[0.98]"
                      : "bg-[#1a1a2e]/20 text-[#94a3b8] cursor-not-allowed"
                  }`}
                >
                  确认修改
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
