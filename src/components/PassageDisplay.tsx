import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

const WORD_LIMIT = 100;

function summarize(text: string): string {
  // Take leading sentences up to ~60 words, then ellipsis.
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const out: string[] = [];
  let count = 0;
  for (const s of sentences) {
    const w = s.trim().split(/\s+/).length;
    if (count + w > 60 && out.length > 0) break;
    out.push(s.trim());
    count += w;
    if (count >= 50) break;
  }
  return out.join(" ") + " …";
}

export function PassageDisplay({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const wordCount = useMemo(() => text.trim().split(/\s+/).length, [text]);
  const isLong = wordCount > WORD_LIMIT;
  const display = !isLong || expanded ? text : summarize(text);

  return (
    <div className="mx-auto mt-4 max-w-3xl">
      <blockquote className="font-display text-2xl leading-snug font-medium sm:text-3xl">
        &ldquo;{display}&rdquo;
      </blockquote>
      {isLong && (
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>
            {expanded ? `Full passage (${wordCount} words)` : `Summary of ${wordCount}-word passage`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show summary" : "Show full passage"}
          </Button>
        </div>
      )}
    </div>
  );
}
