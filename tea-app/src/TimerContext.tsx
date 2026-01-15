import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface TimerContextType {
  timeLeft: number | null;
  activeTeaName: string | null;
  startTimer: (seconds: number, teaName: string) => void;
  stopTimer: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [activeTeaName, setActiveTeaName] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeft === 0) {
      // You could add a notification or sound here
      setActiveTeaName(null);
      setTimeLeft(null);
    }
    return () => clearInterval(interval);
  }, [timeLeft]);

  const startTimer = useCallback((seconds: number, teaName: string) => {
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
