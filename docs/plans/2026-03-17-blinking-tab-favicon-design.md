# Blinking Tab Favicon During 5-Second Warning

## Overview

When the tea timer enters its 5-second warning countdown, the browser tab favicon blinks to draw attention even when the tab is not in focus.

## Trigger

Blinking is active when `timeLeft !== null && timeLeft <= 5`. This aligns exactly with when the warning beeps fire in `TimerContext`.

## Architecture

A `useFaviconBlink` custom hook in `src/useFaviconBlink.ts` encapsulates all favicon manipulation logic. It is called from `App.tsx` using the `useTimer()` hook.

```
TimerContext (timeLeft) → App.tsx reads useTimer()
→ calls useFaviconBlink(timeLeft !== null && timeLeft <= 5)
→ setInterval toggles document.querySelector('link[rel=icon]').href every 500ms
```

## Behavior

- Hook accepts a single `isActive: boolean` parameter
- When `isActive` is true: sets up a 500ms interval toggling the favicon between a normal tea SVG and an alert (orange-tinted) tea SVG
- Both favicons are inline SVG data URIs — no extra files required
- When `isActive` becomes false: clears the interval and restores the original favicon href

## Cleanup

The hook's `useEffect` returns a cleanup function that clears the interval and restores the original href on deactivation or unmount.

## Files Changed

- `src/useFaviconBlink.ts` — new custom hook
- `src/App.tsx` — call `useFaviconBlink` with the derived `isBeeping` boolean
