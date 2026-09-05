import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { lockSession } from "./sessionStore";

/**
 * Mobile's analog of apps/web's inactivity-based auto-lock (src/state/autoLock.ts) — a touch UI
 * has no mouse/keyboard idle signal, so this locks based on how long the app sat backgrounded
 * instead, which is the standard pattern for mobile password managers.
 */
export function useAutoLock(autoLockMinutes: number): void {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (nextState === "active" && backgroundedAt.current !== null) {
        const elapsedMinutes = (Date.now() - backgroundedAt.current) / 60_000;
        if (autoLockMinutes > 0 && elapsedMinutes > autoLockMinutes) {
          lockSession();
        }
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [autoLockMinutes]);
}
