"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Play,
  ScrollText,
  Users,
  Settings,
  LogOut,
  Crown,
  Link2,
  Database,
  FileText,
  ClipboardList,
  ClipboardCheck,
  ChevronDown,
  Globe,
  BarChart2,
  ListChecks,
  Clock,
  Filter,
  Menu,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { QuickAutomationDialog } from "@/components/quick-automation-dialog";
import packageJson from "@/package.json";

// ─── Nav config ───────────────────────────────────────────────────────────────

type NavBadgeKey = "websites" | "users" | "backlinks" | "indexingQueue";

type NavItem =
  | { kind: "link"; href: string; label: string; icon: React.ElementType; minRole: string; badgeKey?: NavBadgeKey }
  | {
      kind: "group";
      label: string;
      icon: React.ElementType;
      minRole: string;
      basePath: string;
      children: { href: string; label: string }[];
    };

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Platform Overview",
    items: [
      { kind: "link", href: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "admin" },
      { kind: "link", href: "/scripts", label: "Scripts", icon: Play, minRole: "admin" },
      { kind: "link", href: "/lastmod-updater", label: "Lastmod Updater", icon: Clock, minRole: "admin" },
      { kind: "link", href: "/sitemap-cleaner", label: "Sitemap Cleaner", icon: Filter, minRole: "admin" },
      { kind: "link", href: "/websites", label: "Websites", icon: Globe, minRole: "admin", badgeKey: "websites" },
      { kind: "link", href: "/logs", label: "Logs", icon: ScrollText, minRole: "admin" },
    ],
  },
  {
    title: "Enterprise Operations",
    items: [
      { kind: "link", href: "/backlinks", label: "Backlinks", icon: Link2, minRole: "admin", badgeKey: "backlinks" },
      { kind: "link", href: "/backlink-sites", label: "Backlink Sites", icon: Database, minRole: "sub-lead" },
      {
        kind: "group",
        label: "Content Request",
        icon: FileText,
        minRole: "admin",
        basePath: "/content",
        children: [
          { href: "/content?type=landing-request", label: "Landing Pages Request" },
          { href: "/content?type=blog-request", label: "Blogs Request" },
        ],
      },
      {
        kind: "group",
        label: "Content Update",
        icon: FileText,
        minRole: "admin",
        basePath: "/content",
        children: [
          { href: "/content?type=landing-update", label: "Landing Pages Update" },
          { href: "/content?type=blog-publish", label: "Blogs Publish" },
        ],
      },
      { kind: "link", href: "/daily-reports", label: "Daily Reports", icon: ClipboardList, minRole: "admin" },
      { kind: "link", href: "/weekly-reports", label: "Weekly Reports", icon: BarChart2, minRole: "admin" },
      { kind: "link", href: "/audit", label: "Website Audit", icon: ClipboardCheck, minRole: "admin" },
      { kind: "link", href: "/indexing-queue", label: "Indexing Queue", icon: ListChecks, minRole: "super-admin", badgeKey: "indexingQueue" },
      { kind: "link", href: "/users", label: "Users", icon: Users, minRole: "super-admin", badgeKey: "users" },
      { kind: "link", href: "/settings", label: "Settings", icon: Settings, minRole: "super-admin" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleRank(role?: string): number {
  if (role === "super-admin") return 3;
  if (role === "sub-lead") return 2;
  if (role === "admin") return 1;
  return 0;
}

function minRoleRank(minRole: string): number {
  if (minRole === "super-admin") return 3;
  if (minRole === "sub-lead") return 2;
  if (minRole === "admin") return 1;
  return 0;
}

function roleBadgeLabel(role?: string) {
  if (role === "super-admin") return "Admin";
  if (role === "sub-lead") return "Supervisor";
  return "User";
}

function compactCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const myRank = roleRank(role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [counts, setCounts] = useState<Record<NavBadgeKey, number> | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/nav-counts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCounts({ websites: data.websites, users: data.users, backlinks: data.backlinks, indexingQueue: data.indexingQueue });
      })
      .catch(() => {});
  }, [session]);

  const activeType = searchParams.get("type") ?? "";

  // Track which groups are open — auto-open if a child is active
  const allGroups: NavItem[] = navSections.flatMap((s) => s.items);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    allGroups.forEach((item) => {
      if (item.kind === "group") {
        const anyActive = item.children.some((c) => {
          const [childPath, childQuery] = c.href.split("?");
          const childType = new URLSearchParams(childQuery ?? "").get("type") ?? "";
          return pathname === childPath && activeType === childType;
        });
        if (anyActive) init[item.label] = true;
      }
    });
    return init;
  });

  // Auto-open active group, auto-close all others on navigation
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      allGroups.forEach((item) => {
        if (item.kind === "group") {
          const anyActive = item.children.some((c) => {
            const [childPath, childQuery] = c.href.split("?");
            const childType = new URLSearchParams(childQuery ?? "").get("type") ?? "";
            return pathname === childPath && activeType === childType;
          });
          next[item.label] = anyActive;
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeType]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function openDiagnostics() {
    setMobileOpen(false);
    setDiagnosticsOpen(true);
  }

  const navContent = (
    <>
      {/* Brand */}
      <div className="flex flex-col items-center gap-1 px-6 py-5 border-b border-sidebar-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dashboard-logo.png" alt="ASAP" className="h-14 w-auto object-contain" />
        <span className="text-[10px] font-medium tracking-wide text-sidebar-muted-foreground">
          v{packageJson.version}
        </span>
      </div>

      {/* Diagnostics */}
      <div className="px-3 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-1.5 border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/70"
          onClick={openDiagnostics}
        >
          <Zap className="h-3.5 w-3.5" />
          Run Core Diagnostics
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => myRank >= minRoleRank(item.minRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-1">
              <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
                {section.title}
              </p>
              {visibleItems.map((item) => {
                if (item.kind === "link") {
                  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  const badgeValue = item.badgeKey && counts ? counts[item.badgeKey] : null;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {badgeValue != null && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-sidebar-accent text-sidebar-muted-foreground"
                          )}
                        >
                          {compactCount(badgeValue)}
                        </span>
                      )}
                    </Link>
                  );
                }

                // Group item
                const Icon = item.icon;
                const isOpen = !!openGroups[item.label];
                const isAnyChildActive = item.children.some((c) => {
                  const [childPath, childQuery] = c.href.split("?");
                  const childType = new URLSearchParams(childQuery ?? "").get("type") ?? "";
                  return pathname === childPath && activeType === childType;
                });

                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isAnyChildActive
                          ? "text-primary bg-sidebar-accent"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )} />
                    </button>

                    <div className={cn(
                      "grid transition-all duration-200 ease-in-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}>
                      <div className="overflow-hidden">
                        <div className="mt-0.5 ml-4 pl-3 border-l border-sidebar-border space-y-0.5 pb-0.5">
                          {item.children.map((child) => {
                            const [childPath, childQuery] = child.href.split("?");
                            const childType = new URLSearchParams(childQuery ?? "").get("type") ?? "";
                            const isChildActive = pathname === childPath && activeType === childType;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "block rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                  isChildActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-sidebar-border px-4 py-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase">
            {session?.user?.name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground">
              {session?.user?.name}
            </p>
            <div className="flex items-center gap-1">
              {role === "super-admin" && (
                <Crown className="h-3 w-3 text-yellow-400" />
              )}
              <p className="truncate text-xs text-sidebar-muted-foreground">
                {roleBadgeLabel(role)}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Open navigation menu"
            className="fixed left-3 top-3 z-40 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          {navContent}
        </SheetContent>
      </Sheet>

      {/* Desktop */}
      <aside className="hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        {navContent}
      </aside>

      <QuickAutomationDialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen} mode="diagnostics" />
    </>
  );
}
