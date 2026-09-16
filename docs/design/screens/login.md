# Login Screen

Route:

`/login`

---

# Stitch References

Project:

`17869850438131362006`

Light:

`ad6a28ac33ca4732a6908f433af99ea6`

Dark:

`3b5245c7361745eaad2b27231cd18e6a`

(Corrected during Phase 2 mapping — doc previously had a one-character typo, `44eaad` instead of `45eaad`; verified against the live Stitch project via `list_screens`/`get_screen`.)

No competing candidates found for this route — single unambiguous Light/Dark pair. Hard Gate 2 not triggered.

---

# Existing Implementation

Primary file:

`app/(auth)/login/page.tsx`

Related presentation:

- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `app/globals.css`
- `tailwind.config.ts`
- `public/login-logo.png` (existing brand mark, reused)

---

# Discovery (Phase 2)

- **State**: `email`, `password`, `error`, `loading`, `showPassword` — all local `useState`, no external state.
- **Handlers**: `handleSubmit` (form submit), password-visibility toggle button.
- **API calls**: `signIn("credentials", { email, password, redirect: false })` via `next-auth/react` — protected, see below.
- **Navigation**: on success, `router.push("/")` then `router.refresh()`.
- **Validation**: native HTML5 `required` on both fields; no client-side format validation beyond that.
- **Loading state**: submit button disabled + spinner (`Loader2`) + "Signing in…" label while `loading` is true.
- **Error state**: `result?.error` → static message "Invalid email or password." rendered in `text-destructive` below the password field.
- **Theming**: current markup uses hardcoded Tailwind classes (`bg-gray-50`, `bg-white`) rather than semantic tokens (`bg-background`, `bg-card`) — confirmed via Playwright that toggling the `.dark` class currently has **no visual effect**. This is the primary presentation gap Phase 2 implementation will fix.
- **No theme toggle** currently exists on this page (Stitch reference has one).
- **Auth capability check** (`lib/auth.ts`, read-only inspection): only `CredentialsProvider` is configured — **no Google/Okta SSO provider exists**. The Stitch reference design includes SSO buttons; per the "no invented functionality" rule, these will **not** be implemented as functional buttons since there's no corresponding backend capability. To be re-confirmed/flagged in the Phase 8 Stitch comparison as an intentional, documented gap.

---

# Protected Authentication Behavior

Do not change:

```text
signIn("credentials", {
    email,
    password,
    redirect: false
})
```

---

# Part B — Functional Expansion (2026-09-15)

Per the approved Part B plan, built the previously-omitted Stitch elements for this screen:

- **"Remember this device for 30 days" checkbox** — real, controlled checkbox (`rememberDevice` local state), but deliberately **not** wired into `signIn(...)` or any session-length logic. A real implementation would mean a longer NextAuth session, which requires editing the protected `lib/auth.ts` session config — per Part B Hard Gate 7, protected files stay untouched, so this stays a visual-only toggle.
- **"Forgot password?" link** — new, opens the shared stub toast ("Functionality in progress"). No password-reset flow exists (`lib/auth.ts` only has `CredentialsProvider`, no reset-token/email capability) — same protected-file reasoning as above.
- **SSO buttons (Google, Okta SSO)** — new, styled per Stitch (inline Google "G" SVG + `KeyRound` icon for Okta, 2-column grid, "OR AUTHENTICATE VIA SSO" divider). Both open the stub toast instead of a real OAuth flow — no NextAuth provider exists for either, and creating one needs a real registered OAuth app (client ID/secret) only the user can provide. Per user decision: build the real UI, stub the click.
- **Trust line (superseded — see Part E below)**: originally kept generic copy instead of Stitch's literal SOC2/SAML badges. Part E built them per the user's explicit later instruction.
- **New shared component**: `components/functionality-stub.tsx` (`useFunctionalityStub` hook + `<FunctionalityStubToast>`) — a lightweight, dependency-free toast (no new npm package), auto-dismisses after 3.5s. Reused wherever a Stitch element is real-visually but not really wired (this screen's 3 stub touchpoints; Weekly Reports' AI Executive Summary next).
- **Not built (superseded — see Part E below)**: originally the top marketing bar (status pill, Enterprise Docs link, language dropdown) was out of scope. Part E built all of it.
- Verified: the real `signIn("credentials", {email, password, redirect: false})` call is byte-for-byte unchanged (confirmed via code diff and a live sign-in through the actual UI, which correctly reached the authenticated dashboard). `rememberDevice` state exists but is never read by `handleSubmit`.
- tsc/lint/build clean, 0 console errors across desktop/mobile × Light/Dark. Stub toast functionally confirmed via accessibility-tree snapshot immediately after each click (`status` role, "Functionality in progress" text, dismiss button) — screenshot capture couldn't reliably catch the 3.5s-lived toast due to Playwright MCP round-trip latency, so verification relied on the snapshot instead of a screenshot for that specific interaction.

---

# Part E — Pixel-fidelity redesign (exact Stitch match, 2026-09-16)

The user shared the actual Stitch Light/Dark screenshots directly (same situation as Daily Reports' Part D — Stitch MCP was disconnected). The real mock turned out to include a full top marketing bar and a data-rich "Organic Reach Tracker" card that Part B had deliberately left out as fabricated-content risk. Per explicit instruction ("make it as Stitch... fake data is fine, like 10 or 12 presets, rotate on every login, make it real once the things are fully functional"), this pass built the exact visual, with a rotating pool of placeholder values instead of one fixed fake number.

**This page has its own header** (not the dashboard's shared sidebar/topbar — Login is a standalone auth page), so the new top bar here doesn't touch or duplicate anything from the dashboard shell.

### Known Placeholders — build real post-deployment

| Element | What real implementation needs |
|---|---|
| "Organic Reach Tracker" card (Indexed Pages, Top 3 Rank, Health Score, "+N% this mo" delta, requests/sec, progress bar) | A real crawler/rank-tracking/health-scoring integration — none of these concepts exist anywhere in the schema today. Ships as a pool of 12 presets (`lib/login-fake-stats.ts`), one picked at random on every page load ("rotate on every login," literally — confirmed via 3 separate reloads showing 3 different values live) |
| "All Systems Operational" status pill | Real uptime/system-health monitoring — doesn't exist. Static text, not rotated (a status claim shouldn't flicker between "operational" and something alarming) |
| "SOC2 Type II Certified" / "SAML & SSO Ready" badges | Actual compliance certification — the app holds neither. Static claims, flagged via a hover tooltip |
| "Enterprise Docs" link, language selector ("EN"), "Privacy Policy" / "Terms of Service" / "Security Whitepaper" footer links | No docs site, no i18n, no policy pages exist. All wired to the shared stub toast (same pattern as Forgot Password/SSO) instead of dead links |
| "v1.0.0 Enterprise" badge | "v1.0.0" is real (matches `package.json` / the same version shown in the dashboard sidebar everywhere else); "Enterprise" is a decorative plan-tier label — no real tiering/licensing concept exists |

**Genuinely real** (not fabricated): the app logo/wordmark (now also repeated inside the login card, matching Stitch), the theme toggle (extended with an optional `showLabel` prop on the shared `ThemeToggle` component — backward-compatible, dashboard topbar usage unchanged), the footer copyright year (kept dynamic/real instead of copying Stitch's hardcoded mock year), and — most importantly — the `signIn("credentials", ...)` call, confirmed byte-for-byte unchanged and re-verified via an actual live sign-in that correctly reached the dashboard.

**Also fixed**: the marketing panel (left side) was previously hidden in Dark mode (`dark:lg:hidden`, collapsing to a single centered column) — but Stitch's dark mock clearly shows the same split-screen layout as light mode. Removed the dark-mode-only hide; both themes now show the same two-panel layout at desktop widths, matching Stitch exactly.

### Files touched
- Rewritten (not protected): `app/(auth)/login/page.tsx`
- New: `lib/login-fake-stats.ts` (rotating preset pool)
- Extended (not protected, additive `showLabel` prop only): `components/theme-toggle.tsx`

Verified live: tsc/lint/build clean, protected-file guard clean, `signIn` call unchanged, a real sign-in completed successfully end-to-end, rotation confirmed across 3 reloads (different stat values each time), stub toast confirmed showing correct custom message, 0 console errors across desktop/tablet/mobile × Light/Dark.