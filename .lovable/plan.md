# Fixed Lookup Header + Sticky Tab Bar

## Scope
Only `src/routes/index.tsx` (layout) and the 7 locale JSONs (new strings).
No changes to commentary logic, fetching, swipe physics, or tab data flow.

## New components (inline in `src/routes/index.tsx`)

### 1. `FixedLookupHeader`
A `position: fixed; top: 0; inset-x: 0; z-50` bar that mounts only when:
- `mutation.data` exists (a lookup is loaded), AND
- The hero section has scrolled out of view (tracked via an IntersectionObserver on a `heroSentinelRef` placed just below the hero).

It is hidden (translate-y-[-100%] + opacity-0) otherwise so it animates in/out smoothly.

Contents, top-to-bottom inside a `max-w-6xl` container:

a. **Row 1 — Compact picker**
   Re-uses `UnifiedVersePicker` with the existing props. No `leftAccessory` (history is reached via the Explore chips). Wrapper uses tighter vertical padding so the row stays ~56 px tall.

b. **Row 2 — Collapsed verse pill**
   The existing `verseOpen` button extracted into a small pill:
   `{data.verseReference} · {data.translation}` + chevron. Tapping toggles `verseOpen`. When `verseOpen` is true, an absolutely-positioned dropdown panel renders directly beneath the pill (inside the fixed header, `absolute top-full left-0 right-0`) containing `<PassageDisplay text={data.verseText} />` on a card with a backdrop-blur background. The dropdown does NOT push the tab bar or tab content — it overlays.
   The in-flow expanded verse card (currently at lines 1376–1405 of the Results component) is removed; it now lives only inside the fixed header dropdown.

c. **Row 3 — Slim Explore bar**
   A horizontally scrollable row (`no-scrollbar`) of small chip buttons. Three quick links:
   - `home.exploreHistory` → smooth-scrolls to top and opens the history panel (`setHistoryOpen(true)`).
   - `home.exploreVotd` → smooth-scrolls to top (Verse of the Day bar lives at the top of the page).
   - `home.exploreThemes` → smooth-scrolls to top and focuses the `ThemeSearch` input via a new `themeSearchRef` exposed by `ThemeSearch` (or simply scrolls to its container ref, no focus to avoid keyboard pop).
   Chips: `rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-accent`.

### 2. `FixedTabBar`
Rendered directly under `FixedLookupHeader` (also fixed, `top: <header-height>`), only while the header is visible AND the tabs would otherwise be out of view.

Reuses the existing `VIEW_KEYS.map(...)` button list. Visual upgrades vs the in-flow bar:
- Background: `bg-background/95 backdrop-blur` (opaque enough to be the top edge of the swipable area).
- Active tab: `bg-primary text-primary-foreground shadow-sm` (current style is kept; contrast is improved by removing the muted text on the inactive tabs — switch from `text-muted-foreground` to `text-foreground/70 hover:text-foreground`).
- Bottom edge: `border-b border-border shadow-[0_2px_8px_-4px_rgba(0,0,0,0.15)]` so it visibly separates from the swipable area below.
- Visible on mobile too (currently the in-flow tab bar is `hidden lg:flex`); the existing floating dot indicator stays as-is because it provides a different affordance (swipe hint).
- Tapping a tab calls existing `setView(k)` — no logic change.

To prevent layout jump when the fixed header mounts, the `<main>` gets `style={{ paddingTop: headerOffset }}` driven by a `ResizeObserver` on the fixed header (only applied when header is visible).

## Removals / edits in `Results`
- Lines 1376–1405 (in-flow collapsible verse card): deleted; verse is now only the header pill + dropdown.
- The existing `verseOpen` state stays (single source of truth, controls the header dropdown).
- In-flow `VIEW_KEYS` tab bar (lines 1444–1467): kept for `lg:` screens only, as it currently is. No regression.

## i18n additions (all 7 locales)
- `home.exploreHistory` — "History" / "Historial" / etc. (use existing `home.historyTitle` translations where present, else new translation).
- `home.exploreVotd` — "Verse of the Day" (reuse `votd.title` value).
- `home.exploreThemes` — "Themes" (reuse `themes.title` if it exists, else new).
- No other strings change; `home.verseShow` / `home.verseHide` continue to drive the pill aria-label.

## Behavior guarantees
- Swipe physics, tab keys, scroll-up hint, collapse-on-tab-switch, and verse-picker focus rules are untouched.
- Fixed header is **only** visible after the hero leaves the viewport AND a lookup is loaded — landing-page first impression is unchanged.
- Expanded verse appears as an overlay dropdown anchored to the header, not as part of the fixed bar itself. Tab content does not shift.
- All new copy is read via `t(...)` from the locale files.

## Verification
- View the preview at 390×700 (current viewport) before and after a lookup; confirm the header animates in after the hero leaves and pins to the top during a swipe.
- Trigger a horizontal swipe; vertical baseline of all tabs should match (no jump).
- Tap the verse pill; dropdown overlays without shifting tabs. Tap again to close.
- Tap each Explore chip; page scrolls to top and the corresponding panel opens / is focused.
