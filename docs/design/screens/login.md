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
- **Trust line**: kept the existing generic copy ("Protected by corporate SSO-grade security...") rather than adding Stitch's literal "SOC2 Type II Certified" / "SAML & SSO Ready" badges — those read as verifiable compliance claims the app doesn't actually hold, which would recreate the exact fabricated-content problem this whole redesign was built to avoid. Documented here as a deliberate scope narrowing, not an oversight.
- **New shared component**: `components/functionality-stub.tsx` (`useFunctionalityStub` hook + `<FunctionalityStubToast>`) — a lightweight, dependency-free toast (no new npm package), auto-dismisses after 3.5s. Reused wherever a Stitch element is real-visually but not really wired (this screen's 3 stub touchpoints; Weekly Reports' AI Executive Summary next).
- **Not built** (Stitch mock's top marketing bar): "All Systems Operational" status pill, "Enterprise Docs" link, language dropdown — no real system-status monitoring, no docs site, no i18n exists anywhere in the app, and none of these were in the approved Part B matrix (only SSO buttons + trust badges were). Flagging here in case these were expected; they were not in scope.
- Verified: the real `signIn("credentials", {email, password, redirect: false})` call is byte-for-byte unchanged (confirmed via code diff and a live sign-in through the actual UI, which correctly reached the authenticated dashboard). `rememberDevice` state exists but is never read by `handleSubmit`.
- tsc/lint/build clean, 0 console errors across desktop/mobile × Light/Dark. Stub toast functionally confirmed via accessibility-tree snapshot immediately after each click (`status` role, "Functionality in progress" text, dismiss button) — screenshot capture couldn't reliably catch the 3.5s-lived toast due to Playwright MCP round-trip latency, so verification relied on the snapshot instead of a screenshot for that specific interaction.