import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TimerProvider, useTimer } from './TimerContext';

// Mock the Web Audio API to prevent actual sound playing
const mockCreateOscillator = vi.fn(function (this: any) {
  return {
    connect: vi.fn(function (this: any) { return this; }),
    frequency: { value: 0 },
    type: 'sine' as OscillatorType,
    start: vi.fn(),
    stop: vi.fn(),
  };
});

const mockCreateGain = vi.fn(function (this: any) {
  return {
    connect: vi.fn(function (this: any) { return this; }),
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  };
});

// Mock window.AudioContext properly
const MockAudioContext = vi.fn(function () {
  return {
    createOscillator: mockCreateOscillator,
    createGain: mockCreateGain,
    destination: {},
    currentTime: 0,
  };
});

Object.defineProperty(window, 'AudioContext', {
  value: MockAudioContext,
  configurable: true,
  writable: true,
});

// Test component that uses the timer
const TestComponent = () => {
  const { timeLeft, activeTeaName, startTimer, stopTimer } = useTimer();

  return (
    <div>
      <div data-testid="time-left">{timeLeft ?? 'null'}</div>
      <div data-testid="active-tea">{activeTeaName ?? 'null'}</div>
      <button onClick={() => startTimer(30, 'Green Tea', 0)}>Start Timer</button>
      <button onClick={() => startTimer(5, 'Black Tea', 1)}>Start 5s Timer</button>
      <button onClick={stopTimer}>Stop Timer</button>
    </div>
  );
};

describe('TimerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Timer Initialization', () => {
    it('should provide initial null values', () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      expect(screen.getByTestId('time-left')).toHaveTextContent('null');
      expect(screen.getByTestId('active-tea')).toHaveTextContent('null');
    });
  });

  describe('startTimer', () => {
    it('should set timeLeft when timer starts', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });

      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('30');
      }, { timeout: 1000 });
    });

    it('should set activeTeaName when timer starts', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });

      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('active-tea')).toHaveTextContent('Green Tea');
      }, { timeout: 1000 });
    });

    it('should call audio context when starting timer', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });

      act(() => {
        startButton.click();
      });

      // Give a small delay for audio to be created
      await new Promise(resolve => setTimeout(resolve, 50));

      // createOscillator should have been called for the chime sound
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it('should handle different tea names', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const start5sButton = screen.getByRole('button', { name: /Start 5s Timer/i });

      act(() => {
        start5sButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('active-tea')).toHaveTextContent('Black Tea');
        expect(screen.getByTestId('time-left')).toHaveTextContent('5');
      }, { timeout: 1000 });
    });
  });

  describe('stopTimer', () => {
    it('should clear timeLeft when stopped', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });
      const stopButton = screen.getByRole('button', { name: /Stop Timer/i });

      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('30');
      }, { timeout: 1000 });

      act(() => {
        stopButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('null');
      }, { timeout: 1000 });
    });

    it('should clear activeTeaName when stopped', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });
      const stopButton = screen.getByRole('button', { name: /Stop Timer/i });

      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('active-tea')).toHaveTextContent('Green Tea');
      }, { timeout: 1000 });

      act(() => {
        stopButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('active-tea')).toHaveTextContent('null');
      }, { timeout: 1000 });
    });
  });

  describe('Timer state management', () => {
    it('should support starting timer after initialization', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      expect(screen.getByTestId('time-left')).toHaveTextContent('null');

      const startButton = screen.getByRole('button', { name: /Start Timer/i });

      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('30');
      }, { timeout: 1000 });
    });

    it('should handle multiple timer starts sequentially', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });
      const start5sButton = screen.getByRole('button', { name: /Start 5s Timer/i });

      // Start first timer
      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('30');
      }, { timeout: 1000 });

      // Start second timer (should override)
      act(() => {
        start5sButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('5');
        expect(screen.getByTestId('active-tea')).toHaveTextContent('Black Tea');
      }, { timeout: 1000 });
    });

    it('should allow restarting timer after stopping', async () => {
      render(
        <TimerProvider>
          <TestComponent />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });
      const stopButton = screen.getByRole('button', { name: /Stop Timer/i });

      // Start timer
      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('30');
      }, { timeout: 1000 });

      // Stop timer
      act(() => {
        stopButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('null');
      }, { timeout: 1000 });

      // Restart timer
      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time-left')).toHaveTextContent('30');
      }, { timeout: 1000 });
    });
  });

  describe('useTimer Hook Error Handling', () => {
    it('should throw error when used outside TimerProvider', () => {
      const TestComponentOutsideProvider = () => {
        const { timeLeft } = useTimer();
        return <div>{timeLeft}</div>;
      };

      // Suppress the expected error log
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponentOutsideProvider />);
      }).toThrow('useTimer must be used within a TimerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Timer context values', () => {
    it('should provide startTimer function', async () => {
      const TestComponentWithCallback = () => {
        const { startTimer, timeLeft } = useTimer();
        return (
          <div>
            <div data-testid="time">{timeLeft ?? 'null'}</div>
            <button
              data-testid="custom-start"
              onClick={() => startTimer(45, 'Custom Tea', 0)}
            >
              Custom Start
            </button>
          </div>
        );
      };

      render(
        <TimerProvider>
          <TestComponentWithCallback />
        </TimerProvider>
      );

      const customButton = screen.getByTestId('custom-start');

      act(() => {
        customButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time')).toHaveTextContent('45');
      }, { timeout: 1000 });
    });

    it('should provide stopTimer function', async () => {
      const TestComponentWithStopCallback = () => {
        const { stopTimer, timeLeft } = useTimer();
        return (
          <div>
            <div data-testid="time">{timeLeft ?? 'null'}</div>
            <button
              data-testid="custom-stop"
              onClick={stopTimer}
            >
              Custom Stop
            </button>
          </div>
        );
      };

      render(
        <TimerProvider>
          <TestComponent />
          <TestComponentWithStopCallback />
        </TimerProvider>
      );

      const startButton = screen.getByRole('button', { name: /Start Timer/i });

      act(() => {
        startButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time')).toHaveTextContent('30');
      }, { timeout: 1000 });

      const customStopButton = screen.getByTestId('custom-stop');

      act(() => {
        customStopButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('time')).toHaveTextContent('null');
      }, { timeout: 1000 });
    });
  });
});
