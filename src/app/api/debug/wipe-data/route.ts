import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { verifySession } from "@/lib/auth";
import mongoose from "mongoose";
export async function POST(req: NextRequest) {
  const token = req.cookies.get("3s_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body?.password || body.password !== process.env.WIPE_DATA_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  await connectDB();
  const db = mongoose.connection.db!;
  await db.collection("orders").deleteMany({});
  await db.collection("dailyreports").deleteMany({});
  await db.collection("shiftreports").deleteMany({});
  await db.collection("settings").deleteMany({ key: "shopStatus" });
  await db.collection("redemptions").deleteMany({});
  return NextResponse.json({ ok: true });
}
