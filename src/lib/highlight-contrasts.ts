// Lightweight, deterministic highlighter for contrast position summaries.
// Given the sibling positions of one contrast, picks 1–2 short phrases that
// most distinguish each author's view from the others and renders them
// wrapped in a styled <mark>. No AI, no network — purely client-side.

import React from "react";

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","in","on","to","for","with","by","as",
  "is","are","was","were","be","been","being","this","that","these","those",
  "it","its","his","her","their","our","your","my","we","they","he","she",
  "from","at","into","than","then","so","also","not","no","yet","still",
  "which","who","whom","whose","what","when","where","why","how","while",
  "about","over","under","through","between","among","upon","without","within",
  "more","most","less","least","very","much","many","some","any","all","each",
  "every","both","either","neither","one","two","three","first","second",
  "can","could","should","would","may","might","must","will","shall","do","does","did",
  "have","has","had","having","get","gets","got",
  "thus","hence","therefore","however","because","since","though","although",
  "author","view","verse","passage","text","commentary","commentator","reader",
  "god","gods","lord","jesus","christ","paul","moses","spirit",
  "people","person","man","men","woman","women","thing","things","way","ways",
  "here","there","now","just","only","even","such","like","make","makes","made",
  "see","sees","saw","seen","say","says","said","note","notes","noted",
  "point","points","emphasize","emphasizes","emphasises","emphasised","stress",
  "stresses","stressed","argue","argues","argued","claim","claims","claimed",
  "hold","holds","held","read","reads","interpret","interprets","interpreted",
  "interpretation","meaning","sense","focus","focuses","focused","frame","frames",
  "framed","approach","approaches","worldview","tradition","author's","views",
]);

const KEEP_SHORT = new Set(["sin","law","grace","faith","fear","shame","honor","honour","love","hope","power","cross","wrath","glory","truth","life","death","evil","good","king","heart","flesh","soul","mind","blood","name","word"]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function isContent(w: string): boolean {
  if (STOPWORDS.has(w)) return false;
  if (w.length <= 2) return KEEP_SHORT.has(w);
  if (w.length === 3 && !KEEP_SHORT.has(w) && /^(and|the|but|for|not|are|was|has|had|its|his|her|out|all|one|two|who|why|how|now|may|can|let)$/i.test(w)) return false;
  return /\p{L}/u.test(w);
}

/** Build candidate phrases (1–3 words) from a text. */
function candidates(text: string): string[] {
  const out: string[] = [];
  // Split by sentence/comma boundaries to avoid spanning phrases across them.
  const segments = text.split(/[.,;:!?()\[\]\u2014\u2013\-]+/);
  for (const seg of segments) {
    const raw = seg.trim().split(/\s+/).filter(Boolean);
    const norm = raw.map((w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""));
    for (let i = 0; i < norm.length; i++) {
      for (let len = 1; len <= 3 && i + len <= norm.length; len++) {
        const slice = norm.slice(i, i + len);
        if (slice.some((w) => !w)) continue;
        // Anchor: first and last must be content words.
        if (!isContent(slice[0]) || !isContent(slice[slice.length - 1])) continue;
        if (len === 1 && !isContent(slice[0])) continue;
        out.push(slice.join(" "));
      }
    }
  }
  return out;
}

/** Score and pick up to 2 distinctive phrases for the target position. */
export function pickKeyPhrases(target: string, siblings: string[], max = 2): string[] {
  const targetCands = candidates(target);
  if (targetCands.length === 0) return [];
  const targetCounts = new Map<string, number>();
  for (const c of targetCands) targetCounts.set(c, (targetCounts.get(c) ?? 0) + 1);

  // Sibling document frequencies.
  const siblingDocs = siblings.map((s) => new Set(candidates(s)));
  const N = siblingDocs.length;

  const scored: { phrase: string; score: number; len: number }[] = [];
  for (const [phrase, tf] of targetCounts) {
    let df = 0;
    for (const set of siblingDocs) if (set.has(phrase)) df++;
    // Distinctiveness: present in target, absent (or rare) in siblings.
    const distinct = (N + 1) / (df + 1);
    const len = phrase.split(" ").length;
    // Prefer 2-word phrases slightly; tf gives weak boost.
    const lenBoost = len === 2 ? 1.25 : len === 3 ? 1.1 : 1;
    const score = Math.log(1 + tf) * Math.log(1 + distinct) * lenBoost;
    if (score > 0) scored.push({ phrase, score, len });
  }

  scored.sort((a, b) => b.score - a.score || b.len - a.len);

  // Greedy selection avoiding overlap between picks.
  const picked: string[] = [];
  for (const { phrase } of scored) {
    if (picked.length >= max) break;
    if (picked.some((p) => p.includes(phrase) || phrase.includes(p))) continue;
    picked.push(phrase);
  }
  return picked;
}

/** Render text with key phrases wrapped in <mark>. Case-insensitive match. */
export function highlightText(text: string, phrases: string[]): React.ReactNode {
  if (!phrases.length) return text;
  // Build a regex matching any phrase, longest first, word-boundary-ish.
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Allow flexible whitespace and an optional trailing 's' for simple plurals.
  const pattern = escaped.map((p) => p.replace(/\s+/g, "\\s+") + "s?").join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, "giu");

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      React.createElement(
        "mark",
        {
          key: key++,
          className:
            "bg-transparent font-semibold text-foreground underline decoration-primary/60 decoration-2 underline-offset-2",
        },
        m[0],
      ),
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Convenience: highlight one position's text relative to its siblings. */
export function highlightPosition(text: string, siblings: string[]): React.ReactNode {
  const phrases = pickKeyPhrases(text, siblings, 2);
  return highlightText(text, phrases);
}
