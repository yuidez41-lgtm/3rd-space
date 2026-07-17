import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { deleteFromR2 } from "@/lib/r2";
import { notifyClients } from "@/lib/sse";
import mongoose from "mongoose";

const ShiftReportSchema = new mongoose.Schema({}, { strict: false });
const ShiftReport =
  mongoose.models.ShiftReport ||
  mongoose.model("ShiftReport", ShiftReportSchema);

const TERMINAL_STATUSES = ["completed", "cancelled"];

async function attributeToOriginalShift(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) return;
  if (order.shiftReportId) return; // already claimed, leave it alone
  if (!TERMINAL_STATUSES.includes(order.status)) return;

  const createdAt = new Date(order.createdAt);

  const candidateReports = await ShiftReport.find({
    closedAt: { $exists: true, $ne: null },
  }).lean();

  const match = candidateReports.find((r: any) => {
    const start = new Date(r.openedAt);
    const end = new Date(r.closedAt);
    return createdAt >= start && createdAt <= end;
  });

  if (!match) {
    console.log(
      "[attributeToOriginalShift] no matching report for order",
      orderId,
      "createdAt:",
      createdAt.toISOString(),
    );
    return;
  }

  console.log(
    "[attributeToOriginalShift] matched report",
    (match as any)._id,
    "for order",
    orderId,
  );

  const isCompleted = order.status === "completed";

  // If this order's cash was already counted when the shift originally
  // closed (paid but still preparing at handover), don't add it again —
  // only revenue/orderCount still need crediting now.
  const alreadyCashCounted = ((match as any).cashCountedOrderIds || []).some(
    (id: any) => String(id) === String(order._id),
  );

  const addRevenue = isCompleted ? order.total : 0;
  const addCash =
    isCompleted && !alreadyCashCounted
      ? order.paymentMethod === "cash"
        ? order.total
        : order.paymentMethod === "split"
          ? order.cashAmount || 0
          : 0
      : 0;
  const addGcash =
    isCompleted && !alreadyCashCounted
      ? order.paymentMethod === "gcash"
        ? order.total
        : order.paymentMethod === "split"
          ? order.gcashAmount || 0
          : 0
      : 0;
  const addCancelled = order.status === "cancelled" ? 1 : 0;
  const addDiscount = isCompleted
    ? (order.items || []).reduce(
        (s: number, it: any) => s + (it.discountAmount || 0),
        0,
      ) +
      (order.discountAmount || 0) +
      (order.voucherDiscount || 0)
    : 0;

  const mergedItems = { ...(match as any).items };
  if (isCompleted) {
    (order.items || []).forEach((it: any) => {
      if (!mergedItems[it.name]) mergedItems[it.name] = { qty: 0, revenue: 0 };
      mergedItems[it.name].qty += it.quantity;
      mergedItems[it.name].revenue += it.price * it.quantity;
    });
  }

  const newExpectedCash = (match as any).expectedCash + addCash;
  const newCashDiff =
    typeof (match as any).countedCash === "number"
      ? (match as any).countedCash - newExpectedCash
      : null;

  await ShiftReport.collection.updateOne(
    { _id: (match as any)._id },
    {
      $inc: {
        revenue: addRevenue,
        orderCount: isCompleted ? 1 : 0,
        cancelledCount: addCancelled,
        cashRev: addCash,
        gcashRev: addGcash,
        discountTotal: addDiscount,
      },
      $set: {
        items: mergedItems,
        expectedCash: newExpectedCash,
        cashDiff: newCashDiff,
        pendingOrderIds: ((match as any).pendingOrderIds || []).filter(
          (pid: any) => String(pid) !== String(order._id),
        ),
      },
    },
  );

  await Order.updateOne(
    { _id: order._id },
    { $set: { shiftReportId: (match as any)._id } },
  );
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await connectDB();
  const order = await Order.findById(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectDB();
    const body = await req.json();

    // ── Per-item discount apply/remove ──────────────────────────────
    // body: { itemDiscount: { itemIndex, discountName, discountPct } }
    // or:   { itemDiscount: { itemIndex, remove: true } }
    if (body.itemDiscount) {
      const { itemIndex, discountName, discountPct, remove } =
        body.itemDiscount;

      // Retry loop handles the rare case of a genuine concurrent write
      // (e.g. two taps landing at nearly the same instant) by re-reading
      // the latest version and re-applying the intended change, instead
      // of throwing a VersionError.
      let updatedOrder = null;
      for (let attempt = 0; attempt < 3 && !updatedOrder; attempt++) {
        const current = await Order.findById(id);
        if (!current)
          return NextResponse.json({ error: "Not found" }, { status: 404 });

        const item = current.items[itemIndex];
        if (!item)
          return NextResponse.json(
            { error: "Item not found on order" },
            { status: 400 },
          );

        if (remove) {
          item.discountName = undefined;
          item.discountPct = undefined;
          item.discountAmount = undefined;
        } else {
          const lineTotal = item.price * item.quantity;
          const amount = Math.round(lineTotal * discountPct) / 100;
          item.discountName = discountName;
          item.discountPct = discountPct;
          item.discountAmount = amount;
        }

        const itemsTotal = current.items.reduce((sum: number, it: any) => {
          const line = it.price * it.quantity;
          return sum + (line - (it.discountAmount || 0));
        }, 0);
        current.total = itemsTotal + (current.deliveryFee || 0);
        current.markModified("items");

        try {
          updatedOrder = await current.save();
        } catch (saveErr: any) {
          if (saveErr?.name === "VersionError" && attempt < 2) {
            continue; // reload latest version and reapply on next loop
          }
          console.error(
            "[itemDiscount save failed]",
            saveErr?.name,
            saveErr?.message,
            saveErr?.errors ? Object.keys(saveErr.errors) : undefined,
          );
          throw saveErr;
        }
      }

      notifyClients();
      return NextResponse.json(updatedOrder);
    }

    // Auto-stamp when status or paymentStatus changes
    const stampUpdate: any = { ...body };
    if (body.status) {
      const statusStamps: Record<string, string> = {
        confirmed: "confirmedAt",
        preparing: "preparingAt",
        ready: "readyAt",
        completed: "completedAt",
        cancelled: "cancelledAt",
      };
      const field = statusStamps[body.status];
      if (field) stampUpdate[field] = new Date();
    }
    if (body.paymentStatus === "confirmed") {
      stampUpdate.paidAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(id, stampUpdate, {
      new: true,
    });
    if (!order)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.status && TERMINAL_STATUSES.includes(body.status)) {
      try {
        await attributeToOriginalShift(id);
      } catch (attribErr) {
        console.error("[attributeToOriginalShift] failed", attribErr);
      }
    }

    return NextResponse.json(order);
  } catch (e) {
    console.error("PATCH /api/orders/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectDB();
    const order = await Order.findById(id);
    if (!order)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (order.receiptKey) await deleteFromR2(order.receiptKey);
    await order.deleteOne();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/orders/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
