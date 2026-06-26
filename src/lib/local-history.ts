const STORAGE_KEY = "verse_smart_history";

export type LocalHistoryEntry = {
  id: string;
  reference: string;
  translation: string;
  created_at: string;
};

export function getLocalHistory(): LocalHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalHistoryEntry[];
  } catch {
    return [];
  }
}

export function saveLocalHistoryEntry(reference: string, translation: string) {
  try {
    const entries = getLocalHistory();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const created_at = new Date().toISOString();

    // Remove duplicates
    const filtered = entries.filter(
      (e) => !(e.reference === reference && e.translation === translation)
    );

    // Add new entry at the beginning
    const updated = [{ id, reference, translation, created_at }, ...filtered];

    // Keep only the latest 3 (anonymous limit)
    const trimmed = updated.slice(0, 3);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function deleteLocalHistoryEntry(id: string) {
  try {
    const entries = getLocalHistory();
    const updated = entries.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}
