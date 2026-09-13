const CLIPBOARD_CLEAR_MS = 20_000;

export async function copyAndAutoClear(value: string, setStatus: (s: string | null) => void): Promise<void> {
  await navigator.clipboard.writeText(value);
  setStatus("Copied — clipboard clears in 20s");
  setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === value) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // Clipboard read permission may be unavailable; nothing more we can safely do.
    }
    setStatus(null);
  }, CLIPBOARD_CLEAR_MS);
}
