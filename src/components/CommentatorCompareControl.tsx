import { useEffect, useMemo, useState } from "react";


import { Sparkles, X } from "lucide-react";
import { useT } from "@/lib/language-context";
import { normalizeName } from "@/lib/commentator-metadata";
import { listAllSelectableCommentators } from "@/lib/commentator-overrides.functions";
import type { Tier } from "@/lib/tiers";

const MAX_SELECTION = 20;

const STORAGE_KEY = "vs:userSelectedCommentators";

export function readUserSelection(): string[] {
  if (typeof window === "undefined") return [];
  try {
    // Migrate any legacy sessionStorage value to localStorage so the
    // selection persists across tabs and reloads (cleared only on sign-out,
    // app close, or via "Return to auto-selection").
    const legacy = sessionStorage.getItem(STORAGE_KEY);
    if (legacy && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, legacy);
    }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeUserSelection(names: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
    window.dispatchEvent(new CustomEvent("vs:user-selection-changed"));
  } catch {}
}

export function clearUserSelection() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    window.dispatchEvent(new CustomEvent("vs:user-selection-changed"));
  } catch {}
}


export function useUserSelection(): [string[], (n: string[]) => void] {
  const [sel, setSel] = useState<string[]>(() => readUserSelection());
  useEffect(() => {
    const handler = () => setSel(readUserSelection());
    window.addEventListener("vs:user-selection-changed", handler);
    return () => window.removeEventListener("vs:user-selection-changed", handler);
  }, []);
  return [
    sel,
    (n) => {
      writeUserSelection(n);
      setSel(n);
    },
  ];
}

type Props = {
  tier: Tier;
  currentlyDisplayed: string[];
  onApply: (names: string[]) => void;
  label: string;
};

export function CommentatorCompareControl({ tier, currentlyDisplayed, onApply, label }: Props) {
  const [open, setOpen] = useState(false);
  const isExplore = tier === "explore";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
      >
        <Sparkles className="h-4 w-4" />
        {label}
      </button>

      {open && isExplore && (
        <SelectorModal
          currentlyDisplayed={currentlyDisplayed}
          onClose={() => setOpen(false)}
          onApply={(names) => {
            onApply(names);
            setOpen(false);
          }}
        />
      )}

      {open && !isExplore && <DisplayOnlyModal onClose={() => setOpen(false)} />}
    </>
  );
}

function DisplayOnlyModal({ onClose }: { onClose: () => void }) {
  const { data: rawNames = [] } = useQuery({
    queryKey: ["selectable-commentators"],
    queryFn: () => listAllSelectableCommentators(),
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
  });

  const allNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of rawNames) {
      const k = normalizeName(n);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [rawNames]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-background text-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="font-display text-xl font-semibold">Commentators</h2>
            <p className="mt-2 text-sm text-foreground/80">
              These are the commentators currently used by VerseSmart. Upgrade to Explore
              to hand-pick which commentators you want to compare for each verse lookup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto px-2 py-2">
          {allNames.map((name) => {
            const k = normalizeName(name);
            return (
              <li key={k}>
                <label className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 opacity-70 cursor-not-allowed">
                  <span className="text-sm">{name}</span>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    readOnly
                    aria-disabled
                    className="h-4 w-4 accent-primary cursor-not-allowed"
                  />
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Link
            to="/pricing"
            onClick={onClose}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Upgrade to Explore
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function _UnusedNudgeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="max-w-md rounded-3xl bg-background text-foreground p-8 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold">Explore plan feature</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hand-pick which commentators to compare. This feature is available on the Explore plan.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/pricing"
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={onClose}
          >
            See plans
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectorModal({
  currentlyDisplayed,
  onClose,
  onApply,
}: {
  currentlyDisplayed: string[];
  onClose: () => void;
  onApply: (names: string[]) => void;
}) {
  const t = useT();
  const { data: rawNames = [] } = useQuery({
    queryKey: ["selectable-commentators"],
    queryFn: () => listAllSelectableCommentators(),
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
  });

  // Defensive client-side dedupe by normalized name key. Server already
  // collapses to Primary per name_key; this guards against any residual
  // double entries surfacing in the UI.
  const allNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of rawNames) {
      const k = normalizeName(n);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    return out;
  }, [rawNames]);

  const [selected, setSelected] = useState<Set<string>>(() => {
    const stored = readUserSelection();
    if (stored.length >= 2) return new Set(stored.map(normalizeName));
    return new Set(currentlyDisplayed.map(normalizeName));
  });

  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allNames;
    return allNames.filter((n) => n.toLowerCase().includes(q));
  }, [allNames, filter]);

  const atLimit = selected.size >= MAX_SELECTION;

  const toggle = (name: string) => {
    const k = normalizeName(name);
    const isOn = selected.has(k);
    if (!isOn && atLimit) {
      setError(t("compare.selectionMaxNudge"));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setError(null);
  };

  const save = () => {
    const keep = allNames.filter((n) => selected.has(normalizeName(n)));
    if (keep.length < 2) {
      setError(t("compare.selectionMinError"));
      return;
    }
    onApply(keep);
  };

  const reset = () => {
    clearUserSelection();
    onApply([]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-background text-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="font-display text-xl font-semibold">Select commentators to compare</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose at least 2. Your selection overrides the default balancing rules and
              persists for this session.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {selected.size} / {MAX_SELECTION}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-2 py-2">
          {visible.map((name) => {
            const k = normalizeName(name);
            const on = selected.has(k);
            const disabled = !on && atLimit;
            return (
              <li key={k}>
                <label
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"
                  }`}
                >
                  <span className="text-sm">{name}</span>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={() => toggle(name)}
                    className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                  />
                </label>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches.</li>
          )}
        </ul>

        {error && (
          <div className="border-t border-border bg-destructive/10 px-5 py-2 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Return to auto-selection
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Save selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
