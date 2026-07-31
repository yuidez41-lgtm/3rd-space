import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Discount } from "@/models/Discount";
import { verifySession } from "@/lib/auth";

async function requireStaffSession(req: NextRequest) {
  const token = req.cookies.get("3s_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  await connectDB();
  const discounts = await Discount.find().sort({ createdAt: 1 });
  return NextResponse.json(discounts);
}

export async function POST(req: NextRequest) {
  const authError = await requireStaffSession(req);
  if (authError) return authError;

  await connectDB();
  const { name, percentage } = await req.json();
  if (!name || !percentage)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const discount = await Discount.create({ name, percentage });
  return NextResponse.json(discount, { status: 201 });
}
