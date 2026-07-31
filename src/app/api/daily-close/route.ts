import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import mongoose from "mongoose";
import { verifySession } from "@/lib/auth";
import { NextRequest } from "next/server";

async function requireStaffSession(req: NextRequest) {
  const token = req.cookies.get("3s_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const DailyReportSchema = new mongoose.Schema({}, { strict: false });
const DailyReport =
  mongoose.models.DailyReport ||
  mongoose.model("DailyReport", DailyReportSchema);

const SettingSchema = new mongoose.Schema({}, { strict: false });
const Setting =
  mongoose.models.Setting || mongoose.model("Setting", SettingSchema);

const ShiftReportSchema = new mongoose.Schema({}, { strict: false });
const ShiftReport =
  mongoose.models.ShiftReport ||
  mongoose.model("ShiftReport", ShiftReportSchema);

function calendarKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function POST(req: NextRequest) {
  try {
    const authError = await requireStaffSession(req);
    if (authError) return authError;

    await connectDB();
    const { openedAt, countedCash } = await req.json();
    const now = new Date();

    // ── Resolve the shift key ───────────────────────────────────────────────
    // Use the shiftDate stamped when the owner opened the shop.
    // Falls back to calendar date only if somehow shiftDate was never set.
    const shopDoc = await Setting.findOne({ key: "shopStatus" }).lean();

    // Use shiftDate if available, otherwise fall back to today's calendar key
    const dayKey = (shopDoc as any)?.shiftDate ?? calendarKey(now);

    // Day-level starting cash must be the FIRST shift's float for this
    // dayKey, not shopDoc.startingCash — that field gets overwritten on
    // every handover, so by the last shift of the day it holds that
    // shift's carried-over float, not the day's original opening cash.
    // Using it here double-counts every earlier shift's cash sales.
    const firstShiftToday = await ShiftReport.findOne({ dayKey })
      .sort({ openedAt: 1 })
      .lean();
    // Day-level starting cash (for the aggregate DailyReport) — always the
    // very first shift's float for this dayKey.
    const dayStartingCash =
      (firstShiftToday as any)?.startingCash ??
      (shopDoc as any)?.startingCash ??
      0;
    // This-shift's starting cash (for the ShiftReport of the shift being
    // closed right now) — the live carried-over float in shopDoc, NOT the
    // day's original float. These two are different for every shift after
    // the first one.
    const startingCash = (shopDoc as any)?.startingCash ?? 0;
    const paidIn = (shopDoc as any)?.paidIn ?? [];
    const paidOut = (shopDoc as any)?.paidOut ?? [];
    const paidInTotal = paidIn.reduce(
      (s: number, e: any) => s + (e.amount || 0),
      0,
    );
    const paidOutTotal = paidOut.reduce(
      (s: number, e: any) => s + (e.amount || 0),
      0,
    );

    // Check if a report already exists for this business day
    const existingReport = await DailyReport.findOne({ dayKey }).lean();

    // ── Pull all unarchived orders that belong to this shift ────────────────
    const shiftOrders = await Order.find({
      archived: { $ne: true },
      shiftDate: dayKey, // only orders tagged to this shift
    }).lean();

    // Legacy orders only on first-ever close (no existing report yet)
    const legacyOrders = !(existingReport as any)
      ? await Order.find({
          archived: { $ne: true },
          shiftDate: { $exists: false },
        }).lean()
      : [];

    const allOrders = [...shiftOrders, ...legacyOrders];

    // ── Aggregate ───────────────────────────────────────────────────────────
    const completed = allOrders.filter((o: any) => o.status === "completed");
    const cancelled = allOrders.filter((o: any) => o.status === "cancelled");

    // ── Orders belonging ONLY to the shift being closed right now ───────────
    // allOrders/completed above are day-wide (correct for DailyReport), but
    // the ShiftReport for this specific shift must not include orders from
    // an earlier shift that already got its own ShiftReport today.
    const thisShiftOpenedAt = openedAt ? new Date(openedAt) : null;
    const thisShiftOrders = thisShiftOpenedAt
      ? allOrders.filter((o: any) => new Date(o.createdAt) >= thisShiftOpenedAt)
      : allOrders;
    const thisShiftCompleted = thisShiftOrders.filter(
      (o: any) => o.status === "completed",
    );
    const thisShiftCancelled = thisShiftOrders.filter(
      (o: any) => o.status === "cancelled",
    );
    const revenue = completed.reduce((s: number, o: any) => s + o.total, 0);
    const deliveryFees = completed
      .filter((o: any) => o.type === "delivery")
      .reduce((s: number, o: any) => s + (o.deliveryFee || 0), 0);

    // Total discounts given away this shift/day — item-level discounts,
    // order-level discounts, and voucher discounts all count, same as
    // the shift-report route.
    const discountTotal = completed.reduce((s: number, o: any) => {
      const itemDiscounts = (o.items || []).reduce(
        (is: number, it: any) => is + (it.discountAmount || 0),
        0,
      );
      const orderDiscount = o.discountAmount || 0;
      const voucherDiscount = o.voucherDiscount || 0;
      return s + itemDiscounts + orderDiscount + voucherDiscount;
    }, 0);

    const items: Record<string, { qty: number; revenue: number }> = {};
    completed.forEach((o: any) => {
      o.items?.forEach((it: any) => {
        if (!items[it.name]) items[it.name] = { qty: 0, revenue: 0 };
        items[it.name].qty += it.quantity;
        items[it.name].revenue += it.price * it.quantity;
      });
    });

    const cashRev = completed.reduce((s: number, o: any) => {
      if (o.paymentMethod === "cash") return s + o.total;
      if (o.paymentMethod === "split") return s + (o.cashAmount ?? 0);
      return s;
    }, 0);
    const gcashRev = completed.reduce((s: number, o: any) => {
      if (o.paymentMethod === "gcash") return s + o.total;
      if (o.paymentMethod === "split") return s + (o.gcashAmount ?? 0);
      return s;
    }, 0);
    const dineInRev = completed
      .filter((o: any) => o.type === "dine-in")
      .reduce((s: number, o: any) => s + o.total, 0);
    const deliveryRev = completed
      .filter((o: any) => o.type === "delivery")
      .reduce((s: number, o: any) => s + o.total, 0);
    const takeoutRev = completed
      .filter((o: any) => o.type === "takeout")
      .reduce((s: number, o: any) => s + o.total, 0);

    const report = {
      dayKey, // ← business-day key, not calendar
      date: now.toISOString(),
      openedAt: (existingReport as any)?.openedAt || openedAt || null,
      closedAt: now.toISOString(),
      revenue,
      netRevenue: revenue - deliveryFees,
      deliveryFees,
      orderCount: completed.length,
      cancelledCount: cancelled.length,
      totalOrders: allOrders.length,
      avgOrder: completed.length ? revenue / completed.length : 0,
      cashRev,
      gcashRev,
      dineInRev,
      deliveryRev,
      takeoutRev,
      discountTotal,
      items,
      orders: JSON.parse(JSON.stringify(allOrders)),
      startingCash: dayStartingCash,
      paidIn,
      paidOut,
      paidInTotal,
      paidOutTotal,
      countedCash: typeof countedCash === "number" ? countedCash : null,
      expectedCash: dayStartingCash + cashRev + paidInTotal - paidOutTotal,
      cashDiff:
        typeof countedCash === "number"
          ? countedCash -
            (dayStartingCash + cashRev + paidInTotal - paidOutTotal)
          : null,
    };

    await DailyReport.findOneAndUpdate(
      { dayKey },
      { $set: report },
      { upsert: true, new: true },
    );

    // ── Also save a ShiftReport for whatever shift is being closed right now ──
    // Without this, a shift that goes straight to "End of Day" (no handover)
    // never shows up in the shift-comparison view — only handed-over shifts did.
    const thisShiftRevenue = thisShiftCompleted.reduce(
      (s: number, o: any) => s + o.total,
      0,
    );
    const thisShiftCashRev = thisShiftCompleted.reduce((s: number, o: any) => {
      if (o.paymentMethod === "cash") return s + o.total;
      if (o.paymentMethod === "split") return s + (o.cashAmount ?? 0);
      return s;
    }, 0);
    const thisShiftGcashRev = thisShiftCompleted.reduce((s: number, o: any) => {
      if (o.paymentMethod === "gcash") return s + o.total;
      if (o.paymentMethod === "split") return s + (o.gcashAmount ?? 0);
      return s;
    }, 0);
    const thisShiftItems: Record<string, { qty: number; revenue: number }> = {};
    thisShiftCompleted.forEach((o: any) => {
      o.items?.forEach((it: any) => {
        if (!thisShiftItems[it.name])
          thisShiftItems[it.name] = { qty: 0, revenue: 0 };
        thisShiftItems[it.name].qty += it.quantity;
        thisShiftItems[it.name].revenue += it.price * it.quantity;
      });
    });
    const thisShiftDiscountTotal = thisShiftCompleted.reduce(
      (s: number, o: any) => {
        const itemDiscounts = (o.items || []).reduce(
          (is: number, it: any) => is + (it.discountAmount || 0),
          0,
        );
        return (
          s + itemDiscounts + (o.discountAmount || 0) + (o.voucherDiscount || 0)
        );
      },
      0,
    );

    const expectedCash =
      startingCash + thisShiftCashRev + paidInTotal - paidOutTotal;
    const finalShiftReport = await ShiftReport.create({
      dayKey,
      shiftLabel: (shopDoc as any)?.shiftLabel || "Shift 1",
      openedBy: (shopDoc as any)?.openedBy || null,
      openedAt: openedAt || null,
      closedAt: now.toISOString(),
      revenue: thisShiftRevenue,
      orderCount: thisShiftCompleted.length,
      cancelledCount: thisShiftCancelled.length,
      cashRev: thisShiftCashRev,
      gcashRev: thisShiftGcashRev,
      startingCash,
      countedCash: typeof countedCash === "number" ? countedCash : null,
      expectedCash,
      cashDiff:
        typeof countedCash === "number" ? countedCash - expectedCash : null,
      items: thisShiftItems,
      paidIn,
      paidOut,
      paidInTotal,
      paidOutTotal,
      discountTotal: thisShiftDiscountTotal,
    });

    // Archive every order that was part of this shift (skip unsettled tab orders)
    const idsToArchive = allOrders
      .filter(
        (o: any) => !(o.isTab === true && o.paymentStatus !== "confirmed"),
      )
      .map((o: any) => o._id);
    await Order.updateMany(
      { _id: { $in: idsToArchive } },
      { $set: { archived: true, archivedAt: now.toISOString() } },
    );

    // ── Clear shift state so the next open starts fresh ─────────────────────
    await Setting.findOneAndUpdate(
      { key: "shopStatus" },
      {
        $set: {
          shiftDate: null,
          startingCash: null,
          paidIn: [],
          paidOut: [],
        },
      },
    );

    // Detach surviving tab orders from this shift so they float until settled
    await Order.updateMany(
      {
        isTab: true,
        paymentStatus: { $ne: "confirmed" },
        archived: { $ne: true },
      },
      { $unset: { shiftDate: "" } },
    );

    return NextResponse.json({
      ok: true,
      report,
      shiftReport: finalShiftReport,
    });
  } catch (e) {
    console.error("[daily-close POST]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authError = await requireStaffSession(req);
    if (authError) return authError;

    await connectDB();
    const reports = await DailyReport.find({})
      .sort({ dayKey: -1 })
      .limit(400)
      .lean();
    return NextResponse.json(
      reports.map((r: any) => ({ ...r, _id: r._id.toString() })),
    );
  } catch (e) {
    console.error("[daily-close GET]", e);
    return NextResponse.json([]);
  }
}
