import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ExecutionLog, Group } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// Fixed during Part B: this route previously only checked `role === "admin"`
// to decide whether to scope to the viewer's own logs, which meant
// super-admin AND sub-lead both fell into the "scope to own logs only"
// branch — the opposite of what they see on the Logs list (all / group).
// Now mirrors the same visibility rule as app/(dashboard)/logs/page.tsx,
// including its userId/teamId/runType filters, so the export always matches
// what's currently on screen.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role = session.user.role;
  const myId = session.user.id;

  await connectDB();

  let visibleUserIds: string[] | null = null; // null = all users (super-admin)
  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    visibleUserIds = [myId, ...memberIds];
  } else if (role === "admin") {
    visibleUserIds = [myId];
  }

  const selectedUserId = searchParams.get("userId") ?? "";
  const selectedTeamId = searchParams.get("teamId") ?? "";
  const runType = searchParams.get("runType") ?? "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const filter: Record<string, unknown> = {};

  if (runType === "automated") {
    filter.isAutomated = true;
  } else {
    if (runType === "manual") filter.isAutomated = { $ne: true };
    if (visibleUserIds !== null) {
      if (selectedUserId && visibleUserIds.includes(selectedUserId)) {
        filter.userId = selectedUserId;
      } else {
        filter.userId = { $in: visibleUserIds };
      }
    } else if (selectedTeamId) {
      const group = await Group.findById(selectedTeamId).lean();
      if (group) {
        const memberIds = [group.leadUserId.toString(), ...group.memberUserIds.map((id) => id.toString())];
        filter.userId = { $in: memberIds };
      }
    } else if (selectedUserId) {
      filter.userId = selectedUserId;
    }
  }

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = toDate;
    }
    filter.startedAt = dateFilter;
  }

  const logs = await ExecutionLog.find(filter)
    .sort({ startedAt: -1 })
    .limit(10_000) // safety cap
    .lean();

  // Build CSV — include User/Email columns whenever the export can contain
  // more than one person's runs (super-admin/sub-lead), same logic inverted
  // from the old (buggy) `isAdmin` check this replaced.
  const showUserColumns = role !== "admin";
  const headers = [
    ...(showUserColumns ? ["User", "Email"] : []),
    "Script",
    "Status",
    "Exit Code",
    "Started At",
    "Completed At",
    "Duration (ms)",
  ];

  const rows = logs.map((l) => {
    const userFields = showUserColumns ? [csvEscape(l.userName), csvEscape(l.userEmail)] : [];
    return [
      ...userFields,
      csvEscape(l.scriptName),
      csvEscape(l.status),
      l.exitCode ?? "",
      l.startedAt.toISOString(),
      l.completedAt ? l.completedAt.toISOString() : "",
      l.durationMs ?? "",
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `asap-logs-${new Date().toISOString().split("T")[0]}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
