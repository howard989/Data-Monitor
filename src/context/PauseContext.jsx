import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export const PauseContext = createContext(null);

export const PauseProvider = ({ children }) => {
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const onResumeQueueRef = useRef([]);

  const pause = () => setIsPaused(true);

  const resume = () => {
    setIsPaused(false);
   
    const q = onResumeQueueRef.current;
    onResumeQueueRef.current = [];
    q.forEach((cb) => { try { cb?.(); } catch (e) { console.error(e); } });
  };

  const toggle = () => (isPaused ? resume() : pause());


  const onResume = (cb) => {
    onResumeQueueRef.current.push(cb);
  };


  const pauseAwareRequest = async (requestFn, { skipCheck = false } = {}) => {
    if (!skipCheck && isPausedRef.current) return { cancelled: true };
    try {
      const data = await requestFn();
      if (!skipCheck && isPausedRef.current) return { cancelled: true };
      return { data, cancelled: false };
    } catch (error) {
      return { error, cancelled: false };
    }
  };

  return (
    <PauseContext.Provider
      value={{ isPaused, isPausedRef, pause, resume, toggle, onResume, pauseAwareRequest }}
    >
      {children}
    </PauseContext.Provider>
  );
};

export const usePause = () => {
  const ctx = useContext(PauseContext);
  if (!ctx) throw new Error('usePause must be used within PauseProvider');
  return ctx;
};


export const useOptionalPause = () => {
  const ctx = useContext(PauseContext);
  const fallbackRef = useRef(false);
  
  if (ctx) return ctx;
  
  const noop = () => {};
  const passthrough = async (requestFn) => {
    try {
      const data = await requestFn();
      return { data, cancelled: false };
    } catch (error) {
      return { error, cancelled: false };
    }
  };
  
  return {
    isPaused: false,
    isPausedRef: fallbackRef,
    pause: noop,
    resume: noop,
    toggle: noop,
    onResume: noop,
    pauseAwareRequest: passthrough,
  };
};