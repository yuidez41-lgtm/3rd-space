import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { verifySession } from "@/lib/auth";
import mongoose from "mongoose";

const DailyReportSchema = new mongoose.Schema({}, { strict: false });
const DailyReport =
  mongoose.models.DailyReport ||
  mongoose.model("DailyReport", DailyReportSchema);

function csvEscape(val: any): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("3s_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const query: any = {};
  if (from || to) {
    query.dayKey = {};
    if (from) query.dayKey.$gte = from;
    if (to) query.dayKey.$lte = to;
  }

  const reports = await DailyReport.find(query).sort({ dayKey: 1 }).lean();

  const headers = [
    "Date",
    "Revenue",
    "Net Revenue",
    "Orders Completed",
    "Cancelled",
    "Cash Revenue",
    "GCash Revenue",
    "Dine-In Revenue",
    "Delivery Revenue",
    "Takeout Revenue",
    "Delivery Fees",
    "Discounts Given",
    "Avg Order",
  ];

  const rows = (reports as any[]).map((r) => [
    r.dayKey,
    (r.revenue || 0).toFixed(2),
    (r.netRevenue ?? r.revenue ?? 0).toFixed(2),
    r.orderCount || 0,
    r.cancelledCount || 0,
    (r.cashRev || 0).toFixed(2),
    (r.gcashRev || 0).toFixed(2),
    (r.dineInRev || 0).toFixed(2),
    (r.deliveryRev || 0).toFixed(2),
    (r.takeoutRev || 0).toFixed(2),
    (r.deliveryFees || 0).toFixed(2),
    (r.discountTotal || 0).toFixed(2),
    (r.avgOrder || 0).toFixed(2),
  ]);

  const totalRevenue = (reports as any[]).reduce(
    (s, r) => s + (r.revenue || 0),
    0,
  );
  const totalOrders = (reports as any[]).reduce(
    (s, r) => s + (r.orderCount || 0),
    0,
  );
  rows.push([]);
  rows.push([
    "TOTAL",
    totalRevenue.toFixed(2),
    "",
    totalOrders,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const filename = `3rdspace-sales-${from || "all"}-to-${to || "all"}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
