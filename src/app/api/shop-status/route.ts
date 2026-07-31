import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import mongoose from "mongoose";

const SettingSchema = new mongoose.Schema({}, { strict: false });
const Setting =
  mongoose.models.Setting || mongoose.model("Setting", SettingSchema);

async function requireStaffSession(req: Request) {
  const { verifySession } = await import("@/lib/auth");
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/3s_session=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  try {
    await connectDB();
    const doc = await Setting.findOne({ key: "shopStatus" }).lean();
    return NextResponse.json({
      open: (doc as any)?.open ?? false,
      openedAt: (doc as any)?.openedAt ?? null,
      shiftDate: (doc as any)?.shiftDate ?? null,
      shiftLabel: (doc as any)?.shiftLabel ?? "Shift 1",
      startingCash: (doc as any)?.startingCash ?? null,
      paidIn: (doc as any)?.paidIn ?? [],
      paidOut: (doc as any)?.paidOut ?? [],
    });
  } catch (e) {
    console.error("[shop-status GET]", e);
    return NextResponse.json({
      open: false,
      openedAt: null,
      shiftDate: null,
      startingCash: null,
      paidIn: [],
      paidOut: [],
    });
  }
}

export async function POST(req: Request) {
  try {
    const authError = await requireStaffSession(req);
    if (authError) return authError;

    await connectDB();
    const { open, openedAt, startingCash, shiftLabel } = await req.json();

    const update: Record<string, any> = {
      open: !!open,
      openedAt: openedAt ?? null,
    };

    // Only stamp shiftDate + reset cash tracking when OPENING.
    // daily-close is responsible for clearing after it saves the report.
    if (open) {
      const now = new Date();
      update.shiftDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      update.startingCash = typeof startingCash === "number" ? startingCash : 0;
      update.shiftLabel = shiftLabel || "Shift 1";
      update.paidIn = [];
      update.paidOut = [];
    }

    await Setting.findOneAndUpdate(
      { key: "shopStatus" },
      { $set: update },
      { upsert: true, new: true },
    );

    return NextResponse.json({ ok: true, shiftDate: update.shiftDate ?? null });
  } catch (e) {
    console.error("[shop-status POST]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
