import { useEffect, useRef } from "react";
import { lockSession } from "./sessionStore";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

/** Locks the session after `autoLockMinutes` of inactivity. Pass 0 to disable. */
export function useAutoLock(autoLockMinutes: number): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (autoLockMinutes <= 0) return;

    function reset(): void {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => lockSession(), autoLockMinutes * 60_000);
    }

    reset();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, reset);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, reset);
    };
  }, [autoLockMinutes]);
}
