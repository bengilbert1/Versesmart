import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  listSearchHistory,
  deleteSearchHistoryEntry,
} from "@/lib/history.functions";
import {
  getLocalHistory,
  deleteLocalHistoryEntry,
} from "@/lib/local-history";

type Props = {
  onPick: (reference: string, translation: string) => void;
};

export function HistoryDropdown({ onPick }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <HistoryDropdownTrigger
        open={open}
        onToggle={() => setOpen((o) => !o)}
      />
      <HistoryDropdownPanel
        open={open}
        onClose={() => setOpen(false)}
        onPick={onPick}
      />
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
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["search-history", user?.id ?? "anon"],
    queryFn: async () => {
      if (user) {
        const res = await fetch("/api/history");
        return res.json();
      }
      return { entries: getLocalHistory() };
    },
    enabled: open,
    staleTime: 30_000,
  });

  const entries = data?.entries ?? [];

  const handleDelete = async (id: string) => {
    if (user) {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
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
    <div className="mt-2 rounded-xl border border-border bg-background p-2 shadow-lg">
      <div className="px-3 py-2 text-sm font-medium">Recent searches</div>

      {isLoading ? (
        <div className="p-3 text-sm text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="p-3 text-sm text-muted-foreground">
          No saved searches yet. Look up a passage and it will appear here.
        </div>
      ) : (
        <ul>
          {entries.map((e: any, idx: number) => (
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
                <div className="font-medium">{e.reference}</div>
                <div className="text-xs text-muted-foreground">
                  {e.translation} ·{" "}
                  {new Date(e.created_at).toLocaleDateString()}
                </div>
              </button>

              <button
                onClick={() => handleDelete(e.id)}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}