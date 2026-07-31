import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import mongoose from "mongoose";
import { verifySession } from "@/lib/auth";

async function requireStaffSession(req: NextRequest) {
  const token = req.cookies.get("3s_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const ShiftReportSchema = new mongoose.Schema({}, { strict: false });
const ShiftReport =
  mongoose.models.ShiftReport ||
  mongoose.model("ShiftReport", ShiftReportSchema);

const SettingSchema = new mongoose.Schema({}, { strict: false });
const Setting =
  mongoose.models.Setting || mongoose.model("Setting", SettingSchema);

function dayKeyOf(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const TERMINAL_STATUSES = ["completed", "cancelled"];

export async function GET(req: NextRequest) {
  const authError = await requireStaffSession(req);
  if (authError) return authError;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const dayKey = searchParams.get("dayKey") || dayKeyOf(new Date());
  const reports = await ShiftReport.find({ dayKey }).sort({ closedAt: 1 });
  return NextResponse.json(reports);
}

export async function POST(req: NextRequest) {
  const authError = await requireStaffSession(req);
  if (authError) return authError;

  await connectDB();
  const body = await req.json();
  const {
    openedAt,
    closedAt,
    countedCash,
    shiftLabel,
    startingCash: bodyStartingCash,
    openedBy,
  } = body;

  const dayKey = dayKeyOf(new Date(openedAt));
  const windowStart = new Date(openedAt);
  const windowEnd = closedAt ? new Date(closedAt) : new Date();

  // Everything created in this shift's window, whether or not it's
  // already claimed — we need pending ones too, just not to claim them.
  const windowOrders = await Order.find({
    createdAt: { $gte: windowStart, $lte: windowEnd },
    shiftReportId: null,
  });

  // Only terminal orders count toward revenue AND get claimed. Pending
  // orders (still open when the shift closes, e.g. handed over to the
  // next shift) are left unclaimed so whoever finishes them can credit
  // the right shift later via the backfill step below.
  const completed = windowOrders.filter((o: any) => o.status === "completed");
  const claimableNow = windowOrders.filter((o: any) =>
    TERMINAL_STATUSES.includes(o.status),
  );

  // Cash reconciliation counts anything the customer has ALREADY PAID for,
  // whether or not the drink itself is done yet — the money is physically
  // in the drawer right now. Kept separate from revenue/orderCount below,
  // which only count orders that are actually completed.
  const paidOrders = windowOrders.filter(
    (o: any) => o.paymentStatus === "confirmed" && o.status !== "cancelled",
  );
  const cashCountedOrderIds = paidOrders.map((o: any) => o._id);

  const revenue = completed.reduce((s: number, o: any) => s + o.total, 0);
  const cashRev = paidOrders.reduce((s: number, o: any) => {
    if (o.paymentMethod === "cash") return s + o.total;
    if (o.paymentMethod === "split") return s + (o.cashAmount ?? 0);
    return s;
  }, 0);
  const gcashRev = paidOrders.reduce((s: number, o: any) => {
    if (o.paymentMethod === "gcash") return s + o.total;
    if (o.paymentMethod === "split") return s + (o.gcashAmount ?? 0);
    return s;
  }, 0);
  const cancelledCount = windowOrders.filter(
    (o: any) => o.status === "cancelled",
  ).length;

  const discountTotal = completed.reduce((s: number, o: any) => {
    const itemDiscounts = (o.items || []).reduce(
      (is: number, it: any) => is + (it.discountAmount || 0),
      0,
    );
    const orderDiscount = o.discountAmount || 0;
    const voucherDiscount = o.voucherDiscount || 0;
    return s + itemDiscounts + orderDiscount + voucherDiscount;
  }, 0);

  const settingDoc = await Setting.findOne({ key: "shopStatus" }).lean();
  const paidInEntries = (settingDoc as any)?.paidIn ?? [];
  const paidOutEntries = (settingDoc as any)?.paidOut ?? [];
  const paidInTotal = paidInEntries.reduce(
    (s: number, e: any) => s + (e.amount || 0),
    0,
  );
  const paidOutTotal = paidOutEntries.reduce(
    (s: number, e: any) => s + (e.amount || 0),
    0,
  );

  const startingCash = bodyStartingCash || 0;
  const expectedCash = startingCash + cashRev + paidInTotal - paidOutTotal;
  const cashDiff =
    typeof countedCash === "number" ? countedCash - expectedCash : null;

  const items: Record<string, { qty: number; revenue: number }> = {};
  completed.forEach((o: any) => {
    o.items.forEach((it: any) => {
      if (!items[it.name]) items[it.name] = { qty: 0, revenue: 0 };
      items[it.name].qty += it.quantity;
      items[it.name].revenue += it.price * it.quantity;
    });
  });

  const rawResult = await ShiftReport.collection.findOneAndUpdate(
    { openedAt },
    {
      $setOnInsert: {
        dayKey,
        shiftLabel,
        openedBy: openedBy || null,
        openedAt,
        closedAt: closedAt || new Date().toISOString(),
        revenue,
        orderCount: completed.length,
        cancelledCount,
        cashRev,
        gcashRev,
        startingCash,
        countedCash: countedCash ?? null,
        expectedCash,
        cashDiff,
        items,
        paidIn: paidInEntries,
        paidOut: paidOutEntries,
        paidInTotal,
        paidOutTotal,
        discountTotal,
        // Track pending orders left open at close, so the UI can still
        // show "with Daryl" even though nothing's claimed yet.
        pendingOrderIds: windowOrders
          .filter((o: any) => !TERMINAL_STATUSES.includes(o.status))
          .map((o: any) => o._id),
        // Orders whose cash was already counted in cashRev above, so
        // attributeToOriginalShift knows not to add it again on completion.
        cashCountedOrderIds,
      },
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: true },
  );
  const report = rawResult?.value;
  const wasInsert = rawResult?.lastErrorObject?.upserted != null;

  if (!report) {
    return NextResponse.json(
      { error: "Failed to create or fetch shift report" },
      { status: 500 },
    );
  }

  if (!wasInsert) {
    return NextResponse.json(report);
  }

  // Claim only the terminal orders from this window — pending ones stay
  // unclaimed (shiftReportId: null) so a later shift's backfill (or this
  // same order's own eventual completion) can attribute them correctly.
  await Order.updateMany(
    { _id: { $in: claimableNow.map((o: any) => o._id) } },
    { $set: { shiftReportId: report._id } },
  );

  // --- Backfill pass ---
  // Find any orders that are now terminal, unclaimed, and NOT part of
  // this window (i.e. they belong to a previous shift that closed while
  // they were still pending). Re-attribute each one back to the report
  // whose time window actually contains its createdAt, patching that
  // report's totals after the fact.
  const strandedOrders = await Order.find({
    shiftReportId: null,
    status: { $in: TERMINAL_STATUSES },
    createdAt: { $lt: windowStart },
  });

  if (strandedOrders.length > 0) {
    // Group stranded orders by which prior report's window they fall in.
    const priorReports = await ShiftReport.find({
      dayKey,
      openedAt: { $lt: openedAt },
    }).sort({ openedAt: 1 });

    for (const priorReport of priorReports) {
      const rStart = new Date((priorReport as any).openedAt);
      const rEnd = new Date((priorReport as any).closedAt);
      const matches = strandedOrders.filter(
        (o: any) => o.createdAt >= rStart && o.createdAt <= rEnd,
      );
      if (matches.length === 0) continue;

      const matchCompleted = matches.filter(
        (o: any) => o.status === "completed",
      );
      const priorCashCounted = (
        (priorReport as any).cashCountedOrderIds || []
      ).map((id: any) => String(id));
      // Skip cash for orders whose cash was already counted when this
      // report's shift originally closed — otherwise it gets added twice.
      const stillNeedsCash = (o: any) =>
        !priorCashCounted.includes(String(o._id));
      const addRevenue = matchCompleted.reduce(
        (s: number, o: any) => s + o.total,
        0,
      );
      const addCashRev = matchCompleted
        .filter(stillNeedsCash)
        .reduce((s: number, o: any) => {
          if (o.paymentMethod === "cash") return s + o.total;
          if (o.paymentMethod === "split") return s + (o.cashAmount ?? 0);
          return s;
        }, 0);
      const addGcashRev = matchCompleted
        .filter(stillNeedsCash)
        .reduce((s: number, o: any) => {
          if (o.paymentMethod === "gcash") return s + o.total;
          if (o.paymentMethod === "split") return s + (o.gcashAmount ?? 0);
          return s;
        }, 0);
      const addCancelled = matches.filter(
        (o: any) => o.status === "cancelled",
      ).length;
      const addDiscount = matchCompleted.reduce((s: number, o: any) => {
        const itemDiscounts = (o.items || []).reduce(
          (is: number, it: any) => is + (it.discountAmount || 0),
          0,
        );
        return (
          s + itemDiscounts + (o.discountAmount || 0) + (o.voucherDiscount || 0)
        );
      }, 0);

      const addItems: Record<string, { qty: number; revenue: number }> = {};
      matchCompleted.forEach((o: any) => {
        o.items.forEach((it: any) => {
          if (!addItems[it.name]) addItems[it.name] = { qty: 0, revenue: 0 };
          addItems[it.name].qty += it.quantity;
          addItems[it.name].revenue += it.price * it.quantity;
        });
      });

      const mergedItems = { ...(priorReport as any).items };
      Object.entries(addItems).forEach(([name, v]) => {
        if (!mergedItems[name]) mergedItems[name] = { qty: 0, revenue: 0 };
        mergedItems[name].qty += v.qty;
        mergedItems[name].revenue += v.revenue;
      });

      const newExpectedCash = (priorReport as any).expectedCash + addCashRev;
      const newCashDiff =
        typeof (priorReport as any).countedCash === "number"
          ? (priorReport as any).countedCash - newExpectedCash
          : null;

      await ShiftReport.collection.updateOne(
        { _id: (priorReport as any)._id },
        {
          $inc: {
            revenue: addRevenue,
            orderCount: matchCompleted.length,
            cancelledCount: addCancelled,
            cashRev: addCashRev,
            gcashRev: addGcashRev,
            discountTotal: addDiscount,
          },
          $set: {
            items: mergedItems,
            expectedCash: newExpectedCash,
            cashDiff: newCashDiff,
            pendingOrderIds: (
              (priorReport as any).pendingOrderIds || []
            ).filter(
              (id: any) =>
                !matches.some((m: any) => String(m._id) === String(id)),
            ),
          },
        },
      );

      await Order.updateMany(
        { _id: { $in: matches.map((o: any) => o._id) } },
        { $set: { shiftReportId: (priorReport as any)._id } },
      );
    }
  }

  await Setting.findOneAndUpdate(
    { key: "shopStatus" },
    { $set: { paidIn: [], paidOut: [] } },
    { upsert: true },
  );

  return NextResponse.json(report);
}
