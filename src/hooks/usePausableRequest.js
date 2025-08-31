import { useCallback } from 'react';
import { usePause } from '../context/PauseContext';

export const usePausableRequest = () => {
  const { isPausedRef, onResume } = usePause();

  const executePausableRequest = useCallback(async (requestFn, options = {}) => {
    const {
      onSuccess,
      onError,
      retryOnResume = true,
      skipPauseCheck = false,
    } = options;


    if (!skipPauseCheck && isPausedRef.current) {
      if (retryOnResume) {
        onResume(() => {
          executePausableRequest(requestFn, options);
        });
      }
      return null;
    }

    try {
      const res = await requestFn();
      if (!skipPauseCheck && isPausedRef.current) return null; 
      onSuccess?.(res);
      return res;
    } catch (e) {
      onError?.(e);
      throw e;
    }
  }, [isPausedRef, onResume]);

  return { executePausableRequest };
};