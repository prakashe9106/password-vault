import { vi } from "vitest";

/** Minimal in-memory chrome.* mock — just enough surface for lib/storage.ts and background code. */
export function installChromeMock() {
  const localData: Record<string, unknown> = {};
  const sessionData: Record<string, unknown> = {};

  function makeArea(data: Record<string, unknown>) {
    return {
      get: vi.fn(async (keys?: string | string[] | null) => {
        if (keys == null) return { ...data };
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of keyList) if (key in data) result[key] = data[key];
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(data, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
      }),
      clear: vi.fn(async () => {
        for (const key of Object.keys(data)) delete data[key];
      }),
    };
  }

  const chromeMock = {
    storage: {
      local: makeArea(localData),
      session: makeArea(sessionData),
    },
    runtime: {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      sendMessage: vi.fn(),
    },
    tabs: {
      query: vi.fn(async () => []),
      sendMessage: vi.fn(),
    },
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
    },
  };

  vi.stubGlobal("chrome", chromeMock);
  return { chromeMock, localData, sessionData };
}
