import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface TimerContextType {
  timeLeft: number | null;
  activeTeaName: string | null;
  startTimer: (seconds: number, teaName: string) => void;
  stopTimer: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

const playNotificationSound = (type: 'start' | 'end') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();

    if (type === 'start') {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
    } else {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = now + i * 0.15;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
            
            osc.start(startTime);
            osc.stop(startTime + 0.8);
        });
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [activeTeaName, setActiveTeaName] = useState<string | null>(null);

  useEffect(() => {
    if (timeLeft === null) return;
    
    if (timeLeft === 0) {
      playNotificationSound('end');
      setActiveTeaName(null);
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  const startTimer = useCallback((seconds: number, teaName: string) => {
    playNotificationSound('start');
    setTimeLeft(seconds);
    setActiveTeaName(teaName);
  }, []);

  const stopTimer = useCallback(() => {
    setTimeLeft(null);
    setActiveTeaName(null);
  }, []);

  return (
    <TimerContext.Provider value={{ timeLeft, activeTeaName, startTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
