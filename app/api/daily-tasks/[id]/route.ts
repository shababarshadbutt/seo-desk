import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Group } from "@/lib/mongodb";
import DailyTask from "@/lib/mongodb/models/DailyTask";
import { DAILY_TASK_CATEGORIES } from "@/lib/daily-task-categories";

async function canModify(taskUserId: string, role: string, myId: string): Promise<boolean> {
  if (role === "super-admin") return true;
  if (taskUserId === myId) return true;
  if (role === "sub-lead") {
    const group = await Group.findOne({ leadUserId: myId }).lean();
    if (group) return group.memberUserIds.map((id) => id.toString()).includes(taskUserId);
  }
  return false;
}

// PATCH /api/daily-tasks/[id] — { text?, category?, status? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const existing = await DailyTask.findById(params.id);
  if (!existing) return Response.json({ error: "Not found." }, { status: 404 });

  if (!(await canModify(existing.userId, session.user.role, session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (body.category !== undefined && !DAILY_TASK_CATEGORIES.includes(body.category)) {
    return Response.json({ error: "Invalid category." }, { status: 400 });
  }
  if (body.status !== undefined && !["pending", "in-progress", "done"].includes(body.status)) {
    return Response.json({ error: "Invalid status." }, { status: 400 });
  }

  await DailyTask.updateOne(
    { _id: params.id },
    {
      $set: {
        ...(body.text     !== undefined && { text: body.text.trim() }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.status   !== undefined && { status: body.status }),
      },
    }
  );

  const updated = await DailyTask.findById(params.id).lean();
  if (!updated) return Response.json({ error: "Not found." }, { status: 404 });

  return Response.json({
    id:        updated._id.toString(),
    userId:    updated.userId,
    userName:  updated.userName,
    date:      updated.date.toISOString(),
    text:      updated.text,
    category:  updated.category,
    status:    updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
}

// DELETE /api/daily-tasks/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const existing = await DailyTask.findById(params.id);
  if (!existing) return Response.json({ error: "Not found." }, { status: 404 });

  if (!(await canModify(existing.userId, session.user.role, session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await existing.deleteOne();
  return Response.json({ success: true });
}
