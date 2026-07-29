import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { MenuItem } from "@/models/MenuItem";
import { Setting } from "@/lib/models/Setting";

// Combined poll endpoint for the admin dashboard's recurring refresh loop.
// Previously each poll tick fired 4 separate serverless invocations
// (/api/orders, /api/shop-status, /api/menu, /api/shop-status/cash-log).
// On Vercel's Fluid Active CPU billing, invocation count and per-request
// init overhead matter even when the DB connection itself is cached —
// so folding all 4 queries into one request/one invocation cuts both
// invocation count and total CPU time roughly 4x for this loop, without
// changing what data the dashboard actually sees.
//
// This intentionally mirrors the "isUnfilteredPoll" branch in
// /api/orders (GET, no query params) — active orders unbounded, terminal
// orders limited to the last 24h — and the paidIn/paidOut total logic
// from /api/shop-status/cash-log. If either of those routes' logic
// changes, update this copy too.

export async function GET() {
  await connectDB();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [orders, shopDoc, menuItems] = await Promise.all([
    Order.find({
      archived: { $ne: true },
      $or: [
        { status: { $nin: ["completed", "cancelled"] } },
        { createdAt: { $gte: cutoff } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean(),
    Setting.findOne({ key: "shopStatus" }).lean(),
    MenuItem.find().sort({ category: 1, createdAt: 1 }).lean(),
  ]);

  const doc = shopDoc as any;
  const paidIn = doc?.paidIn ?? [];
  const paidOut = doc?.paidOut ?? [];
  const paidInTotal = paidIn.reduce(
    (s: number, e: any) => s + (e.amount || 0),
    0,
  );
  const paidOutTotal = paidOut.reduce(
    (s: number, e: any) => s + (e.amount || 0),
    0,
  );

  return NextResponse.json({
    orders,
    menuItems,
    shopStatus: {
      open: doc?.open ?? false,
      openedAt: doc?.openedAt ?? null,
      shiftDate: doc?.shiftDate ?? null,
      shiftLabel: doc?.shiftLabel ?? "Shift 1",
      startingCash: doc?.startingCash ?? null,
    },
    cashLog: { paidInTotal, paidOutTotal },
  });
}
