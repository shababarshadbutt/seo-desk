"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Loader2, Eye, EyeOff, ShieldCheck, TrendingUp, Globe, KeyRound, Mail, Lock,
  ArrowRight, BookOpen, ChevronDown, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useFunctionalityStub, FunctionalityStubToast } from "@/components/functionality-stub";
import { randomLoginFakeStats, type LoginFakeStats } from "@/lib/login-fake-stats";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const stub = useFunctionalityStub();

  // Part E placeholder — rotates to a different preset after mount (see
  // lib/login-fake-stats.ts). Starts at a fixed value so server/client HTML
  // match on first paint (no hydration mismatch), then swaps once.
  const [reachStats, setReachStats] = useState<LoginFakeStats | null>(null);
  useEffect(() => { setReachStats(randomLoginFakeStats()); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar — this page's own header (not the dashboard's shared shell) */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 lg:px-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/login-logo.png" alt="SEO TeamDesk" className="h-8 w-auto object-contain" />
          <span className="hidden sm:inline text-[10px] font-medium tracking-wider text-muted-foreground">
            DATA. INSIGHTS. GROWTH.
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title="Real — matches the app version shown throughout the dashboard">
            v1.0.0 Enterprise
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Placeholder — no real system-status monitoring exists yet">
            <Radio className="h-3 w-3 text-emerald-500" />
            All Systems Operational
          </span>
          <button
            type="button"
            onClick={() => stub.show("Enterprise documentation is coming soon.")}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Enterprise Docs
          </button>
          <button
            type="button"
            onClick={() => stub.show("Additional languages are coming soon.")}
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Globe className="h-3.5 w-3.5" />
            EN
            <ChevronDown className="h-3 w-3" />
          </button>
          <ThemeToggle showLabel />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="grid w-full max-w-6xl items-center gap-16 lg:grid-cols-2">
          {/* Marketing panel — shown in both Light and Dark at desktop widths,
              matching Stitch's split-screen layout in both themes */}
          <div className="hidden flex-col gap-6 lg:flex">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Globe className="h-3.5 w-3.5" />
              Unified SEO Command Center
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Enterprise Search Automation &amp; Telemetry Suite
            </h1>
            <p className="max-w-md text-muted-foreground">
              Continuously monitors SERP fluctuations and coordinates cross-functional
              technical fixes across large-scale web properties.
            </p>

            <div className="max-w-sm rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Organic Reach Tracker
                </div>
                {reachStats && (
                  <span
                    className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    title="Placeholder — no real rank-tracking integration exists yet"
                  >
                    {reachStats.deltaPct} this mo
                  </span>
                )}
              </div>

              {reachStats ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm" title="Placeholder — no real crawler/rank-tracker/health-score system exists yet">
                    <div>
                      <p className="text-xs text-muted-foreground">Indexed Pages</p>
                      <p className="font-semibold">{reachStats.indexedPages}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Top 3 Rank</p>
                      <p className="font-semibold">{reachStats.top3Rank}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Health Score</p>
                      <p className="font-semibold">{reachStats.healthScore}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Real-time crawler telemetry</span>
                      <span>{reachStats.requestsPerSec} requests/sec</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${reachStats.progressPct}%` }} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Real-time crawl telemetry and indexed-page health, updated continuously.
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground" title="Placeholder — these are not verified compliance certifications">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                SOC2 Type II Certified
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                SAML &amp; SSO Ready
              </span>
            </div>
          </div>

          {/* Login card — both themes */}
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/login-logo.png" alt="SEO TeamDesk" className="h-9 w-auto object-contain mb-1" />
              <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
              <p className="text-sm text-muted-foreground">
                Enter your corporate credentials to access your SEO TeamDesk workspace.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Corporate Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => stub.show()}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                  Remember this device for 30 days
                </label>

                {error && (
                  <p className="text-sm text-destructive font-medium">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Signing in…" : "Sign In to Workspace"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground tracking-wide">
                    Or authenticate via SSO
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => stub.show()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <GoogleIcon className="h-4 w-4" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => stub.show()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  Okta SSO
                </button>
              </div>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Protected by 256-bit encryption &amp; Corp SSO. Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} SEO TeamDesk. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => stub.show("The Privacy Policy page is coming soon.")} className="hover:text-foreground">Privacy Policy</button>
          <span>•</span>
          <button type="button" onClick={() => stub.show("The Terms of Service page is coming soon.")} className="hover:text-foreground">Terms of Service</button>
          <span>•</span>
          <button type="button" onClick={() => stub.show("The Security Whitepaper is coming soon.")} className="hover:text-foreground">Security Whitepaper</button>
        </div>
      </footer>

      <FunctionalityStubToast message={stub.message} onDismiss={stub.dismiss} />
    </div>
  );
}
