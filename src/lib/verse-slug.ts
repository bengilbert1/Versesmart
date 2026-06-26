import { BIBLE_BOOKS } from "./bible-books";

const BOOK_BY_SLUG = new Map<string, string>();
for (const b of BIBLE_BOOKS) {
  BOOK_BY_SLUG.set(b.name.toLowerCase().replace(/\s+/g, "-"), b.name);
}
// Common alias
BOOK_BY_SLUG.set("psalm", "Psalms");
BOOK_BY_SLUG.set("song-of-songs", "Song of Solomon");
BOOK_BY_SLUG.set("canticles", "Song of Solomon");

export function slugToReference(slug: string): { reference: string; book: string; chapter?: number; verse?: number } | null {
  const parts = slug.toLowerCase().split("-").filter(Boolean);
  if (parts.length === 0) return null;
  // Find the longest book prefix
  for (let take = Math.min(parts.length, 4); take >= 1; take--) {
    const candidate = parts.slice(0, take).join("-");
    const book = BOOK_BY_SLUG.get(candidate);
    if (!book) continue;
    const rest = parts.slice(take);
    if (rest.length === 0) return { reference: book, book };
    const chapter = Number(rest[0]);
    if (!Number.isFinite(chapter) || chapter < 1) return null;
    if (rest.length === 1) return { reference: `${book} ${chapter}`, book, chapter };
    const verse = Number(rest[1]);
    if (!Number.isFinite(verse) || verse < 1) return null;
    return { reference: `${book} ${chapter}:${verse}`, book, chapter, verse };
  }
  return null;
}

export function referenceToSlug(reference: string): string {
  return reference
    .toLowerCase()
    .replace(/:/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
