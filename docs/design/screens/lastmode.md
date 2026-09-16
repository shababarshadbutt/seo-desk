# Lastmod Updater Screen

Route:

`/lastmod-updater`

---

# Stitch References

Project:

`17869850438131362006`

Light:

`0cc429e01cb0403bace787cc0135c4c8` ("SEO TeamDesk - Lastmod Updater (Light Mode)")

Dark:

`1c589c9a01ee4592963ec67f74bc44dd` ("SEO TeamDesk - Lastmod Updater (Dark Mode)")

Single unambiguous Light/Dark pair, confirmed against the full 43-screen project listing. Hard Gate 2 not triggered.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/lastmod-updater/page.tsx`
- `app/(dashboard)/lastmod-updater/lastmod-updater-client.tsx`

Related presentation:

- `components/ui/{button,input,label,dialog}.tsx`, `components/terminal-output.tsx`

Protected (consumed only, never touched): `lib/lastmod/**`, `app/api/lastmod-updater/**`

---

# Discovery (Phase 6)

3-step wizard, single-page (no dialogs-as-steps): **1. Source → 2. Scope → 3. Date & push.**

- **Step 1 — Source**: tab switcher (SFTP / S3 / From URL). SFTP/S3 auto-load a domain list (`GET /api/lastmod-updater/domains?source=`) into a `<select>`; URL tab takes a free-text site URL, domain derived client-side via `new URL()`. "Fetch Files"/"Discover Sitemaps" button → `POST /api/lastmod-updater/fetch-files` or `/from-url`.
- **Step 2 — Scope**: only enabled after files are fetched. Tabs: All Files / Selected Files (checkbox list) / Vertical-wise (pattern-detected groups, lazy-loaded via `POST /api/lastmod-updater/verticals` on first tab-open).
- **Step 3 — Date & push**: date picker (defaults to today), "Update lastmod & push to S3" button → `POST /api/lastmod-updater/run`, **SSE-streamed** output into `TerminalOutput`, same streaming pattern as Scripts.
- **2 dialogs**: missing sitemap-index.xml confirm (offers to create one via `POST /api/lastmod-updater/create-index`), and post-run local-disk-cleanup confirm (`POST /api/lastmod-updater/cleanup`).
- **Error display**: inline banner (`border-destructive/30 bg-destructive/10`) above the wizard, not a toast.

## Business Behavior Snapshot (required — protected `lib/lastmod/**` backs this screen)

- **Inputs**: source tab (sftp/s3/url), domain select or free-text site URL, scope tab (all/selected/vertical), file checkboxes, vertical-template checkboxes, lastmod date.
- **Actions**: switch source tab (resets all downstream state), fetch/discover files, create missing index, switch scope tab (lazy-loads verticals), toggle file/vertical checkboxes, run update (SSE stream), respond to cleanup dialog.
- **API calls**: `GET domains`, `POST fetch-files`, `POST from-url`, `POST create-index`, `POST verticals`, `POST run` (SSE), `POST cleanup`. All under protected `app/api/lastmod-updater/**` — not modified.
- **State machine**: `hasFetched` gates Step 2; `indexMissing` blocks running (must create index first) — `canRun` requires index present + not already running + scope selection satisfied.
- **Loading states**: `loadingDomains`, `fetchingFiles`, `loadingVerticals`, `creatingIndex`, run `status` (idle/running/success/error) — each has a distinct UI treatment (spinner icon, disabled buttons, "Loading…" text).
- **Error handling**: any failed fetch sets a page-level `error` string shown in the inline banner; SSE run errors append an `[ERROR]` line to the terminal and set status to error.
- All of the above must survive the redesign byte-for-byte — only class names change.
