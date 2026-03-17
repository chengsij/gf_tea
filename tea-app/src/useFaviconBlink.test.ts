import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFaviconBlink } from './useFaviconBlink';

describe('useFaviconBlink', () => {
  let linkEl: HTMLLinkElement;

  beforeEach(() => {
    vi.useFakeTimers();
    linkEl = document.createElement('link');
    linkEl.rel = 'icon';
    linkEl.href = 'http://localhost:3000/original.svg';
    document.head.appendChild(linkEl);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.head.removeChild(linkEl);
  });

  it('does not change favicon when inactive', () => {
    renderHook(() => useFaviconBlink(false));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(linkEl.href).toBe('http://localhost:3000/original.svg');
  });

  it('changes favicon after 500ms when active', () => {
    renderHook(() => useFaviconBlink(true));
    act(() => { vi.advanceTimersByTime(500); });
    expect(linkEl.href).not.toBe('http://localhost:3000/original.svg');
  });

  it('toggles favicon back after 1000ms', () => {
    renderHook(() => useFaviconBlink(true));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(linkEl.href).toBe('http://localhost:3000/original.svg');
  });

  it('restores original favicon when deactivated', () => {
    const { rerender } = renderHook(({ active }) => useFaviconBlink(active), {
      initialProps: { active: true },
    });
    act(() => { vi.advanceTimersByTime(500); });
    expect(linkEl.href).not.toBe('http://localhost:3000/original.svg');

    rerender({ active: false });
    expect(linkEl.href).toBe('http://localhost:3000/original.svg');
  });
});
