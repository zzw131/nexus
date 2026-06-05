import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => {
      // Keep at most 3
      const newToasts = [...prev, { id, type, message }];
      if (newToasts.length > 3) return newToasts.slice(newToasts.length - 3);
      return newToasts;
    });

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-start gap-3 p-3 min-w-[280px] rounded-xl shadow-lg border backdrop-blur-md ${
                toast.type === 'success' ? 'bg-emerald-50/90 dark:bg-emerald-950/80 border-emerald-200/50 dark:border-emerald-900/50' :
                toast.type === 'error' ? 'bg-rose-50/90 dark:bg-rose-950/80 border-rose-200/50 dark:border-rose-900/50' :
                'bg-blue-50/90 dark:bg-blue-950/80 border-blue-200/50 dark:border-blue-900/50'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>
              <p className={`flex-1 text-[13px] font-medium leading-tight ${
                toast.type === 'success' ? 'text-emerald-800 dark:text-emerald-200' :
                toast.type === 'error' ? 'text-rose-800 dark:text-rose-200' :
                'text-blue-800 dark:text-blue-200'
              }`}>
                {toast.message}
              </p>
              <button 
                onClick={() => removeToast(toast.id)}
                className={`shrink-0 p-0.5 rounded-md transition-colors ${
                  toast.type === 'success' ? 'hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400' :
                  toast.type === 'error' ? 'hover:bg-rose-200/50 dark:hover:bg-rose-800/50 text-rose-600 dark:text-rose-400' :
                  'hover:bg-blue-200/50 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
