import { useEffect, useRef } from 'react';

const ALERT_FAVICON = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%23ff6b00"/><text x="16" y="24" text-anchor="middle" font-size="20" font-family="serif">🍵</text></svg>`;

export function useFaviconBlink(isActive: boolean): void {
  const originalHref = useRef<string | null>(null);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;

    if (!isActive) {
      if (originalHref.current !== null) {
        link.href = originalHref.current;
      }
      return;
    }

    originalHref.current = link.href;

    let showingAlert = false;
    const interval = setInterval(() => {
      showingAlert = !showingAlert;
      link.href = showingAlert ? ALERT_FAVICON : originalHref.current!;
    }, 500);

    return () => {
      clearInterval(interval);
      link.href = originalHref.current!;
    };
  }, [isActive]);
}
