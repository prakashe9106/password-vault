import * as Clipboard from "expo-clipboard";

const CLIPBOARD_CLEAR_MS = 20_000;

export async function copyAndAutoClear(value: string, setStatus: (s: string | null) => void): Promise<void> {
  await Clipboard.setStringAsync(value);
  setStatus("Copied — clipboard clears in 20s");
  setTimeout(async () => {
    const current = await Clipboard.getStringAsync().catch(() => null);
    if (current === value) await Clipboard.setStringAsync("");
    setStatus(null);
  }, CLIPBOARD_CLEAR_MS);
}
