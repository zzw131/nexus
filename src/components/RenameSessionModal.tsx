import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { PencilLine } from "lucide-react";

interface RenameSessionModalProps {
  open: boolean;
  sessionId?: string;
  currentName: string;
  onConfirm: (newName: string) => void;
  onClose: () => void;
}

export function RenameSessionModal({
  open,
  sessionId,
  currentName,
  onConfirm,
  onClose,
}: RenameSessionModalProps) {
  const [inputValue, setInputValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue(currentName);
      // Ensure element is fully rendered before focusing and selecting
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [open, currentName]);

  const handleConfirm = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onConfirm(trimmed);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  const isConfirmDisabled = !inputValue.trim();

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[32px] shadow-2xl bg-white/90 dark:bg-zinc-900/90 border border-white/60 dark:border-zinc-700/50 backdrop-blur-xl"
          >
            {/* Aurora Background Mesh */}
            <div 
              className="absolute inset-0 z-0 opacity-60 dark:opacity-30 pointer-events-none" 
              style={{
                background: 'radial-gradient(circle at 10% 0%, rgba(254,240,138,0.7), transparent 40%), radial-gradient(circle at 90% 10%, rgba(186,230,253,0.7), transparent 40%), radial-gradient(circle at 50% -20%, rgba(134,239,172,0.7), transparent 50%)',
                filter: 'blur(30px)',
              }}
            ></div>
            
            {/* Smooth Fade to White/Dark at the bottom */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-zinc-900/80 dark:to-zinc-900 pointer-events-none" />

            {/* Glassmorphic Foreground Content */}
            <div className="relative z-10 px-6 pt-8 pb-6 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-6 text-zinc-900 dark:text-zinc-100">
                <PencilLine className="w-5 h-5" />
                <h3 className="text-lg font-extrabold font-sans">
                  重命名会话
                </h3>
              </div>
              
              <div className="w-full relative mb-6">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入会话名称"
                  className="w-full px-5 py-3.5 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-lg border border-white/80 dark:border-zinc-700/80 rounded-full text-zinc-900 dark:text-zinc-100 font-medium placeholder-zinc-400 dark:placeholder-zinc-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:focus:ring-white/20 transition-all font-sans"
                />
                {sessionId && (
                  <p className="mt-1.5 text-[10px] text-gray-400/50 dark:text-gray-500/40 font-mono truncate px-2 text-center select-all">
                    {sessionId}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between w-full gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-full border border-zinc-200/60 dark:border-zinc-700/60 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors shadow-sm text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isConfirmDisabled}
                  className={`flex-1 py-3 rounded-full font-bold transition-all shadow-sm text-sm ${
                    isConfirmDisabled
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                      : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
                  }`}
                >
                  确认
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
