# Execution Logs Screen

Route:

`/logs`

---

# Stitch References

Project: `17869850438131362006`

Light: `7ff704ec71ae4fef95a5137000cbe51d` ("SEO TeamDesk - Execution Logs (Light Mode)")

Dark: `8677663946f24a2298e9d5d239668e8e` ("SEO TeamDesk - Execution Logs (Dark Mode)")

Single unambiguous Light/Dark pair — Hard Gate 2 not triggered.

**Scope note**: the Stitch mock depicts a 4th "Avg Duration" stat card, a script-name search box, a "Payload/Summary" table column, and per-row "Re-run" buttons — none of these exist in the real implementation (stats object only has total/success/error; no duration aggregation, no search, no re-run trigger, no payload summary). Per "No invented functionality", none were built. Stitch was used for stat-card/filter-bar/table visual language only.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/logs/page.tsx` (server component — heavy role/team/date/runType filtering, pagination, stale-"running"-log auto-repair)
- `app/(dashboard)/logs/logs-client.tsx` (period presets, team/member dropdowns, stat cards, paginated table, Output dialog)

Related presentation: `components/ui/{button,badge,dialog}.tsx`

---

# Discovery (Phase 15)

- **Role-based scope**: super-admin sees everyone (+ team filter + user filter + run-type filter including "Automated"); sub-lead sees their group; plain "admin" sees only their own runs, no filters shown at all.
- **Stale-run repair**: on every page load, any `status: "running"` log older than 10 minutes is auto-marked `error` — a genuine background-consistency mechanism, untouched.
- **Filters**: date-range presets (Today/Yesterday/Last 7 Days/This Month/Custom) + team/member dropdowns + run-type toggle (All/Manual/Automated, super-admin only) — all drive URL search params, server-side filtered + paginated (`PAGE_SIZE=15`).
- **Stats**: 3 cards (Total/Successful/Failed) computed server-side via `countDocuments`, not client-computed.
- **Table**: Script (+ website name if automated), Member (avatar + name, or an "Automated" pill with no member), Status badge, Time, Duration, Output (opens a dialog with the full script output/terminal log).
- **Already largely on the design system**: this screen already used semantic tokens (`bg-card`, `text-muted-foreground`, `border-input`, etc.) extensively — a normalization pass, not a full migration.
- **Pre-existing gaps found and fixed this phase**:
  - Hover-only-reveal "Output" button (`opacity-0 group-hover:opacity-100`) — same accessibility gap as Websites/Backlink Sites/Backlinks/Weekly Reports — now always-visible.
  - Stat-card icon badges hardcoded `blue-50/blue-600`, `green-50/green-600`, `red-50/red-500` (each with a separate `dark:bg-*-950` override) → normalized to the app-wide opacity-based `primary`/`emerald`/`rose` pattern (single class works in both themes, no separate dark override needed).
  - "Automated" pill hardcoded `violet-50/violet-200/violet-600` (no dark-mode variant) → kept violet (a genuinely distinct status, same reasoning as Daily Reports' "Public Holiday" purple) but added opacity-based `dark:text-violet-400` pairing.
  - Output dialog had no `DialogDescription` — added via `asChild` (wrapping the existing status-badge/member/time/duration meta row) rather than a plain sentence, since the existing content is rich (badges + spans), not just text — same pattern as prior phases that deduped existing explanatory content into the description slot.
  - **Real bug**: the table wrapper used `overflow-hidden` instead of `overflow-x-auto`, silently clipping the Duration/Output columns on mobile — identical to the bug found on Websites (Phase 4) and Indexing Queue (Phase 11). Fixed; confirmed via `scrollWidth`/`clientWidth`/`overflowX` inspection that the table is now horizontally scrollable instead of clipped.
  - **Shared primitive fix**: `components/ui/badge.tsx`'s `success`/`warning` variants (`Badge variant="warning"` renders the "Running" status here) had zero dark-mode contrast (`bg-emerald-100 text-emerald-800`, `bg-yellow-100 text-yellow-800`) — normalized to the same opacity-based emerald/amber pattern used everywhere else. This also improves Users and Settings (Phases 16–17), which already consume these variants.
  - Output terminal panel's `bg-gray-950`/`text-gray-200`/`text-red-400`/`text-yellow-400`/`text-green-400`/`text-gray-300` colors were **deliberately left unchanged** — this is the same intentional, already-verified "console" palette established in `components/terminal-output.tsx` during Phase 5, not a token gap.
- **Real API calls**: none directly from `logs-client.tsx` beyond navigation (all data comes from server-rendered props); `/api/logs/download` and `/api/logs/export` exist but are not wired into this client component (out of scope, not touched).

---

# Repo hygiene note (found during this phase, not a redesign change)

`.gitignore` had a bare `logs/` rule (intended for log-file output directories) that was also unintentionally matching the app route folder `app/(dashboard)/logs/`, since a pattern with no leading slash matches a directory of that name at any depth. This meant `page.tsx` and `logs-client.tsx` were **never tracked by git**, invisible to `git status`/`git diff` — including the protected-file guard used throughout this whole redesign process. Fixed by scoping the rule to the repo root (`/logs/`, `/log/`) per explicit user approval. Confirmed the route is now visible to git and the protected-file guard runs correctly against it.
