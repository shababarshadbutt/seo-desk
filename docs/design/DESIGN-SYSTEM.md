# Design System (extracted from Stitch, Phase 1)

Concrete values for the categories `DESIGN.md` §5–§17 describe conceptually. Extracted by inspecting the raw HTML of 7 Stitch screens spanning auth, forms, tables, and data-dense views: Login (Light/Dark), Settings (Light/Dark), Websites (Light/Dark), Execution Logs (Light). Project `17869850438131362006`.

## Reconciliation notes (read first)

The Stitch screens do **not** share one internally-consistent token set — each was generated independently and named its own dark-mode colors differently (`midnight.*` on Login, `darkBg/darkSurface/darkCard` on Settings, `dark.bg/dark.card/dark.surface` on Websites). The underlying **hex values are consistent** across all three, so they're reconciled below into one canonical scale rather than copied per-screen. Two screens (Login, Websites-Dark) also experimented with a cyan/teal accent (`#06b6d4`, `#0ea5e9`) instead of the otherwise-universal blue — this appears on only 2 of 7 screens, so it is **not** adopted as a core token; blue stays the single primary. If a later screen's Stitch reference clearly leans on that cyan accent for a specific purpose (e.g. a live/running-state indicator), decide per-screen rather than assuming it's systemic.

## Colors — Light

| Token | Value | Usage |
|---|---|---|
| `background` | `slate-50` (`#f8fafc`) | App/page background |
| `foreground` | `slate-900` (`#0f172a`) | Primary text |
| `muted-foreground` | `slate-600` (`#475569`) | Secondary text |
| `border` | `slate-200` (`#e2e8f0`) | Default borders |
| `card` | `#ffffff` | Card/surface background |
| `input` | `slate-50/70` on `slate-200` border | Input fields |
| `primary` (brand) | `50 #eff6ff · 100 #dbeafe · 200 #bfdbfe · 500 #3b82f6 · 600 #2563eb · 700 #1d4ed8 · 800 #1e40af · 900 #1e3a8a` | `600` is the primary action color; standard Tailwind blue scale |
| `success` | `emerald-500` (`#10b981`) | Positive/success state (seen once, but standard semantic choice) |
| Focus ring | `blue-500` @ 20% opacity + `blue-600` border | All focusable inputs/controls |

## Colors — Dark

Reconciled from 3 divergent naming schemes into one scale (see notes above):

| Token | Value |
|---|---|
| `background` (dark-bg) | `#070b14` |
| `surface` (dark-surface) | `#0b1120` |
| `elevated` / `card` (dark-card) | `#0f172a` |
| `border` (dark-border) | `#1e293b` (alt: `rgba(255,255,255,.07)` on one screen — use the solid value as canonical) |
| `input` (dark-input) | `#131d31` |
| `hover` (dark-hover) | `#17233d` |
| `foreground` | `slate-100` |

Primary/brand blue scale is unchanged in dark mode (same hex values as light).

## Typography

- **Body/UI font**: `Inter` — the only font present on every single screen; canonical.
- **Monospace**: `JetBrains Mono` — used specifically for code/log/terminal content (Execution Logs). Reserve for that context (e.g. Scripts terminal output later), not general UI.
- `Plus Jakarta Sans` appeared once (Websites-Dark, as a "display" font) — not adopted; too inconsistent to treat as systemic.
- No custom font-size/line-height scale was defined in any screen's Tailwind config — screens use Tailwind's default type scale directly (`text-xs` through `text-3xl` etc. as needed per context). No override needed.

## Spacing

No custom spacing scale was defined in any screen — all screens use Tailwind's default spacing scale directly. No override needed.

## Border radius

Ranked by actual usage frequency across all 7 screens:

| Class | Occurrences | Usage |
|---|---|---|
| `rounded-lg` | 222 | Default — buttons, inputs, cards, most containers |
| `rounded-full` | 161 | Pills, avatars, icon buttons, toggles |
| `rounded-md` | 83 | Secondary/smaller elements (tags, small buttons) |
| `rounded-xl` | 66 | Larger cards/panels |
| `rounded-2xl` | 5 | Rare — large feature panels only |

Default primitive radius: `rounded-lg`.

## Shadows

| Class | Occurrences | Usage |
|---|---|---|
| `shadow-sm` | 41 | Default — cards, inputs, buttons |
| `shadow-xs` | 21 | Subtle micro-elevation |
| `shadow-md` | 16 | Dropdowns/popovers |
| `shadow-lg` / `shadow-xl` | 8 | Modals/elevated overlays only |

Custom shadows (`shadow-elevated`, `shadow-subtle-glow`) appeared once on Login only — one-off, not adopted as a shared token.

## Buttons

- Icon button: `p-2 rounded-lg border shadow-sm hover:shadow transition-all` (e.g. theme toggle)
- Secondary/tag button: `px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100/80 hover:bg-slate-200/70 transition-colors`
- Primary action button (inferred from consistent brand-600 usage across screens): `bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm`

## Inputs

`block w-full py-2.5 px-3.5 bg-slate-50/70 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition duration-150`

Checkboxes: `h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0`

## What's still open

- **Cards, PageHeader, AppShell patterns**: not yet broken out into concrete markup specs — to be derived when the first route group (Dashboard Shell / Websites) actually implements them, per Phase 1 §5 of the plan (defer speculative abstraction).
- **DataTable, EmptyState, LoadingState, FormField, ConfirmDialog, SearchInput, FilterBar, charts**: intentionally not specified here — deferred to the route group that first demonstrates real need (see plan Phase 1 §5).
