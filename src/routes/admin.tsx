import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getAdminAnalytics, type AdminAnalytics } from "@/lib/admin-analytics.functions";
import {
  listSeenCommentators,
  setCommentatorBlock,
  getLastLookupRoster,
  getCountryAnalytics,
  type SeenCommentator,
  type LastLookupRoster,
  type CountryAnalytics,
} from "@/lib/commentator-blocks.functions";
import {
  listCommentatorOverrides,
  upsertCommentatorOverride,
  deleteCommentatorOverride,
  setPrimaryDuplicate,
  setOverrideHidden,
  setCommentatorPortrait,
  removeCommentatorPortrait,
  listCommentatorCategories,
  addCommentatorCategory,
  listDeletedCommentators,
  deleteCommentatorById,
  type CommentatorOverrideRow,
  type CommentatorCategoryRow,
} from "@/lib/commentator-overrides.functions";
import {
  runCommentatorAudit,
  listCommentatorAuditLog,
  type CommentatorAuditLogRow,
} from "@/lib/commentator-audit.functions";
import { listAuthEvents, type AuthEventRow } from "@/lib/auth-events.functions";
import {
  listAdminCommentatorPrefs,
  setAdminCommentatorHidden,
  setAdminCommentatorOrder,
  type AdminCommentatorPref,
} from "@/lib/admin-commentator-prefs.functions";
import { AUTHOR_FALLBACK_THUMB } from "@/components/AuthorThumbnail";
import { AdminBlogPanel } from "@/components/AdminBlogPanel";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DENOMINATION_KEYS,
  GENDER_KEYS,
  normalizeName,
  COMMENTATOR_OVERRIDES,
} from "@/lib/commentator-metadata";
import { KNOWN_COMMENTATORS } from "@/lib/known-commentators";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/language-context";
import { getLanguageUsage, type LanguageUsageReport } from "@/lib/language-usage.functions";
import {
  listTesters,
  addTester,
  removeTester,
  type TesterRow,
} from "@/lib/testers.functions";
import {
  getVerseOfTheDayAdmin,
  updateVerseOfTheDaySettings,
  updateVerseOfTheDayEntry,
  resetVerseOfTheDayEntry,
  type VotdAdminPayload,
} from "@/lib/votd.functions";
import votdEn from "@/locales/votd/en.json";
import uiEn from "@/locales/en.json";
import uiEs from "@/locales/es.json";
import uiFr from "@/locales/fr.json";
import uiDe from "@/locales/de.json";
import uiHi from "@/locales/hi.json";
import uiZhHans from "@/locales/zh-Hans.json";
import uiZhHant from "@/locales/zh-Hant.json";
import uiAr from "@/locales/ar.json";
import votdEs from "@/locales/votd/es.json";
import votdFr from "@/locales/votd/fr.json";
import votdDe from "@/locales/votd/de.json";
import votdHi from "@/locales/votd/hi.json";
import votdZhHans from "@/locales/votd/zh-Hans.json";
import votdZhHant from "@/locales/votd/zh-Hant.json";
import votdAr from "@/locales/votd/ar.json";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage } from "@/lib/languages";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, GripVertical } from "lucide-react";


// Format a 1..365 day-of-year as "12 Jun" using a non-leap reference year.
function formatDayOfYearLabel(day: number): string {
  const d = new Date(Date.UTC(2025, 0, day)); // 2025 is non-leap; day 1 = Jan 1
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// Hidden, unlinked admin route. SSR off so the gate never flashes content.
// The robots meta + noindex header keep the URL out of search engines.
export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "—" },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
    ],
  }),
  component: AdminPage,
});

function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="font-display text-4xl font-semibold">404</h1>
      <p className="mt-2 text-sm text-muted-foreground">This page could not be found.</p>
    </main>
  );
}

function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center text-sm text-muted-foreground">
      Loading…
    </main>
  );
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const fetchFn = useServerFn(getAdminAnalytics);

  const query = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchFn(),
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  if (authLoading) return <Loading />;
  if (!user) return <NotFound />;
  if (query.isLoading) return <Loading />;
  // Any error from the gated serverFn (including the admin email check)
  // surfaces as a 404. We never reveal that the route exists.
  if (query.isError || !query.data) return <NotFound />;

  return <Dashboard data={query.data} />;
}

function Dashboard({ data }: { data: AdminAnalytics }) {
  const rolling7 = useMemo(
    () => data.rolling7.map((d) => ({ day: d.day.slice(5), avg: d.avg })),
    [data.rolling7],
  );

  const sectionByType = useMemo(() => {
    const groups: Record<string, { key: string; count: number }[]> = {};
    for (const s of data.topSections) {
      (groups[s.type] ??= []).push({ key: s.key, count: s.count });
    }
    return groups;
  }, [data.topSections]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">VerseSmart</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aggregated, anonymous usage only. No per-user data is collected or shown.
        </p>
      </header>

      <Tabs defaultValue="analytics">
        <TabsList className="mb-6">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="translations">Translations Overview</TabsTrigger>
          <TabsTrigger value="languages">Languages Overview</TabsTrigger>
          <TabsTrigger value="commentators">Commentators</TabsTrigger>
          <TabsTrigger value="signin">Sign-In</TabsTrigger>
          <TabsTrigger value="blog">Blog Posts</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Today" value={data.totals.today} />
            <Stat label="Last 7 days" value={data.totals.last7} />
            <Stat label="Last 30 days" value={data.totals.last30} />
            <Stat label="All time (top verses)" value={data.totals.allTime} />
          </section>

          <Card
            title="Search Volume (7-Day Rolling Average)"
            description="Displays verse searches per day, smoothed as a 7-day rolling average from total queries logged."
            className="mt-8"
            collapsible
            defaultOpen
          >
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={rolling7} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [v, "7-day avg"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title="Search Activity by Time of Day"
            description="Shows when searches happen, grouped by day of week and hour, based on logged query timestamps."
            className="mt-8"
            collapsible
            defaultOpen={false}
          >
            <Heatmap data={data.heatmap} />
          </Card>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card
              title="Searches by User Type"
              description="Breaks down total searches by user tier (free, premium, etc.) from logged query events."
              collapsible
              defaultOpen={false}
            >
              <TierBreakdown rows={data.tierBreakdown} />
            </Card>
            <Card
              title="User Conversion Funnel"
              description="Tracks progression from visitor to free to premium, based on subscription and activity events."
              collapsible
              defaultOpen={false}
            >
              <Funnel rows={data.funnel} />
            </Card>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card
              title="User Retention Over Time"
              description="Shows the percentage of new users still active after Day 1, 7, and 30, based on daily activity logs."
              collapsible
              defaultOpen={false}
            >
              <Retention rows={data.retention} />
            </Card>
            <Card
              title="Feature Usage Breakdown"
              description="Breaks down which features are most used, based on interaction events logged across the app."
              collapsible
              defaultOpen={false}
            >
              <FeatureUsage rows={data.featureUsage} />
            </Card>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card
              title="Most searched verses"
              description="Ranks verses by total lookup count from logged verse searches."
              collapsible
              defaultOpen={false}
            >
              <RankedList rows={data.topVerses.slice(0, 15)} emptyLabel="No verse searches yet." />
            </Card>
            <Card
              title="Most typed explore themes"
              description="Ranks themes by how often users typed them into the Explore search."
              collapsible
              defaultOpen={false}
            >
              <RankedList rows={data.topThemes.slice(0, 15)} emptyLabel="No theme searches yet." />
            </Card>
          </div>

          <Card
            title="Section opens by type"
            description="Counts how often each commentary section is opened, grouped by section type."
            className="mt-8"
            collapsible
            defaultOpen={false}
          >

            {Object.keys(sectionByType).length === 0 ? (
              <p className="text-sm text-muted-foreground">No section opens yet.</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {Object.entries(sectionByType).map(([type, rows]) => (
                  <div key={type}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {type}
                    </h3>
                    <div className="h-48 w-full">
                      <ResponsiveContainer>
                        <BarChart data={rows.slice(0, 8)} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="key" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <CountryAnalyticsSection />

          <VerseOfTheDaySection />
          <TestersSection />
        </TabsContent>

        <TabsContent value="translations">
          <TranslationsOverview />
        </TabsContent>

        <TabsContent value="languages">
          <LanguagesOverview />
        </TabsContent>

        <TabsContent value="commentators">
          <CommentatorsPanel />
        </TabsContent>

        <TabsContent value="signin">
          <SignInActivityPanel />
        </TabsContent>

        <TabsContent value="blog">
          <AdminBlogPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Heatmap({ data }: { data: { dow: number; hour: number; count: number }[] }) {
  const grid = useMemo(() => {
    const m = new Map<string, number>();
    let max = 0;
    for (const c of data) {
      m.set(`${c.dow}-${c.hour}`, c.count);
      if (c.count > max) max = c.count;
    }
    return { m, max };
  }, [data]);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity in the last 30 days yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid" style={{ gridTemplateColumns: "auto repeat(7, minmax(28px, 1fr))" }}>
          <div />
          {DOW_LABELS.map((d) => (
            <div key={d} className="pb-1 text-center text-[10px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {Array.from({ length: 24 }).flatMap((_, hour) => [
            <div
              key={`h-${hour}`}
              className="pr-2 text-right text-[10px] tabular-nums text-muted-foreground"
            >
              {hour.toString().padStart(2, "0")}
            </div>,
            ...DOW_LABELS.map((_, dow) => {
              const count = grid.m.get(`${dow}-${hour}`) ?? 0;
              const intensity = grid.max > 0 ? count / grid.max : 0;
              return (
                <div
                  key={`${dow}-${hour}`}
                  title={`${DOW_LABELS[dow]} ${hour}:00 — ${count} search${count === 1 ? "" : "es"}`}
                  className="m-[1px] aspect-square rounded-sm border border-border/40"
                  style={{
                    background:
                      intensity === 0
                        ? "hsl(var(--muted))"
                        : `color-mix(in oklab, hsl(var(--primary)) ${Math.round(intensity * 100)}%, hsl(var(--muted)))`,
                  }}
                />
              );
            }),
          ])}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Hours UTC. Darker cells = more searches in the last 30 days.
        </p>
      </div>
    </div>
  );
}

const TIER_LABELS: Record<string, string> = {
  anonymous: "Anonymous",
  free: "Free (signed-in)",
  engage: "Engage",
  explore: "Explore",
};
const TIER_ORDER = ["anonymous", "free", "engage", "explore"];
const TIER_COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(var(--primary) / 0.55)",
  "hsl(var(--primary) / 0.8)",
  "hsl(var(--primary))",
];

function TierBreakdown({ rows }: { rows: { tier: string; count: number }[] }) {
  const ordered = TIER_ORDER.map((t) => ({
    tier: t,
    label: TIER_LABELS[t],
    count: rows.find((r) => r.tier === t)?.count ?? 0,
  }));
  const total = ordered.reduce((a, r) => a + r.count, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No searches in the last 30 days.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr] sm:items-center">
      <div className="h-56">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={ordered}
              dataKey="count"
              nameKey="label"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={2}
            >
              {ordered.map((_, i) => (
                <Cell key={i} fill={TIER_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number, _n, p) => [
                `${v.toLocaleString()} (${Math.round((v / total) * 100)}%)`,
                p?.payload?.label,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {ordered.map((r, i) => (
          <li key={r.tier} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: TIER_COLORS[i] }}
            />
            <span className="flex-1">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {r.count.toLocaleString()} ({total > 0 ? Math.round((r.count / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FUNNEL_LABELS: Record<string, string> = {
  anonymous: "Anonymous (30d)",
  free_signup: "Free Signup",
  engage: "Engage",
  explore: "Explore",
};
const FUNNEL_ORDER = ["anonymous", "free_signup", "engage", "explore"];

function Funnel({ rows }: { rows: { stage: string; count: number }[] }) {
  const ordered = FUNNEL_ORDER.map((s) => ({
    stage: s,
    label: FUNNEL_LABELS[s],
    count: rows.find((r) => r.stage === s)?.count ?? 0,
  }));
  const max = Math.max(...ordered.map((r) => r.count), 1);
  if (ordered.every((r) => r.count === 0)) {
    return <p className="text-sm text-muted-foreground">No funnel data yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {ordered.map((r, i) => {
        const width = Math.max(8, Math.round((r.count / max) * 100));
        const prev = i > 0 ? ordered[i - 1].count : null;
        const drop =
          prev && prev > 0
            ? Math.round(((prev - r.count) / prev) * 100)
            : null;
        return (
          <li key={r.stage}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count.toLocaleString()}
                {drop !== null && drop > 0 && (
                  <span className="ml-2 text-destructive">−{drop}%</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-6 w-full overflow-hidden rounded-md bg-muted">
              <div
                className="h-full rounded-md bg-primary"
                style={{ width: `${width}%`, opacity: 0.4 + (0.6 * (FUNNEL_ORDER.length - i)) / FUNNEL_ORDER.length }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Retention({ rows }: { rows: { dayOffset: number; retained: number; cohortSize: number; pct: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough data yet.</p>;
  }
  const series = rows
    .slice()
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .map((r) => ({ label: `Day ${r.dayOffset}`, pct: r.pct, retained: r.retained, cohort: r.cohortSize }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            unit="%"
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(_v, _n, p) => {
              const d = p?.payload as { pct: number; retained: number; cohort: number };
              return [`${d.pct}% (${d.retained}/${d.cohort})`, "Retention"];
            }}
          />
          <Line
            type="monotone"
            dataKey="pct"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function FeatureUsage({ rows }: { rows: { feature: string; count: number }[] }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  if (sorted.every((r) => r.count === 0)) {
    return <p className="text-sm text-muted-foreground">No feature usage yet.</p>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={90}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TestersSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTesters);
  const addFn = useServerFn(addTester);
  const removeFn = useServerFn(removeTester);

  const query = useQuery({
    queryKey: ["admin-testers"],
    queryFn: () => listFn(),
    retry: false,
    staleTime: 30_000,
  });

  const [email, setEmail] = useState("");
  const [days, setDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMut = useMutation({
    mutationFn: (input: { email: string; expiryDays: number; notes?: string }) =>
      addFn({ data: input }),
    onSuccess: () => {
      setEmail("");
      setDays(7);
      setNotes("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin-testers"] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Failed to add tester"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-testers"] }),
  });

  const rows: TesterRow[] = query.data ?? [];

  return (
    <Card title="Testers" className="mt-8">
      <form
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          addMut.mutate({
            email: email.trim(),
            expiryDays: days,
            notes: notes.trim() || undefined,
          });
        }}
      >
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Email</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Expiry (days)</label>
          <Input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 7)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <Button type="submit" disabled={addMut.isPending}>
          {addMut.isPending ? "Adding…" : "Add Tester"}
        </Button>
      </form>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No testers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Last login</th>
                <th className="py-2 pr-3 font-medium">Expires</th>
                <th className="py-2 pr-3 font-medium">Days left</th>
                <th className="py-2 pr-3 font-medium">Notes</th>
                <th className="py-2 pr-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{r.email ?? "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {new Date(r.expires_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.is_tester ? r.days_remaining : <span className="text-muted-foreground">expired</span>}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.notes ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMut.mutate(r.id)}
                      disabled={removeMut.isPending}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function Card({
  title,
  description,
  children,
  className = "",
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) {
    return (
      <section className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 mb-4 text-xs text-muted-foreground">{description}</p>
        ) : (
          <div className="mb-4" />
        )}
        {children}
      </section>
    );
  }
  return (
    <section className={`rounded-2xl border border-border bg-card ${className}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          {description ? (
            <p className="mb-2 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 pb-5 pt-2 text-left sm:px-6 sm:pb-6">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function RankedList({
  rows,
  emptyLabel,
}: {
  rows: { key: string; count: number }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ol className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={`${r.key}-${i}`} className="flex items-center gap-3 text-sm">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {i + 1}.
          </span>
          <span className="min-w-0 flex-1 truncate" title={r.key}>
            {r.key}
          </span>
          <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-muted sm:block">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.round((r.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums">
            {r.count.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}

function VerseOfTheDaySection() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getVerseOfTheDayAdmin);
  const updateSettingsFn = useServerFn(updateVerseOfTheDaySettings);
  const updateEntryFn = useServerFn(updateVerseOfTheDayEntry);
  const resetEntryFn = useServerFn(resetVerseOfTheDayEntry);

  const query = useQuery({
    queryKey: ["admin-votd"],
    queryFn: () => fetchFn(),
    retry: false,
    staleTime: 30_000,
  });

  const settingsMut = useMutation({
    mutationFn: (input: Parameters<typeof updateSettingsFn>[0]["data"]) =>
      updateSettingsFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-votd"] });
      qc.invalidateQueries({ queryKey: ["votd"] });
      toast.success("Saved");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to save"),
  });
  const entryMut = useMutation({
    mutationFn: (input: {
      dayOfYear: number;
      reference: string;
      excerpt: string;
      guiltInnocenceSummary?: string | null;
      shameHonourSummary?: string | null;
      fearPowerSummary?: string | null;
    }) => updateEntryFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-votd"] });
      qc.invalidateQueries({ queryKey: ["votd"] });
      toast.success("Saved");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to save"),
  });
  const resetMut = useMutation({
    mutationFn: (dayOfYear: number) => resetEntryFn({ data: { dayOfYear } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-votd"] });
      qc.invalidateQueries({ queryKey: ["votd"] });
      toast.success("Reset");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to reset"),
  });

  const data: VotdAdminPayload | undefined = query.data;
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{
    dayOfYear: number;
    reference: string;
    excerpt: string;
    guiltInnocenceSummary: string;
    shameHonourSummary: string;
    fearPowerSummary: string;
  } | null>(null);
  const [overrideRef, setOverrideRef] = useState("");
  const [overrideExc, setOverrideExc] = useState("");
  const [overrideGi, setOverrideGi] = useState("");
  const [overrideSh, setOverrideSh] = useState("");
  const [overrideFp, setOverrideFp] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    if (!data) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return data.entries;
    return data.entries.filter(
      (e) => e.reference.toLowerCase().includes(f) || e.excerpt.toLowerCase().includes(f) || String(e.dayOfYear) === f,
    );
  }, [data, filter]);

  if (query.isLoading) {
    return (
      <Card title="Verse of the Day Settings" className="mt-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (!data) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const overrideActive =
    data.overrideReference && data.overrideExcerpt && data.overrideDate === todayStr;

  const activeDay = selectedDay ?? data.todayDayOfYear;
  const activeEntry = data.entries.find((e) => e.dayOfYear === activeDay);
  // When viewing today AND an override is active, the user-facing dropdown
  // shows summaries for the override's resolved day. Match that here so the
  // admin preview is identical to what users see.
  const lookupDay =
    activeDay === data.todayDayOfYear ? data.todayResolvedDayOfYear : activeDay;
  const localized = (votdEn as Record<string, { gi: string; sh: string; fp: string }>)[String(lookupDay)];
  const previewSummaries = activeEntry?.summaries
    ? {
        guiltInnocence: localized?.gi ?? activeEntry.summaries.guiltInnocence,
        shameHonour: localized?.sh ?? activeEntry.summaries.shameHonour,
        fearPower: localized?.fp ?? activeEntry.summaries.fearPower,
      }
    : null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card title="Verse of the Day Settings" className="mt-8" collapsible defaultOpen={false}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
        <div>
          <p className="text-sm font-medium">Feature {data.enabled ? "enabled" : "disabled"}</p>
          <p className="text-xs text-muted-foreground">Controls the bar on the homepage.</p>
        </div>
        <Button
          variant={data.enabled ? "outline" : "default"}
          size="sm"
          disabled={settingsMut.isPending}
          onClick={() => settingsMut.mutate({ enabled: !data.enabled })}
        >
          {data.enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Day {activeDay} — {formatDayOfYearLabel(activeDay)}
            {activeDay === data.todayDayOfYear && (
              <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Today
              </span>
            )}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setSelectedDay(((activeDay - 2 + 365) % 365) + 1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={1}
              max={365}
              value={activeDay}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isInteger(v) && v >= 1 && v <= 365) setSelectedDay(v);
              }}
              className="h-7 w-16 text-center text-xs"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setSelectedDay((activeDay % 365) + 1)}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {activeDay !== data.todayDayOfYear && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setSelectedDay(null)}
              >
                Today
              </Button>
            )}
          </div>
        </div>
        {activeEntry ? (
          <>
            <p className="mt-2 text-sm">
              <span className="font-semibold">{activeEntry.reference}</span>
              <span className="text-muted-foreground"> — &ldquo;{activeEntry.excerpt}&rdquo;</span>
            </p>
            {previewSummaries && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-background/60 p-3 text-xs">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Dropdown preview
                </p>
                <p><span className="font-semibold">Guilt/Innocence — </span><span className="text-muted-foreground">{previewSummaries.guiltInnocence}</span></p>
                <p><span className="font-semibold">Shame/Honour — </span><span className="text-muted-foreground">{previewSummaries.shameHonour}</span></p>
                <p><span className="font-semibold">Fear/Power — </span><span className="text-muted-foreground">{previewSummaries.fearPower}</span></p>
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No verse assigned today - try your own our verse selector.
          </p>
        )}
        {activeDay === data.todayDayOfYear && overrideActive && (
          <p className="mt-1 text-xs text-primary">Today's verse is currently overridden.</p>
        )}
      </div>


      <div className="mb-8 rounded-xl border border-border p-4">
        <p className="mb-2 text-sm font-medium">Override today's verse (optional)</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input
            placeholder="Reference (e.g. John 3:16)"
            value={overrideRef || data.overrideReference || ""}
            onChange={(e) => setOverrideRef(e.target.value)}
          />
          <Input
            placeholder="Short excerpt"
            value={overrideExc || data.overrideExcerpt || ""}
            onChange={(e) => setOverrideExc(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={settingsMut.isPending}
              onClick={() => {
                const r = (overrideRef || data.overrideReference || "").trim();
                const x = (overrideExc || data.overrideExcerpt || "").trim();
                if (!r || !x) {
                  toast.error("Reference and excerpt are required");
                  return;
                }
                settingsMut.mutate({
                  overrideReference: r,
                  overrideExcerpt: x,
                  overrideDate: todayStr,
                  overrideGuiltInnocence: (overrideGi || data.overrideGuiltInnocence || "").trim() || null,
                  overrideShameHonour: (overrideSh || data.overrideShameHonour || "").trim() || null,
                  overrideFearPower: (overrideFp || data.overrideFearPower || "").trim() || null,
                });
              }}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={settingsMut.isPending}
              onClick={() => {
                setOverrideRef("");
                setOverrideExc("");
                setOverrideGi("");
                setOverrideSh("");
                setOverrideFp("");
                settingsMut.mutate({
                  overrideReference: null,
                  overrideExcerpt: null,
                  overrideDate: null,
                  overrideGuiltInnocence: null,
                  overrideShameHonour: null,
                  overrideFearPower: null,
                });
              }}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Textarea
            placeholder="Guilt/Innocence summary (optional override)"
            value={overrideGi || data.overrideGuiltInnocence || ""}
            onChange={(e) => setOverrideGi(e.target.value)}
            rows={3}
          />
          <Textarea
            placeholder="Shame/Honour summary (optional override)"
            value={overrideSh || data.overrideShameHonour || ""}
            onChange={(e) => setOverrideSh(e.target.value)}
            rows={3}
          />
          <Textarea
            placeholder="Fear/Power summary (optional override)"
            value={overrideFp || data.overrideFearPower || ""}
            onChange={(e) => setOverrideFp(e.target.value)}
            rows={3}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          When blank, the static 365-day cycle is used. Summary overrides apply only when the verse override above is active.
        </p>
      </div>



      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">All 365 entries</p>
        <Input
          placeholder="Filter by day, reference or text…"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
          className="max-w-xs"
        />
      </div>

      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card">
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Reference</th>
              <th className="px-3 py-2 font-medium">Excerpt</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((e) => (
              <tr
                key={e.dayOfYear}
                className={`border-b border-border/60 ${e.dayOfYear === activeDay ? "bg-primary/5" : ""}`}
              >
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{e.dayOfYear}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDayOfYearLabel(e.dayOfYear)}</td>
                <td className="px-3 py-2">{e.reference}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  <span className="line-clamp-1">{e.excerpt}</span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDay(e.dayOfYear)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditing({
                        dayOfYear: e.dayOfYear,
                        reference: e.reference,
                        excerpt: e.excerpt,
                        guiltInnocenceSummary: e.summaries?.guiltInnocence ?? "",
                        shameHonourSummary: e.summaries?.shameHonour ?? "",
                        fearPowerSummary: e.summaries?.fearPower ?? "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={resetMut.isPending}
                    onClick={() => resetMut.mutate(e.dayOfYear)}
                  >
                    Reset
                  </Button>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No entries match the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Page {safePage + 1} of {pageCount} — {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={safePage === 0}
            onClick={() => setPage(Math.max(0, safePage - 1))}
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
          >
            Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>


      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-background text-foreground p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Edit day {editing.dayOfYear}</h3>
            <div className="mt-4 space-y-3">
              <Input
                value={editing.reference}
                onChange={(ev) => setEditing({ ...editing, reference: ev.target.value })}
                placeholder="Reference"
              />
              <Input
                value={editing.excerpt}
                onChange={(ev) => setEditing({ ...editing, excerpt: ev.target.value })}
                placeholder="Excerpt"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Guilt/Innocence summary</label>
                <Textarea
                  value={editing.guiltInnocenceSummary}
                  onChange={(ev) => setEditing({ ...editing, guiltInnocenceSummary: ev.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shame/Honour summary</label>
                <Textarea
                  value={editing.shameHonourSummary}
                  onChange={(ev) => setEditing({ ...editing, shameHonourSummary: ev.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fear/Power summary</label>
                <Textarea
                  value={editing.fearPowerSummary}
                  onChange={(ev) => setEditing({ ...editing, fearPowerSummary: ev.target.value })}
                  rows={3}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Leave a summary blank to fall back to the generic default for that worldview.</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                disabled={entryMut.isPending}
                onClick={() => {
                  entryMut.mutate(
                    {
                      dayOfYear: editing.dayOfYear,
                      reference: editing.reference,
                      excerpt: editing.excerpt,
                      guiltInnocenceSummary: editing.guiltInnocenceSummary.trim() || null,
                      shameHonourSummary: editing.shameHonourSummary.trim() || null,
                      fearPowerSummary: editing.fearPowerSummary.trim() || null,
                    },
                    { onSuccess: () => setEditing(null) },
                  );
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function TranslationsOverview() {
  const defaultLang = getLanguage(DEFAULT_LANGUAGE);
  const contexts = ["Verse Lookup", "Comparison View", "Verse of the Day", "AI Chat context"];

  return (
    <div className="space-y-6">
      <Card title="Active Translations">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Translation</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Used In</TableHead>
                <TableHead>Storage Paths</TableHead>
                <TableHead>Fallback</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LANGUAGES.map((lang) => (
                <TableRow key={lang.code}>
                  <TableCell className="font-medium">
                    {lang.translationName}
                    <span className="ml-2 text-xs text-muted-foreground">({lang.translationCode})</span>
                  </TableCell>
                  <TableCell>
                    {lang.englishName}
                    <span className="ml-1 text-xs text-muted-foreground">({lang.nativeName})</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contexts.map((ctx) => (
                        <span
                          key={ctx}
                          className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {ctx}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    src/locales/{lang.code}.json<br />
                    src/locales/votd/{lang.code}.json
                  </TableCell>
                  <TableCell className="text-sm">
                    {lang.code === DEFAULT_LANGUAGE
                      ? "Default (no fallback)"
                      : `Fallback to ${defaultLang.englishName} (${defaultLang.translationCode})`}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Enabled
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card title="Fallback Rules Summary" collapsible defaultOpen={false}>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            When a user selects a language whose translation is missing or unavailable, the app
            automatically falls back to the default translation:
            <span className="ml-1 font-medium text-foreground">
              {defaultLang.englishName} ({defaultLang.translationCode})
            </span>
            .
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {LANGUAGES.filter((l) => l.code !== DEFAULT_LANGUAGE).map((lang) => (
              <li key={lang.code}>
                If {lang.englishName} ({lang.translationCode}) is unavailable →{" "}
                {defaultLang.englishName} ({defaultLang.translationCode})
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card title="Translation Coverage" collapsible defaultOpen={false}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">UI Strings:</span>{" "}
            src/locales/&lt;lang&gt;.json — localized interface labels and navigation text.
          </p>
          <p>
            <span className="font-medium text-foreground">VOTD Worldview Summaries:</span>{" "}
            src/locales/votd/&lt;lang&gt;.json — 365 daily guilt/innocence, shame/honour, and fear/power summaries.
          </p>
          <p>
            <span className="font-medium text-foreground">Verse Text &amp; Commentary:</span>{" "}
            Fetched dynamically via the Lovable AI Gateway using the translation code above. Cached in verse_cache table.
          </p>
        </div>
      </Card>
    </div>
  );
}

// Flatten nested string keys: { a: { b: "x" } } -> ["a.b"]
function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

const UI_LOCALES: Record<string, unknown> = {
  en: uiEn, es: uiEs, fr: uiFr, de: uiDe, hi: uiHi, ar: uiAr,
  "zh-Hans": uiZhHans, "zh-Hant": uiZhHant,
};
const VOTD_LOCALES: Record<string, unknown> = {
  en: votdEn, es: votdEs, fr: votdFr, de: votdDe, hi: votdHi,
  "zh-Hans": votdZhHans, "zh-Hant": votdZhHant,
};

const USAGE_AREAS = [
  "Homepage", "Pricing page", "Account page", "Search bar",
  "Verse of the Day", "Footer", "Static pages",
];

function LanguagesOverview() {
  const defaultLang = getLanguage(DEFAULT_LANGUAGE);
  const enUiKeys = flattenKeys(uiEn);
  const enVotdKeys = flattenKeys(votdEn);
  const totalKeys = enUiKeys.length + enVotdKeys.length;

  const rows = LANGUAGES.map((lang) => {
    const ui = UI_LOCALES[lang.code];
    const votd = VOTD_LOCALES[lang.code];
    const uiKeys = new Set(flattenKeys(ui));
    const votdKeys = new Set(flattenKeys(votd));
    const missingUi = enUiKeys.filter((k) => !uiKeys.has(k));
    const missingVotd = enVotdKeys.filter((k) => !votdKeys.has(k));
    const present = (enUiKeys.length - missingUi.length) + (enVotdKeys.length - missingVotd.length);
    const pct = totalKeys === 0 ? 100 : Math.round((present / totalKeys) * 100);
    let status: "Full" | "Partial" | "Missing";
    if (pct === 100) status = "Full";
    else if (pct >= 50) status = "Partial";
    else status = "Missing";
    return { lang, missingUi, missingVotd, pct, status };
  });

  return (
    <div className="space-y-6">
      <Card title="UI Language Coverage">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Language</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Missing keys</TableHead>
                <TableHead>Fallback</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ lang, missingUi, missingVotd, pct, status }) => {
                const missingTotal = missingUi.length + missingVotd.length;
                const badgeClass =
                  status === "Full"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : status === "Partial"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-destructive/15 text-destructive";
                return (
                  <TableRow key={lang.code}>
                    <TableCell className="font-medium">
                      {lang.englishName}
                      <span className="ml-1 text-xs text-muted-foreground">({lang.nativeName})</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{lang.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      src/locales/{lang.code}.json<br />
                      src/locales/votd/{lang.code}.json
                    </TableCell>
                    <TableCell className="text-xs">
                      {missingTotal === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <span title={[...missingUi, ...missingVotd.map((k) => `votd.${k}`)].slice(0, 20).join("\n")}>
                          {missingTotal} ({missingUi.length} UI, {missingVotd.length} VOTD)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lang.code === DEFAULT_LANGUAGE
                        ? "—"
                        : `→ ${defaultLang.englishName}`}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                        {status === "Full" ? "Active · Full" : status === "Partial" ? "Active · Partial" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card title="Where each language is used" collapsible defaultOpen={false}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Language</TableHead>
                <TableHead>Used in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LANGUAGES.map((lang) => (
                <TableRow key={lang.code}>
                  <TableCell className="font-medium">{lang.englishName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {USAGE_AREAS.map((area) => (
                        <span
                          key={area}
                          className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card title="Fallback behaviour" collapsible defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {LANGUAGES.filter((l) => l.code !== DEFAULT_LANGUAGE).map((lang) => (
            <li key={lang.code}>
              If {lang.englishName} key is missing → fallback to {defaultLang.englishName}
            </li>
          ))}
        </ul>
      </Card>

      <LanguageUsageSection />

      <Card title="Unsupported languages" collapsible defaultOpen={false}>
        <p className="text-sm text-muted-foreground">
          Sinhala, Tamil, and other languages are not currently bundled. Users selecting an
          unsupported locale fall back to {defaultLang.englishName} ({defaultLang.translationCode}).
        </p>
      </Card>
    </div>
  );
}

function LanguageUsageSection() {
  const fetchFn = useServerFn(getLanguageUsage);
  const { data, isLoading, error } = useQuery<LanguageUsageReport>({
    queryKey: ["admin-language-usage"],
    queryFn: () => fetchFn({ data: undefined as never }),
  });

  return (
    <Card title="Language Usage (last 30 days)">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">Failed to load language usage.</p>
      ) : !data ? null : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {data.totalUsers.toLocaleString()} total users · {data.totalWithPreference.toLocaleString()} with an
            explicit language preference. Users without a stored preference use the default
            ({getLanguage(DEFAULT_LANGUAGE).englishName}).
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Language</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Users selected</TableHead>
                  <TableHead className="text-right">Active (30d)</TableHead>
                  <TableHead className="text-right">% of users</TableHead>
                  <TableHead>Selection</TableHead>
                  <TableHead>Last used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LANGUAGES.map((lang) => {
                  const row = data.rows.find((r) => r.language === lang.code);
                  const selected = row?.selectedCount ?? 0;
                  const active = row?.activeCount ?? 0;
                  const pct = data.totalUsers > 0
                    ? Math.round((selected / data.totalUsers) * 1000) / 10
                    : 0;
                  const lastUsed = row?.lastUsed
                    ? new Date(row.lastUsed).toLocaleDateString()
                    : "—";
                  return (
                    <TableRow key={lang.code}>
                      <TableCell className="font-medium">
                        {lang.englishName}
                        <span className="ml-1 text-xs text-muted-foreground">({lang.nativeName})</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{lang.code}</TableCell>
                      <TableCell className="text-right">{selected.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{active.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{pct}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lang.code === DEFAULT_LANGUAGE ? "Default (implicit)" : "Manually selected"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lastUsed}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Note: language origin (IP‑suggested vs manually chosen) is not currently tracked.
            All rows in <code>user_preferences</code> reflect an explicit user choice.
          </p>
        </>
      )}
    </Card>
  );
}




const REGION_KEYS_ADMIN = [
  "africa",
  "asia",
  "europe",
  "latin_america",
  "middle_east",
  "north_america",
  "oceania",
  "other",
] as const;

type RegionKeyAdmin = (typeof REGION_KEYS_ADMIN)[number];

const TRADITION_KEYS_ADMIN = [
  "classic",
  "contemporary",
  "foundational",
  "fathers",
  "reformation",
] as const;
type TraditionKeyAdmin = (typeof TRADITION_KEYS_ADMIN)[number];

const WORLDVIEW_KEYS_ADMIN = [
  "guilt-innocence",
  "shame-honour",
  "fear-power",
] as const;
type WorldviewKeyAdmin = (typeof WORLDVIEW_KEYS_ADMIN)[number];

const WORLDVIEW_LABEL_KEYS: Record<WorldviewKeyAdmin, string> = {
  "guilt-innocence": "worldview.guiltInnocence",
  "shame-honour": "worldview.shameHonour",
  "fear-power": "worldview.fearPower",
};

type EditableMeta = {
  region: string;
  denomination: string;
  country: string;
  tradition: string;
  worldview: string;
  gender: string;
  publication_era: string;
  birth_year: string;
  death_year: string;
};

const EMPTY_META: EditableMeta = {
  region: "",
  denomination: "",
  country: "",
  tradition: "",
  worldview: "",
  gender: "",
  publication_era: "",
  birth_year: "",
  death_year: "",
};

// Compute the static fallback values from COMMENTATOR_OVERRIDES so dropdowns
// can display the system's current value when there is no admin override row.
function staticFallbackMeta(displayName: string): Partial<EditableMeta> {
  const key = normalizeName(displayName);
  const o = COMMENTATOR_OVERRIDES[key];
  if (!o) return {};
  return {
    region: o.region ?? "",
    denomination: o.denomination ?? "",
    country: o.country ?? "",
    tradition: o.theological_stream ?? "",
    worldview: "",
    gender: o.gender ?? "",
    publication_era: o.publication_era ?? "",
    birth_year: "",
    death_year: "",
  };
}


function CommentatorsPanel() {
  const qc = useQueryClient();
  const fetchSeen = useServerFn(listSeenCommentators);
  const setBlock = useServerFn(setCommentatorBlock);
  const fetchOverrides = useServerFn(listCommentatorOverrides);
  const upsertOverride = useServerFn(upsertCommentatorOverride);
  const deleteOverride = useServerFn(deleteCommentatorOverride);
  const setPrimary = useServerFn(setPrimaryDuplicate);
  const setHidden = useServerFn(setOverrideHidden);
  const setPortrait = useServerFn(setCommentatorPortrait);
  const removePortrait = useServerFn(removeCommentatorPortrait);
  const fetchCategories = useServerFn(listCommentatorCategories);
  const addCategory = useServerFn(addCommentatorCategory);
  const fetchDeleted = useServerFn(listDeletedCommentators);
  const deleteGlobal = useServerFn(deleteCommentatorById);
  const fetchPrefs = useServerFn(listAdminCommentatorPrefs);
  const setPrefHidden = useServerFn(setAdminCommentatorHidden);
  const setPrefOrder = useServerFn(setAdminCommentatorOrder);
  const { t } = useLanguage();
  const [showHidden, setShowHidden] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const seenQuery = useQuery({
    queryKey: ["admin-commentators-seen"],
    queryFn: () => fetchSeen(),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const overridesQuery = useQuery({
    queryKey: ["commentator-overrides"],
    queryFn: () => fetchOverrides(),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ["commentator-categories"],
    queryFn: () => fetchCategories(),
    staleTime: 30_000,
  });
  const deletedQuery = useQuery({
    queryKey: ["commentator-deleted"],
    queryFn: () => fetchDeleted(),
    staleTime: 30_000,
  });
  const deletedSet = useMemo(
    () => new Set(deletedQuery.data ?? []),
    [deletedQuery.data],
  );
  const prefsQuery = useQuery({
    queryKey: ["admin-commentator-prefs"],
    queryFn: () => fetchPrefs(),
    staleTime: 30_000,
  });
  const prefsByKey = useMemo(() => {
    const m = new Map<string, AdminCommentatorPref>();
    for (const p of prefsQuery.data ?? []) m.set(p.name_key, p);
    return m;
  }, [prefsQuery.data]);
  const hiddenSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of prefsQuery.data ?? []) if (p.hidden) s.add(p.name_key);
    return s;
  }, [prefsQuery.data]);
  const togglePrefHidden = useMutation({
    mutationFn: (vars: { name_key: string; hidden: boolean }) =>
      setPrefHidden({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin-commentator-prefs"] });
      const prev = qc.getQueryData<AdminCommentatorPref[]>(["admin-commentator-prefs"]);
      const next = [...(prev ?? [])];
      const i = next.findIndex((p) => p.name_key === vars.name_key);
      if (i >= 0) next[i] = { ...next[i], hidden: vars.hidden };
      else next.push({ name_key: vars.name_key, sort_index: null, hidden: vars.hidden });
      qc.setQueryData(["admin-commentator-prefs"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-commentator-prefs"], ctx.prev);
      toast.error(t("admin.commentators.updateFailed"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-commentator-prefs"] }),
  });
  const saveOrderMutation = useMutation({
    mutationFn: (order: string[]) => setPrefOrder({ data: { order } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-commentator-prefs"] }),
  });
  const deleteGlobalMutation = useMutation({
    mutationFn: (id: string) => deleteGlobal({ data: { id } }),
    onSuccess: () => {
      toast.success(t("admin.commentators.delete.removed"));
      qc.invalidateQueries({ queryKey: ["commentator-deleted"] });
      qc.invalidateQueries({ queryKey: ["commentator-overrides"] });
      qc.invalidateQueries({ queryKey: ["admin-commentators-seen"] });
      qc.invalidateQueries({ queryKey: ["commentator-blocks"] });
      qc.invalidateQueries({ queryKey: ["selectable-commentators"] });
    },
    onError: (e) => toast.error((e as Error).message || t("admin.commentators.updateFailed")),
  });
  const addCategoryMutation = useMutation({
    mutationFn: (vars: { category_type: string; value: string }) =>
      addCategory({ data: { category_type: vars.category_type as "region", value: vars.value } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commentator-categories"] });
      toast.success(t("admin.commentators.edit.categoryAdded"));
    },
    onError: (e) => toast.error((e as Error).message || t("admin.commentators.updateFailed")),
  });
  const extraCategories = useMemo(() => {
    const buckets: Record<string, CommentatorCategoryRow[]> = {};
    for (const c of categoriesQuery.data ?? []) {
      (buckets[c.category_type] ??= []).push(c);
    }
    return buckets;
  }, [categoriesQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: (vars: { name: string; blocked: boolean }) => setBlock({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin-commentators-seen"] });
      const prev = qc.getQueryData<SeenCommentator[]>(["admin-commentators-seen"]);
      qc.setQueryData<SeenCommentator[]>(["admin-commentators-seen"], (old) =>
        (old ?? []).map((c) => (c.name === vars.name ? { ...c, blocked: vars.blocked } : c)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-commentators-seen"], ctx.prev);
      toast.error(t("admin.commentators.updateFailed"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-commentators-seen"] });
      qc.invalidateQueries({ queryKey: ["commentator-blocks"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (vars: {
      display_name: string;
      meta: EditableMeta;
      is_manual?: boolean;
    }) =>
      upsertOverride({
        data: {
          display_name: vars.display_name,
          region: vars.meta.region || null,
          denomination: vars.meta.denomination || null,
          country: vars.meta.country || null,
          tradition: vars.meta.tradition || null,
          worldview: vars.meta.worldview || null,
          gender: vars.meta.gender || null,
          publication_era: vars.meta.publication_era || null,
          birth_year: vars.meta.birth_year ? Number(vars.meta.birth_year) : null,
          death_year: vars.meta.death_year ? Number(vars.meta.death_year) : null,
          is_manual: vars.is_manual ?? false,
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.commentators.edit.saved"));
      qc.invalidateQueries({ queryKey: ["commentator-overrides"] });
      qc.invalidateQueries({ queryKey: ["selectable-commentators"] });
    },
    onError: () => toast.error(t("admin.commentators.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOverride({ data: { id } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["commentator-overrides"] });
      qc.invalidateQueries({ queryKey: ["selectable-commentators"] });
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (id: string) => setPrimary({ data: { id } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["commentator-overrides"] }),
  });

  const hideMutation = useMutation({
    mutationFn: (vars: { id: string; hidden: boolean }) =>
      setHidden({ data: vars }),
    onSuccess: (res) => {
      if (res?.refused === "lastVisible") {
        toast.warning(t("admin.commentators.duplicates.lastWarning"));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["commentator-overrides"] }),
  });

  const portraitMutation = useMutation({
    mutationFn: (vars: { display_name: string; data_url: string }) =>
      setPortrait({ data: vars }),
    onSuccess: () => {
      toast.success(t("admin.commentators.portrait.uploaded"));
      qc.invalidateQueries({ queryKey: ["commentator-overrides"] });
    },
    onError: (e) => toast.error((e as Error).message || t("admin.commentators.updateFailed")),
  });

  const portraitRemoveMutation = useMutation({
    mutationFn: (id: string) => removePortrait({ data: { id } }),
    onSuccess: () => {
      toast.success(t("admin.commentators.portrait.removed"));
      qc.invalidateQueries({ queryKey: ["commentator-overrides"] });
    },
    onError: () => toast.error(t("admin.commentators.updateFailed")),
  });

  // Group display variants by name_key (union of seen + override rows).
  type Variant = {
    display_name: string;
    override?: CommentatorOverrideRow;
    blocked: boolean;
    count: number;
  };
  type Group = {
    name_key: string;
    variants: Variant[];
  };
  const groups: Group[] = useMemo(() => {
    const seen = seenQuery.data ?? [];
    const overrides = overridesQuery.data ?? [];
    const byKey = new Map<string, Map<string, Variant>>();
    const upsertVariant = (display: string, patch: Partial<Variant>) => {
      const key = normalizeName(display);
      if (deletedSet.has(key)) return; // globally-deleted commentators never appear
      const inner = byKey.get(key) ?? new Map<string, Variant>();
      const existing = inner.get(display) ?? { display_name: display, blocked: false, count: 0 };
      inner.set(display, { ...existing, ...patch });
      byKey.set(key, inner);
    };
    // Seed: every static-known commentator appears in the panel even before
    // a verse lookup or override row exists.
    for (const name of KNOWN_COMMENTATORS) upsertVariant(name, {});
    for (const key of Object.keys(COMMENTATOR_OVERRIDES)) {
      if (byKey.has(key)) continue; // already covered by KNOWN_COMMENTATORS
      const display = key.replace(/\b\w/g, (c) => c.toUpperCase());
      upsertVariant(display, {});
    }
    for (const s of seen) upsertVariant(s.name, { blocked: s.blocked, count: s.count });
    for (const o of overrides) upsertVariant(o.display_name, { override: o });
    return Array.from(byKey.entries())
      .map(([name_key, inner]) => ({
        name_key,
        variants: Array.from(inner.values()).sort((a, b) =>
          a.display_name.localeCompare(b.display_name),
        ),
      }))
      .sort((a, b) => a.variants[0].display_name.localeCompare(b.variants[0].display_name));
  }, [seenQuery.data, overridesQuery.data, deletedSet]);

  // Apply admin-local sort order then hidden filter (visual layer only).
  const displayGroups = useMemo(() => {
    const withIdx = groups.map((g) => {
      const idx = prefsByKey.get(g.name_key)?.sort_index;
      return { g, idx: typeof idx === "number" ? idx : Number.POSITIVE_INFINITY };
    });
    withIdx.sort((a, b) => {
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.g.variants[0].display_name.localeCompare(b.g.variants[0].display_name);
    });
    const ordered = withIdx.map((x) => x.g);
    return showHidden ? ordered : ordered.filter((g) => !hiddenSet.has(g.name_key));
  }, [groups, prefsByKey, hiddenSet, showHidden]);

  const handleDrop = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null);
      return;
    }
    const keys = displayGroups.map((g) => g.name_key);
    const from = keys.indexOf(dragKey);
    const to = keys.indexOf(targetKey);
    if (from < 0 || to < 0) {
      setDragKey(null);
      return;
    }
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    // Optimistic local update: write sort_index for every visible key.
    qc.setQueryData<AdminCommentatorPref[]>(["admin-commentator-prefs"], (old) => {
      const map = new Map<string, AdminCommentatorPref>();
      for (const p of old ?? []) map.set(p.name_key, p);
      keys.forEach((k, i) => {
        const cur = map.get(k);
        map.set(k, { name_key: k, sort_index: i, hidden: cur?.hidden ?? false });
      });
      return Array.from(map.values());
    });
    saveOrderMutation.mutate(keys);
    setDragKey(null);
  };


  // --- Add Commentator form ---
  const [newName, setNewName] = useState("");
  const [newMeta, setNewMeta] = useState<EditableMeta>(EMPTY_META);
  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    saveMutation.mutate(
      { display_name: name, meta: newMeta, is_manual: true },
      {
        onSuccess: () => {
          setNewName("");
          setNewMeta(EMPTY_META);
          toast.success(t("admin.commentators.add.added"));
        },
      },
    );
  };

  return (
    <>
      <AuditCard />
      <LastLookupCard />
      <Card title={t("admin.commentators.add.title")} defaultOpen>
        <p className="mb-3 text-xs text-muted-foreground">
          {t("admin.commentators.add.help")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("admin.commentators.add.name")}
            />
          </div>
          <MetaEditor
            value={newMeta}
            onChange={setNewMeta}
            tFn={t}
            fallback={{}}
            extraCategories={extraCategories}
            onAddCategory={(category_type, value) =>
              addCategoryMutation.mutate({ category_type, value })
            }
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={submitNew} disabled={!newName.trim() || saveMutation.isPending}>
            {t("admin.commentators.add.submit")}
          </Button>
        </div>
      </Card>

      <Card title={t("admin.commentators.title")} className="mt-6" defaultOpen>
        <p className="mb-2 text-sm text-muted-foreground">{t("admin.commentators.help")}</p>
        <p className="mb-3 text-xs text-muted-foreground">{t("admin.commentators.liveCapture")}</p>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Drag rows to reorder. Hide rows to tidy your view. These changes affect only your admin view — the live commentator dataset and selection engine are untouched.
          </p>
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
            <Switch checked={showHidden} onCheckedChange={setShowHidden} />
            Show hidden ({hiddenSet.size})
          </label>
        </div>
        {seenQuery.isLoading && overridesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("admin.commentators.loading")}</p>
        ) : displayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.commentators.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {displayGroups.map((g) => (
              <CommentatorGroupRow
                key={g.name_key}
                group={g}
                isHidden={hiddenSet.has(g.name_key)}
                isDragging={dragKey === g.name_key}
                onToggleHidden={() =>
                  togglePrefHidden.mutate({
                    name_key: g.name_key,
                    hidden: !hiddenSet.has(g.name_key),
                  })
                }
                onDragStart={() => setDragKey(g.name_key)}
                onDragOver={(e: ReactDragEvent<HTMLLIElement>) => {
                  if (dragKey && dragKey !== g.name_key) e.preventDefault();
                }}
                onDrop={() => handleDrop(g.name_key)}
                onDragEnd={() => setDragKey(null)}
                onSave={(display_name, meta, is_manual) =>
                  saveMutation.mutate({ display_name, meta, is_manual })
                }
                onBlockToggle={(name, blocked) => toggleMutation.mutate({ name, blocked })}
                onPrimary={(id) => primaryMutation.mutate(id)}
                onHide={(id, hidden) => hideMutation.mutate({ id, hidden })}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPortraitUpload={(display_name, data_url) =>
                  portraitMutation.mutate({ display_name, data_url })
                }
                onPortraitRemove={(id) => portraitRemoveMutation.mutate(id)}
                onDeleteGlobal={(id, display_name) => {
                  const msg = t("admin.commentators.delete.confirm").replace("{name}", display_name);
                  if (typeof window !== "undefined" && !window.confirm(msg)) return;
                  deleteGlobalMutation.mutate(id);
                }}
                isSaving={saveMutation.isPending}
                isUploadingPortrait={portraitMutation.isPending}
                tFn={t}
                extraCategories={extraCategories}
                onAddCategory={(category_type, value) =>
                  addCategoryMutation.mutate({ category_type, value })
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function LastLookupCard() {
  const fetchLast = useServerFn(getLastLookupRoster);
  const q = useQuery({
    queryKey: ["admin-last-lookup-roster"],
    queryFn: () => fetchLast(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const data = q.data;
  return (
    <Card
      title="Last lookup authors"
      description="Rolling record of every commentator returned in the most recent verse lookup across all users."
      defaultOpen
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.authors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lookup recorded yet.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {data.authors.length} authors · updated{" "}
            {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {data.authors.map((name) => (
              <li
                key={name}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
              >
                {name}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function CountryAnalyticsSection() {
  const fetchCountry = useServerFn(getCountryAnalytics);
  const q = useQuery({
    queryKey: ["admin-country-analytics"],
    queryFn: () => fetchCountry(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const data: CountryAnalytics | undefined = q.data;

  const topTotals = useMemo(() => (data?.totals ?? []).slice(0, 15), [data]);
  const dailySeries = useMemo(() => {
    const rows = data?.daily ?? [];
    const topCountries = (data?.totals ?? []).slice(0, 6).map((t) => t.country);
    const dayMap = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      if (!topCountries.includes(r.country)) continue;
      const row = dayMap.get(r.day) ?? { day: r.day };
      row[r.country] = (Number(row[r.country] ?? 0) as number) + r.count;
      dayMap.set(r.day, row);
    }
    return {
      countries: topCountries,
      data: Array.from(dayMap.values()).sort((a, b) =>
        String(a.day).localeCompare(String(b.day)),
      ),
    };
  }, [data]);

  const palette = [
    "hsl(var(--primary))",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
  ];

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <Card
        title="Users by country (lifetime)"
        description="Persistent total of distinct visitors per country, derived from request geolocation. Never resets."
        defaultOpen
      >
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : topTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No country data yet.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart
                data={topTotals.map((r) => ({ country: r.country, total: r.total }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="country" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card
        title="Daily active users by country (90 days)"
        description="Rolling 24-hour visits per country, kept for the last 90 days. Top 6 countries shown."
        defaultOpen
      >
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : dailySeries.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No daily activity yet.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={dailySeries.data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                {dailySeries.countries.map((c, i) => (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stroke={palette[i % palette.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {data && data.totals.length > 0 && (
        <Card
          title="All countries — totals"
          description="Full lifetime totals table."
          className="lg:col-span-2"
          collapsible
          defaultOpen={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4">Lifetime total</th>
                  <th className="py-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data.totals.map((r) => (
                  <tr key={r.country} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono">{r.country}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.total.toLocaleString()}</td>
                    <td className="py-2 text-muted-foreground">
                      {r.lastSeen ? new Date(r.lastSeen).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CommentatorGroupRow({
  group,
  isHidden,
  isDragging,
  onToggleHidden,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSave,
  onBlockToggle,
  onPrimary,
  onHide,
  onDelete,
  onPortraitUpload,
  onPortraitRemove,
  onDeleteGlobal,
  isSaving,
  isUploadingPortrait,
  tFn,
  extraCategories,
  onAddCategory,
}: {
  group: { name_key: string; variants: Array<{ display_name: string; override?: CommentatorOverrideRow; blocked: boolean; count: number }> };
  isHidden: boolean;
  isDragging: boolean;
  onToggleHidden: () => void;
  onDragStart: () => void;
  onDragOver: (e: ReactDragEvent<HTMLLIElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onSave: (display_name: string, meta: EditableMeta, is_manual: boolean) => void;
  onBlockToggle: (name: string, blocked: boolean) => void;
  onPrimary: (id: string) => void;
  onHide: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
  onPortraitUpload: (display_name: string, data_url: string) => void;
  onPortraitRemove: (id: string) => void;
  onDeleteGlobal: (id: string, display_name: string) => void;
  isSaving: boolean;
  isUploadingPortrait: boolean;
  tFn: (k: string) => string;
  extraCategories: Record<string, CommentatorCategoryRow[]>;
  onAddCategory: (category_type: string, value: string) => void;
}) {
  const isDuplicate = group.variants.length > 1;
  return (
    <li
      className={`py-3 ${isDragging ? "opacity-50" : ""} ${isHidden ? "bg-muted/20" : ""}`}
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          aria-label="Drag to reorder"
          title="Drag to reorder (admin view only)"
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleHidden}
          aria-label={isHidden ? "Show in admin view" : "Hide from admin view"}
          title={isHidden ? "Hidden from your view — click to show" : "Hide from your view"}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {isDuplicate && (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tFn("admin.commentators.duplicates.title")}
          </span>
        )}
        {isHidden && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Hidden (admin view)
          </span>
        )}
      </div>
      <div className="space-y-3">
        {group.variants.map((v) => (
          <VariantEditor
            key={v.display_name}
            variant={v}
            isDuplicate={isDuplicate}
            onSave={(meta) => onSave(v.display_name, meta, v.override?.is_manual ?? false)}
            onBlockToggle={(blocked) => onBlockToggle(v.display_name, blocked)}
            onPrimary={() => v.override && onPrimary(v.override.id)}
            onHide={(hidden) => v.override && onHide(v.override.id, hidden)}
            onDelete={() => v.override && onDelete(v.override.id)}
            onPortraitUpload={(data_url) => onPortraitUpload(v.display_name, data_url)}
            onPortraitRemove={() => v.override && onPortraitRemove(v.override.id)}
            onDeleteGlobal={() => v.override && onDeleteGlobal(v.override.id, v.display_name)}
            isSaving={isSaving}
            isUploadingPortrait={isUploadingPortrait}
            tFn={tFn}
            extraCategories={extraCategories}
            onAddCategory={onAddCategory}
          />
        ))}
      </div>
    </li>
  );
}

function VariantEditor({
  variant,
  isDuplicate,
  onSave,
  onBlockToggle,
  onPrimary,
  onHide,
  onDelete,
  onPortraitUpload,
  onPortraitRemove,
  onDeleteGlobal,
  isSaving,
  isUploadingPortrait,
  tFn,
  extraCategories,
  onAddCategory,
}: {
  variant: { display_name: string; override?: CommentatorOverrideRow; blocked: boolean; count: number };
  isDuplicate: boolean;
  onSave: (meta: EditableMeta) => void;
  onBlockToggle: (blocked: boolean) => void;
  onPrimary: () => void;
  onHide: (hidden: boolean) => void;
  onDelete: () => void;
  onPortraitUpload: (data_url: string) => void;
  onPortraitRemove: () => void;
  onDeleteGlobal: () => void;
  isSaving: boolean;
  isUploadingPortrait: boolean;
  tFn: (k: string) => string;
  extraCategories: Record<string, CommentatorCategoryRow[]>;
  onAddCategory: (category_type: string, value: string) => void;
}) {
  const initial: EditableMeta = useMemo(
    () => ({
      region: variant.override?.region ?? "",
      denomination: variant.override?.denomination ?? "",
      country: variant.override?.country ?? "",
      tradition: variant.override?.tradition ?? "",
      worldview: variant.override?.worldview ?? "",
      gender: variant.override?.gender ?? "",
      publication_era: variant.override?.publication_era ?? "",
      birth_year: variant.override?.birth_year != null ? String(variant.override.birth_year) : "",
      death_year: variant.override?.death_year != null ? String(variant.override.death_year) : "",
    }),
    [variant.override?.id],
  );
  const [meta, setMeta] = useState<EditableMeta>(initial);
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isPrimary = variant.override?.is_primary ?? false;
  const isHidden = variant.override?.is_hidden ?? false;
  const portraitUrl = variant.override?.portrait_url ?? null;

  const handleFile = (file: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error(tFn("admin.commentators.portrait.invalidType"));
      return;
    }
    if (file.size > 1_800_000) {
      toast.error(tFn("admin.commentators.portrait.tooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) {
        toast.error(tFn("admin.commentators.portrait.invalidType"));
        return;
      }
      onPortraitUpload(result);
    };
    reader.onerror = () => toast.error(tFn("admin.commentators.portrait.readFailed"));
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "relative shrink-0 overflow-hidden rounded-full border-2 transition",
              dragOver ? "border-primary" : "border-border",
            )}
            style={{ width: 56, height: 56 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label={tFn("admin.commentators.portrait.upload")}
            title={tFn("admin.commentators.portrait.upload")}
          >
            <img
              src={portraitUrl || AUTHOR_FALLBACK_THUMB}
              alt={variant.display_name}
              className="h-full w-full cursor-pointer object-cover"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{variant.display_name}</p>
              <span
                title={`Displayed in ${variant.count} verse lookups`}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground"
              >
                {variant.count.toLocaleString()}×
              </span>
              {variant.override?.is_manual && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                  {tFn("admin.commentators.add.manualBadge")}
                </span>
              )}
              {portraitUrl && (
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {tFn("admin.commentators.portrait.badge")}
                </span>
              )}
              {isDuplicate && isPrimary && (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
                  {tFn("admin.commentators.duplicates.primary")}
                </span>
              )}
              {isDuplicate && !isPrimary && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {tFn("admin.commentators.duplicates.secondary")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {variant.blocked
                ? tFn("admin.commentators.blocked")
                : isHidden
                  ? tFn("admin.commentators.duplicates.hidden")
                  : tFn("admin.commentators.allowed")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPortrait}
                className="h-7 text-xs"
              >
                {portraitUrl
                  ? tFn("admin.commentators.portrait.replace")
                  : tFn("admin.commentators.portrait.upload")}
              </Button>
              {portraitUrl && variant.override && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onPortraitRemove}
                  className="h-7 text-xs text-destructive"
                >
                  {tFn("admin.commentators.portrait.remove")}
                </Button>
              )}
            </div>
            <MetaInlineChips override={variant.override} tFn={tFn} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDuplicate && variant.override && !isPrimary && (
            <Button size="sm" variant="outline" onClick={onPrimary}>
              {tFn("admin.commentators.duplicates.makePrimary")}
            </Button>
          )}
          {isDuplicate && variant.override && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onHide(!isHidden)}
            >
              {isHidden
                ? tFn("admin.commentators.duplicates.show")
                : tFn("admin.commentators.duplicates.hide")}
            </Button>
          )}
          <Switch
            checked={!variant.blocked}
            onCheckedChange={(checked) => onBlockToggle(!checked)}
            aria-label={
              variant.blocked
                ? `${tFn("admin.commentators.allow")} ${variant.display_name}`
                : `${tFn("admin.commentators.block")} ${variant.display_name}`
            }
          />
          <Button size="sm" variant="ghost" onClick={() => setExpanded((x) => !x)}>
            {expanded ? tFn("admin.commentators.edit.collapse") : tFn("admin.commentators.edit.expand")}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaEditor
            value={meta}
            onChange={setMeta}
            tFn={tFn}
            fallback={staticFallbackMeta(variant.display_name)}
            extraCategories={extraCategories}
            onAddCategory={onAddCategory}
          />
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {variant.override && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  className="text-destructive"
                >
                  {tFn("admin.commentators.edit.deleteOverride")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={onDeleteGlobal}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                aria-label={tFn("admin.commentators.delete.button")}
              >
                {tFn("admin.commentators.delete.button")}
              </Button>
            </div>
            <Button size="sm" onClick={() => onSave(meta)} disabled={isSaving}>
              {tFn("admin.commentators.edit.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaEditor({
  value,
  onChange,
  tFn,
  fallback,
  extraCategories,
  onAddCategory,
}: {
  value: EditableMeta;
  onChange: (next: EditableMeta) => void;
  tFn: (k: string) => string;
  fallback: Partial<EditableMeta>;
  extraCategories: Record<string, CommentatorCategoryRow[]>;
  onAddCategory: (category_type: string, value: string) => void;
}) {
  // A controlled-dropdown helper that:
  //  - falls back to the system's current static value when no override is set
  //  - merges built-in options with admin-added category extensions
  //  - exposes an "Add new category…" sentinel that prompts the admin
  const renderSelect = (opts: {
    categoryType: string;
    field: keyof EditableMeta;
    labelKey: string;
    placeholderKey: string;
    builtIns: { value: string; label: string }[];
    fullWidth?: boolean;
  }) => {
    const current = (value[opts.field] || fallback[opts.field] || "") as string;
    const extras = extraCategories[opts.categoryType] ?? [];
    const knownValues = new Set([
      ...opts.builtIns.map((b) => b.value),
      ...extras.map((e) => e.value),
    ]);
    const unknownCurrent = current && !knownValues.has(current) ? current : null;
    return (
      <div className={opts.fullWidth ? "sm:col-span-2" : undefined}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {tFn(opts.labelKey)}
        </label>
        <Select
          value={current || "__none__"}
          onValueChange={(v) => {
            if (v === "__add__") {
              const entered = window.prompt(tFn("admin.commentators.edit.addCategoryPrompt"));
              const cleaned = entered?.trim();
              if (cleaned) {
                onAddCategory(opts.categoryType, cleaned);
                onChange({ ...value, [opts.field]: cleaned } as EditableMeta);
              }
              return;
            }
            onChange({ ...value, [opts.field]: v === "__none__" ? "" : v } as EditableMeta);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={tFn(opts.placeholderKey)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{tFn("admin.commentators.edit.none")}</SelectItem>
            {opts.builtIns.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
            {extras.map((e) => (
              <SelectItem key={e.id} value={e.value}>
                {e.label ?? e.value}
              </SelectItem>
            ))}
            {unknownCurrent && (
              <SelectItem key={`__cur_${unknownCurrent}`} value={unknownCurrent}>
                {unknownCurrent}
              </SelectItem>
            )}
            <SelectItem value="__add__">
              {tFn("admin.commentators.edit.addCategory")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <>
      {renderSelect({
        categoryType: "region",
        field: "region",
        labelKey: "admin.commentators.edit.region",
        placeholderKey: "admin.commentators.edit.regionPlaceholder",
        builtIns: REGION_KEYS_ADMIN.map((r) => ({ value: r, label: tFn(`regions.${r}`) })),
      })}
      {renderSelect({
        categoryType: "denomination",
        field: "denomination",
        labelKey: "admin.commentators.edit.denomination",
        placeholderKey: "admin.commentators.edit.denominationPlaceholder",
        builtIns: DENOMINATION_KEYS.map((d) => ({ value: d, label: tFn(`denominations.${d}`) })),
      })}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {tFn("admin.commentators.edit.country")}
        </label>
        <Input
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value })}
          placeholder={fallback.country || tFn("admin.commentators.edit.countryPlaceholder")}
        />
      </div>
      {renderSelect({
        categoryType: "tradition",
        field: "tradition",
        labelKey: "admin.commentators.edit.tradition",
        placeholderKey: "admin.commentators.edit.traditionPlaceholder",
        builtIns: TRADITION_KEYS_ADMIN.map((tk) => ({ value: tk, label: tFn(`traditions.${tk}`) })),
      })}
      {renderSelect({
        categoryType: "worldview",
        field: "worldview",
        labelKey: "admin.commentators.edit.worldview",
        placeholderKey: "admin.commentators.edit.worldviewPlaceholder",
        builtIns: WORLDVIEW_KEYS_ADMIN.map((wk) => ({
          value: wk,
          label: tFn(WORLDVIEW_LABEL_KEYS[wk]),
        })),
        fullWidth: true,
      })}
      {renderSelect({
        categoryType: "gender",
        field: "gender",
        labelKey: "admin.commentators.edit.gender",
        placeholderKey: "admin.commentators.edit.genderPlaceholder",
        builtIns: GENDER_KEYS.map((g) => ({
          value: g,
          label: tFn(`admin.commentators.edit.gender_${g}`),
        })),
      })}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {tFn("admin.commentators.edit.publicationEra")}
        </label>
        <Input
          value={value.publication_era}
          onChange={(e) => onChange({ ...value, publication_era: e.target.value })}
          placeholder={fallback.publication_era || tFn("admin.commentators.edit.publicationEraPlaceholder")}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {tFn("admin.commentators.edit.birthYear")}
        </label>
        <Input
          type="number"
          inputMode="numeric"
          value={value.birth_year}
          onChange={(e) => onChange({ ...value, birth_year: e.target.value })}
          placeholder={fallback.birth_year || ""}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {tFn("admin.commentators.edit.deathYear")}
        </label>
        <Input
          type="number"
          inputMode="numeric"
          value={value.death_year}
          onChange={(e) => onChange({ ...value, death_year: e.target.value })}
          placeholder={fallback.death_year || ""}
        />
      </div>
    </>
  );
}

function MetaInlineChips({
  override,
  tFn,
}: {
  override?: CommentatorOverrideRow;
  tFn: (k: string, vars?: Record<string, string | number>) => string;
}) {
  if (!override) return null;
  const chips: { labelKey: string; value: string }[] = [];
  if (override.region) {
    const k = override.region;
    const known = (REGION_KEYS_ADMIN as readonly string[]).includes(k);
    chips.push({
      labelKey: "admin.commentators.edit.region",
      value: known ? tFn(`regions.${k}`) : k,
    });
  }
  if (override.denomination) {
    const k = override.denomination;
    const known = (DENOMINATION_KEYS as readonly string[]).includes(k);
    chips.push({
      labelKey: "admin.commentators.edit.denomination",
      value: known ? tFn(`denominations.${k}`) : k,
    });
  }
  if (override.country) {
    chips.push({ labelKey: "admin.commentators.edit.country", value: override.country });
  }
  if (override.tradition) {
    const k = override.tradition;
    const known = (TRADITION_KEYS_ADMIN as readonly string[]).includes(k);
    chips.push({
      labelKey: "admin.commentators.edit.tradition",
      value: known ? tFn(`traditions.${k}`) : k,
    });
  }
  if (override.worldview) {
    const k = override.worldview as WorldviewKeyAdmin;
    const known = (WORLDVIEW_KEYS_ADMIN as readonly string[]).includes(k);
    chips.push({
      labelKey: "admin.commentators.edit.worldview",
      value: known ? tFn(WORLDVIEW_LABEL_KEYS[k]) : String(override.worldview),
    });
  }
  if (chips.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          <span className="font-medium text-foreground/70">{tFn(c.labelKey)}:</span>
          <span>{c.value}</span>
        </span>
      ))}
    </div>
  );
}

function AuditCard() {
  const qc = useQueryClient();
  const logQuery = useQuery({
    queryKey: ["commentator-audit-log"],
    queryFn: () => listCommentatorAuditLog(),
    staleTime: 30_000,
  });
  const runAudit = useServerFn(runCommentatorAudit);
  const runMutation = useMutation({
    mutationFn: () => runAudit(),
    onSuccess: (row: CommentatorAuditLogRow) => {
      toast.success(
        `Audit complete — ${row.duplicates_merged} duplicate(s) merged, ${row.orphaned_removed} orphan(s) removed, ${row.missing_portraits} portrait(s) missing.`,
      );
      qc.invalidateQueries({ queryKey: ["commentator-audit-log"] });
      qc.invalidateQueries({ queryKey: ["commentator-overrides"] });
      qc.invalidateQueries({ queryKey: ["selectable-commentators"] });
      qc.invalidateQueries({ queryKey: ["seen-commentators"] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Audit failed"),
  });
  const log = logQuery.data ?? [];
  const latest = log[0];
  const hasIssues =
    !!latest && (latest.missing_portraits > 0 || latest.manual_issues.length > 0);

  return (
    <Card title="Commentator Audit" defaultOpen>
      <p className="mb-3 text-xs text-muted-foreground">
        Runs daily by background job and on demand. Safe issues (duplicates, tombstoned
        orphans) are auto-fixed. Items needing your judgement are listed below.
      </p>
      <div className="mb-4 flex items-center gap-3">
        <Button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          size="sm"
        >
          {runMutation.isPending ? "Running…" : "Run Audit Now"}
        </Button>
        {latest && (
          <span className="text-xs text-muted-foreground">
            Last run {new Date(latest.ran_at).toLocaleString()} · {latest.source}
          </span>
        )}
      </div>

      {latest ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <AuditStat label="Duplicates found" value={latest.duplicates_found} />
            <AuditStat label="Duplicates merged" value={latest.duplicates_merged} tone="green" />
            <AuditStat label="Orphans removed" value={latest.orphaned_removed} tone="green" />
            <AuditStat
              label="Missing portraits"
              value={latest.missing_portraits}
              tone={latest.missing_portraits > 0 ? "yellow" : undefined}
            />
          </div>

          {hasIssues ? (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
              <p className="mb-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Needs review ({latest.manual_issues.length})
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {latest.manual_issues.slice(0, 30).map((iss) => (
                  <li key={`${iss.type}-${iss.name_key}`} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
                      {iss.type.replace(/_/g, " ")}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{iss.display_name}</span>{" "}
                      <span className="text-muted-foreground">— {iss.recommendation}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">All clear — no manual issues.</p>
          )}

          {log.length > 1 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                History ({log.length} runs)
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {log.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1"
                  >
                    <span>{new Date(r.ran_at).toLocaleString()}</span>
                    <span className="text-muted-foreground">
                      {r.source} · merged {r.duplicates_merged} · orphans {r.orphaned_removed}
                      {r.missing_portraits > 0 ? ` · ${r.missing_portraits} missing portraits` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No audits recorded yet. Click <strong>Run Audit Now</strong> to record the first
          one.
        </p>
      )}
    </Card>
  );
}

function AuditStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "yellow"
        ? "text-yellow-700 dark:text-yellow-400"
        : "text-foreground";
  return (
    <div className="rounded border border-border bg-muted/30 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function SignInActivityPanel() {
  const listAuthEventsFn = useServerFn(listAuthEvents);
  const [eventType, setEventType] = useState<"all" | "signup" | "signin">("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const query = useQuery({
    queryKey: ["admin", "auth-events", eventType, from, to],
    queryFn: () =>
      listAuthEventsFn({
        data: {
          eventType,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
          limit: 200,
        },
      }),
    refetchInterval: 30_000,
  });

  const data = query.data;
  const events: AuthEventRow[] = data?.events ?? [];

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sign-ups today" value={data?.todaySignups ?? 0} />
        <Stat label="Sign-ins today" value={data?.todaySignins ?? 0} />
        <Stat label="Showing" value={events.length} />
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <Card title="Sign-In Activity" description="Recent sign-up and sign-in events. Auto-refreshes every 30 seconds.">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Event type</label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as typeof eventType)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="signup">Sign-up</SelectItem>
                <SelectItem value="signin">Sign-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          {(from || to || eventType !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setEventType("all"); setFrom(""); setTo(""); }}>
              Clear
            </Button>
          )}
        </div>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{e.email ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        e.event_type === "signup"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}>
                        {e.event_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{e.method}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </section>
  );
}



