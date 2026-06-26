import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { History, Trash2, Loader2 } from "lucide-react";
import {
  listSearchHistory,
  deleteSearchHistoryEntry,
} from "@/lib/history.functions";
import { useAuth } from "@/hooks/useAuth";
import {
  getLocalHistory,
  deleteLocalHistoryEntry,
} from "@/lib/local-history";

type Props = {
  onPick: (reference: string, translation: string) => void;
};

/**
 * Combined history button + inline panel.
 *
 * Renders the trigger button inline (intended to sit next to the verse picker)
 * and an inline expandable panel that flows BELOW the picker row in normal
 * document order — no portal, no overlay, no z-index stacking against the
 * picker. The panel container is rendered as a sibling block element after
 * the row so it pushes subsequent content down instead of covering the
 * picker bar.
 */
export function HistoryDropdown({ onPick }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <HistoryDropdownTrigger open={open} onToggle={() => setOpen((o) => !o)} />
      <HistoryDropdownPanel open={open} onClose={() => setOpen(false)} onPick={onPick} />
    </>
  );
}

export function HistoryDropdownTrigger({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Recent searches"
      aria-expanded={open}
      title="Recent searches"
      onClick={onToggle}
      className={`inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground ${
        open ? "ring-2 ring-ring text-foreground" : ""
      }`}
    >
      <History className="h-5 w-5" />
    </button>
  );
}

export function HistoryDropdownPanel({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (reference: string, translation: string) => void;
}) {
  const { user } = useAuth();
  const fetchHistory = useServerFn(listSearchHistory);
  const deleteFn = useServerFn(deleteSearchHistoryEntry);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["search-history", user?.id ?? "anon"],
    queryFn: () => {
      if (user) {
        return fetchHistory();
      }
      return Promise.resolve({ entries: getLocalHistory() });
    },
    enabled: open,
    staleTime: 30_000,
  });

  const entries = data?.entries ?? [];

  const handleDelete = async (id: string) => {
    if (user) {
      await deleteFn({ data: { id } });
    } else {
      deleteLocalHistoryEntry(id);
    }
    qc.invalidateQueries({ queryKey: ["search-history"] });
  };

  const handlePick = (ref: string, trans: string) => {
    onClose();
    onPick(ref, trans);
  };

  if (!open) return null;

  return (
    <div className="relative z-0 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="font-display text-sm font-semibold">Recent searches</div>
        <div className="mt-0.5 text-xs text-muted-foreground">Most recent first</div>
      </div>
      <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No saved searches yet. Look up a passage and it will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e, idx) => (
              <li
                key={e.id}
                className={`group flex items-center gap-2 px-4 py-2.5 hover:bg-accent/50 ${
                  idx === 0 ? "bg-accent/40" : ""
                }`}
              >
                <button
                  onClick={() => handlePick(e.reference, e.translation)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-medium">
                    {e.reference}
                    {idx === 0 && (
                      <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.translation} · {new Date(e.created_at).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {entries.length > 0 && (
        <div className="border-t border-border px-4 py-2.5 text-center">
          <a href="/account" className="text-xs font-medium text-primary hover:underline">
            View all on Account →
          </a>
        </div>
      )}
    </div>
  );
}
