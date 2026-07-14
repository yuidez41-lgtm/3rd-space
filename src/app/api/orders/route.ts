import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { MenuItem } from "@/models/MenuItem";
import { notifyClients } from "@/lib/sse";
import Redemption from "@/models/Redemption";
import { Setting } from "@/lib/models/Setting";

function generateOrderNumber() {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `3S-${datePart}-${random}`;
}

export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get("orderNumber");

  if (orderNumber) {
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json([order]);
  }

  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const query: any = { archived: { $ne: true } };
  if (status) query.status = status;
  if (type) query.type = type;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const orders = await Order.find(query).sort({ createdAt: -1 });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();

  const shopDoc = await Setting.findOne({ key: "shopStatus" }).lean();

  if (body.source !== "crew") {
    if (shopDoc && (shopDoc as any).open === false) {
      return NextResponse.json(
        { error: "Ordering is currently paused." },
        { status: 503 },
      );
    }
  }

  const shiftDate =
    (shopDoc as any)?.shiftDate ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  const {
    type,
    items,
    customerName,
    customerContact,
    deliveryAddress,
    deliveryAddressDetails,
    receiptUrl,
    receiptKey,
    gcashRef,
    gcashSenderName,
    gcashReferenceNo,
    tableNumber,
    paymentMethod,
    cashAmount,
    gcashAmount,
    notes,
    waiterName,
    source,
    deliveryFee,
    voucherCode,
    voucherCodes,
    isTab,
  } = body;
  // The order page's "Enter Reference No." flow sends gcashSenderName +
  // gcashReferenceNo (not gcashRef, which was the older single-field
  // shape). Normalize to the field this route/model already saves
  // (gcashRef) plus a new gcashSenderName field, so either input path
  // ends up readable the same way downstream.
  const resolvedGcashRef = gcashReferenceNo || gcashRef || undefined;
  const total = body.total;

  if (!type || !items?.length || !total) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // ── Duplicate-submission guard ──────────────────────────────────────
  // Covers double-taps, slow-network retries, or a client resubmitting
  // after a timeout even though the first request actually went through.
  // Scope: same type + table/customer + same item lines + same total,
  // created within the last 20 seconds. This is intentionally tight so
  // it never blocks a legitimate quick reorder of the same items.
  {
    const dupWindowStart = new Date(Date.now() - 20 * 1000);
    const dupQuery: any = {
      type,
      total,
      createdAt: { $gte: dupWindowStart },
    };
    if (type === "dine-in") {
      dupQuery.tableNumber = tableNumber || null;
      dupQuery.customerName = customerName || null;
    } else if (type === "delivery") {
      dupQuery.customerContact = customerContact || null;
    } else {
      dupQuery.customerName = customerName || null;
    }

    const candidateDupes = await Order.find(dupQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const incomingSignature = JSON.stringify(
      (items || [])
        .map((i: any) => ({
          id: i.id || i.menuItemId || i.name,
          qty: i.quantity,
        }))
        .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))),
    );

    const isDuplicate = candidateDupes.some((existing: any) => {
      const existingSignature = JSON.stringify(
        (existing.items || [])
          .map((i: any) => ({
            id: i.menuItemId || i.name,
            qty: i.quantity,
          }))
          .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))),
      );
      return existingSignature === incomingSignature;
    });

    if (isDuplicate) {
      return NextResponse.json(
        {
          error:
            "This looks like a duplicate of an order just placed. If this is a new order, please wait a few seconds and try again.",
        },
        { status: 409 },
      );
    }
  }

  // ── Server-side availability check ──────────────────────────────────
  // The customer's cart is built from a menu snapshot fetched on page
  // load. If an admin hides an item while they're mid-checkout, nothing
  // on the client re-validates that before hitting this endpoint — so
  // check current availability here, server-side, right before we'd
  // otherwise create the order.
  {
    const cartItemIds = items
      .map((i: any) => i.id || i.menuItemId)
      .filter((id: any) => id && !String(id).startsWith("hardcoded-"));

    if (cartItemIds.length > 0) {
      const currentMenuDocs = await MenuItem.find({
        _id: { $in: cartItemIds },
      }).lean();
      const availabilityById: Record<string, boolean> = Object.fromEntries(
        currentMenuDocs.map((m: any) => [String(m._id), m.available !== false]),
      );

      const unavailableNames: string[] = [];
      for (const it of items) {
        const itemId = it.id || it.menuItemId;
        if (!itemId || String(itemId).startsWith("hardcoded-")) continue;
        // Missing from availabilityById means the item was deleted entirely.
        const stillAvailable = availabilityById[String(itemId)];
        if (stillAvailable === false || stillAvailable === undefined) {
          unavailableNames.push(it.name);
        }
      }

      if (unavailableNames.length > 0) {
        return NextResponse.json(
          {
            error:
              unavailableNames.length === 1
                ? `"${unavailableNames[0]}" just sold out — remove it from your cart to continue.`
                : `These items just sold out: ${unavailableNames.join(", ")}. Remove them from your cart to continue.`,
            unavailableNames,
          },
          { status: 409 },
        );
      }
    }
  }

  // ── Server-side voucher validation (supports multiple codes) ────────
  // Never trust the client-computed total when vouchers are present.
  // Each voucher code discounts ONE unit of ONE distinct eligible item —
  // codes can't stack on the same line, so a table of 4 redeeming 4
  // separate review vouchers gets 4 separate discounts on 4 separate items.
  const rawVoucherCodes: string[] = Array.isArray(voucherCodes)
    ? voucherCodes.filter((c: string) => c?.trim())
    : voucherCode?.trim()
      ? [voucherCode]
      : [];

  const appliedVouchers: {
    code: string;
    type: "drink" | "food";
    discount: number;
    itemName: string;
  }[] = [];

  if (rawVoucherCodes.length > 0) {
    const DRINK_CATEGORY_KEYWORDS = [
      "3rd space",
      "coffee",
      "matcha",
      "tea",
      "non",
      "oat",
      "brain fuel",
      "flavored soda",
    ];
    const ids = items.map((i: any) => i.id || i.menuItemId).filter(Boolean);
    const menuDocs = await MenuItem.find({ _id: { $in: ids } }).lean();
    const categoryByMenuItemId: Record<string, string> = Object.fromEntries(
      menuDocs.map((m: any) => [String(m._id), m.category || ""]),
    );
    const isDrink = (cat: string) =>
      DRINK_CATEGORY_KEYWORDS.some((k) => cat.toLowerCase().includes(k));

    // Which cart lines (by index) are already claimed by a voucher this
    // order, so two codes can never discount the same line.
    const claimedIndexes = new Set<number>();

    for (const rawCode of rawVoucherCodes) {
      const codeUpper = rawCode.trim().toUpperCase();

      const redemption = await Redemption.findOne({
        code: codeUpper,
        used: false,
      });
      if (!redemption) {
        return NextResponse.json(
          {
            error: `Voucher "${codeUpper}" is invalid, already used, or not found.`,
          },
          { status: 400 },
        );
      }
      const vType: "drink" | "food" = redemption.type;

      let bestIdx = -1;
      let bestItem: any = null;
      items.forEach((it: any, idx: number) => {
        if (claimedIndexes.has(idx)) return;
        const cat = categoryByMenuItemId[String(it.id || it.menuItemId)] || "";
        const matches = vType === "drink" ? isDrink(cat) : !isDrink(cat);
        if (!matches) return;
        if (!bestItem || it.price < bestItem.price) {
          bestItem = it;
          bestIdx = idx;
        }
      });

      if (!bestItem) {
        return NextResponse.json(
          {
            error: `Voucher "${codeUpper}" is a ${vType} voucher, but there's no eligible ${vType} item left in the cart to apply it to.`,
          },
          { status: 400 },
        );
      }

      claimedIndexes.add(bestIdx);
      const pct = vType === "drink" ? 0.1 : 0.05;
      const discount = Math.round(bestItem.price * pct * 100) / 100;
      appliedVouchers.push({
        code: codeUpper,
        type: vType,
        discount,
        itemName: bestItem.name,
      });
    }

    const totalVoucherDiscount = appliedVouchers.reduce(
      (s, v) => s + v.discount,
      0,
    );
    const rawSubtotal = items.reduce(
      (s: number, i: any) => s + i.price * i.quantity,
      0,
    );
    const expectedTotal =
      Math.max(0, rawSubtotal - totalVoucherDiscount) + (deliveryFee || 0);

    // Overwrite whatever the client sent with the server-computed total.
    body.total = expectedTotal;
    body.voucherDiscount = totalVoucherDiscount;
    body.voucherItemName = appliedVouchers.map((v) => v.itemName).join(", ");
  }

  if (type === "delivery") {
    if (!customerName || !customerContact || !deliveryAddress) {
      return NextResponse.json(
        { error: "Missing delivery details" },
        { status: 400 },
      );
    }
    if (
      source !== "waiter" &&
      source !== "crew" &&
      !receiptUrl &&
      !resolvedGcashRef
    ) {
      return NextResponse.json(
        {
          error:
            "Payment proof required for delivery (screenshot or ref number)",
        },
        { status: 400 },
      );
    }
  }

  if (type === "dine-in" && !tableNumber && !customerName) {
    return NextResponse.json(
      { error: "Table number or customer name required for dine-in" },
      { status: 400 },
    );
  }

  const normalizedItems = items.map((item: any) => ({
    menuItemId: item.id || item.menuItemId || undefined,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    customizations: Array.isArray(item.customizations)
      ? item.customizations
      : [],
  }));

  if (type === "delivery") {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await Order.countDocuments({
      type: "delivery",
      createdAt: { $gte: tenMinutesAgo },
      customerContact: body.customerContact,
    });

    if (recentCount >= 3) {
      return NextResponse.json(
        {
          error:
            "Too many orders placed recently. Please wait a few minutes before trying again.",
        },
        { status: 429 },
      );
    }
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    type,
    shiftDate,
    items: normalizedItems,
    total,
    customerName,
    customerContact,
    deliveryAddress,
    deliveryAddressDetails,
    receiptUrl,
    receiptKey,
    gcashRef: resolvedGcashRef,
    gcashSenderName: gcashSenderName || undefined,
    tableNumber,
    paymentMethod,
    cashAmount,
    gcashAmount,
    notes,
    waiterName,
    source,
    deliveryFee,
    voucherCode: appliedVouchers[0]?.code || undefined,
    voucherCodes: appliedVouchers.length
      ? appliedVouchers.map((v) => v.code)
      : undefined,
    voucherDiscount: body.voucherDiscount || undefined,
    voucherItemName: body.voucherItemName || undefined,
    isTab: isTab === true,
    shiftLabel: body.shiftLabel || null,
  });

  // Burn every applied voucher only now that the order is confirmed
  if (appliedVouchers.length > 0) {
    await Redemption.updateMany(
      { code: { $in: appliedVouchers.map((v) => v.code) }, used: false },
      { $set: { used: true, usedAt: new Date(), orderId: order._id } },
    );
  }

  notifyClients();

  return NextResponse.json(order, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();

  const { id, status, paymentStatus } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const update: any = {};
  if (status) update.status = status;
  if (paymentStatus) update.paymentStatus = paymentStatus;
  if (body.cancelReason) update.cancelReason = body.cancelReason;
  if (body.paymentMethod) update.paymentMethod = body.paymentMethod;
  if (typeof body.cashAmount === "number") update.cashAmount = body.cashAmount;
  if (typeof body.gcashAmount === "number")
    update.gcashAmount = body.gcashAmount;

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const order = await Order.findByIdAndUpdate(id, update, { new: true });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  notifyClients();

  return NextResponse.json(order);
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await Order.findByIdAndDelete(id);
  notifyClients();
  return NextResponse.json({ success: true });
}
