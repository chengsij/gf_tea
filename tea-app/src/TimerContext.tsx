import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface TimerContextType {
  timeLeft: number | null;
  activeTeaName: string | null;
  activeSteepIndex: number | null;
  startTimer: (seconds: number, teaName: string, steepIndex: number) => void;
  stopTimer: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

// Singleton AudioContext to prevent memory leaks
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (audioContext) {
    return audioContext;
  }

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  } catch (e) {
    console.error("Failed to create AudioContext", e);
  }

  return audioContext;
};

const playNotificationSound = (type: 'chime' | 'start' | 'end') => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (type === 'chime') {
        // Pleasant chime: ascending then descending tones
        const now = ctx.currentTime;
        const notes = [
            { freq: 523.25, time: 0 },      // C5
            { freq: 659.25, time: 0.15 },   // E5
            { freq: 783.99, time: 0.3 },    // G5
            { freq: 659.25, time: 0.45 }    // E5
        ];

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.value = note.freq;

            const startTime = now + note.time;
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

            osc.start(startTime);
            osc.stop(startTime + 0.15);
        });
    } else if (type === 'start') {
        // 5-second warning: rapid beeps over 5 seconds
        const beepDuration = 0.15;
        const beepInterval = 1.0;
        const totalDuration = 5.0;
        const now = ctx.currentTime;

        for (let time = 0; time < totalDuration; time += beepInterval) {
            const startTime = now + time;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.value = 1000; // 1kHz warning tone
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + beepDuration);

            osc.start(startTime);
            osc.stop(startTime + beepDuration);
        }
    } else {
        // Klaxon: harsh, alarming sound with oscillating frequencies
        const now = ctx.currentTime;
        const frequencies = [800, 1200, 800]; // Oscillating pattern

        frequencies.forEach((freq, i) => {
            const startTime = now + (i * 0.5);
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            // Use square wave for harsher sound
            osc.type = 'square';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

            osc.start(startTime);
            osc.stop(startTime + 0.45);
        });
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [activeTeaName, setActiveTeaName] = useState<string | null>(null);
  const [activeSteepIndex, setActiveSteepIndex] = useState<number | null>(null);

  useEffect(() => {
    if (timeLeft === null) return;

    if (timeLeft === 0) {
      playNotificationSound('end');
      setActiveTeaName(null);
      setTimeLeft(null);
      setActiveSteepIndex(null);
      return;
    }

    if (timeLeft === 5) {
      playNotificationSound('start');
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  const startTimer = useCallback((seconds: number, teaName: string, steepIndex: number) => {
    playNotificationSound('chime');
    setTimeLeft(seconds);
    setActiveTeaName(teaName);
    setActiveSteepIndex(steepIndex);
  }, []);

  const stopTimer = useCallback(() => {
    setTimeLeft(null);
    setActiveTeaName(null);
    setActiveSteepIndex(null);
  }, []);

  return (
    <TimerContext.Provider value={{ timeLeft, activeTeaName, activeSteepIndex, startTimer, stopTimer }}>
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
