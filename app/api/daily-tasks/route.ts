import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Group } from "@/lib/mongodb";
import DailyTask from "@/lib/mongodb/models/DailyTask";
import { DAILY_TASK_CATEGORIES } from "@/lib/daily-task-categories";

export const dynamic = "force-dynamic";

// GET /api/daily-tasks?date=&userId= — same role-based visibility as /api/daily-reports
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const myId = session.user.id;
  const { searchParams } = new URL(req.url);

  await connectDB();

  const filter: Record<string, unknown> = {};

  if (role === "super-admin") {
    const userId = searchParams.get("userId");
    if (userId) filter.userId = userId;
  } else if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    const memberIds = group ? group.memberUserIds.map((id) => id.toString()) : [];
    const allowedIds = [myId, ...memberIds];
    const userId = searchParams.get("userId");
    filter.userId = userId && allowedIds.includes(userId) ? userId : { $in: allowedIds };
  } else {
    filter.userId = myId;
  }

  const date = searchParams.get("date");
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };
  }

  const tasks = await DailyTask.find(filter).sort({ createdAt: -1 }).lean();

  return Response.json(
    tasks.map((t) => ({
      id:        t._id.toString(),
      userId:    t.userId,
      userName:  t.userName,
      date:      t.date.toISOString(),
      text:      t.text,
      category:  t.category,
      status:    t.status,
      createdAt: t.createdAt.toISOString(),
    }))
  );
}

// POST /api/daily-tasks — { date, text, category }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, text, category } = body;

  if (!date) return Response.json({ error: "Date is required." }, { status: 400 });
  if (!text?.trim()) return Response.json({ error: "Task text cannot be empty." }, { status: 400 });
  if (!DAILY_TASK_CATEGORIES.includes(category)) {
    return Response.json({ error: "Invalid category." }, { status: 400 });
  }

  await connectDB();

  const created = await DailyTask.create({
    userId:   session.user.id,
    userName: session.user.name ?? "",
    date:     new Date(date),
    text:     text.trim(),
    category,
    status:   "pending",
  });

  return Response.json(
    {
      id:        created._id.toString(),
      userId:    created.userId,
      userName:  created.userName,
      date:      created.date.toISOString(),
      text:      created.text,
      category:  created.category,
      status:    created.status,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
