import { useState, useCallback } from "react";

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
}

export function useRetry() {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const executeWithRetry = useCallback(
    async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
      const { maxRetries = 3, initialDelay = 2000 } = options;
      let attempt = 0;

      while (attempt <= maxRetries) {
        try {
          if (attempt > 0) {
            setIsRetrying(true);
            setRetryCount(attempt);
          }
          const result = await fn();
          setIsRetrying(false);
          setRetryCount(0);
          return result;
        } catch (error: any) {
          if (attempt === maxRetries) {
            setIsRetrying(false);
            setRetryCount(0);
            throw error;
          }

          attempt++;
          const delay = initialDelay * Math.pow(2, attempt - 1); // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw new Error("Max retries exceeded");
    },
    [],
  );

  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    resetRetry,
  };
}
