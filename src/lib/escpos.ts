// lib/escpos.ts

function textToBytes(str: string): number[] {
  // Basic Latin + common PH characters; falls back to '?' for unsupported chars
  return Array.from(str).map((ch) => {
    const code = ch.codePointAt(0) || 63;
    return code < 256 ? code : 63;
  });
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function imageUrlToEscPosRaster(
  url: string,
  maxWidthPx = 120,
): Promise<number[]> {
  const img = await loadImageElement(url);

  let width = Math.min(img.naturalWidth, maxWidthPx);
  width = width - (width % 8); // must be multiple of 8 to pack cleanly
  if (width <= 0) width = 8;
  const height = Math.round((img.naturalHeight / img.naturalWidth) * width);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const widthBytes = width / 8;
  const bitmap = new Array(widthBytes * height).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha > 127) {
        const byteIndex = y * widthBytes + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        bitmap[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  const GS = 0x1d;
  const wL = widthBytes & 0xff;
  const wH = (widthBytes >> 8) & 0xff;
  const hL = height & 0xff;
  const hH = (height >> 8) & 0xff;

  return [GS, 0x76, 0x30, 0x00, wL, wH, hL, hH, ...bitmap];
}

let cachedLogoBytes: number[] | null = null;
let cachedLogoPromise: Promise<number[]> | null = null;

// Fetch + rasterize the logo once and reuse it for every receipt after
// that. Also swallow failures here (flaky wifi, slow cold start, CDN
// hiccup) instead of letting them kill the whole receipt build — a
// logo-less receipt that still prints beats a silent no-op on the tablet.
// Failure isn't cached, so the next print retries the fetch.
async function getLogoBytes(): Promise<number[]> {
  if (cachedLogoBytes) return cachedLogoBytes;
  if (!cachedLogoPromise) {
    cachedLogoPromise = imageUrlToEscPosRaster(
      `${window.location.origin}/logo-receipt.png`,
      120,
    )
      .then((bytes) => {
        cachedLogoBytes = bytes;
        return bytes;
      })
      .catch((e) => {
        console.error("[receipt logo] failed to load, skipping", e);
        cachedLogoPromise = null;
        return [];
      });
  }
  return cachedLogoPromise;
}

export async function buildEscPosReceipt(order: {
  orderNumber: string;
  type: "delivery" | "dine-in" | "takeout";
  tableNumber?: string;
  customerName?: string;
  deliveryAddress?: string;
  items: {
    name: string;
    price: number;
    quantity: number;
    discountName?: string;
    discountPct?: number;
    discountAmount?: number;
  }[];
  total: number;
  deliveryFee?: number;
  paymentMethod?: string;
  cashReceived?: number;
  change?: number;
  // Opt-in only. The drawer should pop exactly once, at the moment staff
  // actually tap "Open Cash Register" — that's a direct kickCashDrawer()
  // call elsewhere, not this function. Every OTHER print (kitchen tickets,
  // manual reprints from the "Receipt" button, auto-print on status
  // advance, etc.) must NOT touch the drawer, even for cash orders. This
  // used to be inferred automatically from paymentMethod === "cash",
  // which meant every single print of a cash order's receipt popped the
  // drawer — reprinting, or even just moving an order to "Preparing",
  // would kick it. Defaults to false on purpose.
  includeDrawerKick?: boolean;
}): Promise<Uint8Array> {
  const ESC = 0x1b;
  const GS = 0x1d;
  const bytes: number[] = [];

  const push = (...b: number[]) => bytes.push(...b);
  const line = (str = "") => {
    push(...textToBytes(str));
    push(0x0a); // \n
  };

  const hasCashPortion =
    order.paymentMethod === "cash" ||
    (order.paymentMethod === "split" && (order.cashReceived ?? 0) > 0);

  // Init printer
  push(ESC, 0x40);

  if (hasCashPortion && order.includeDrawerKick) {
    push(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  // Center align
  push(ESC, 0x61, 0x01);

  const logoBytes = await getLogoBytes();
  if (logoBytes.length > 0) {
    push(...logoBytes);
    push(0x0a); // feed one line after the image
  }

  line("OFFICIAL RECEIPT");
  line("--------------------------------");

  push(ESC, 0x45, 0x01);
  line(`#${order.orderNumber}`);
  push(ESC, 0x45, 0x00);

  const now = new Date().toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  line(now);

  const typeLabel =
    order.type === "dine-in"
      ? `DINE-IN  TABLE ${order.tableNumber || "?"}`
      : order.type === "takeout"
        ? "TAKEOUT"
        : "DELIVERY";
  line(typeLabel);

  if (order.customerName) line(order.customerName);

  push(ESC, 0x61, 0x00);
  line("--------------------------------");

  order.items.forEach((it) => {
    const lineTotal = it.price * it.quantity;
    const left = `${it.quantity}x ${it.name}`;
    const right = `P${lineTotal.toFixed(2)}`;
    const pad = Math.max(1, 32 - left.length - right.length);
    line(left + " ".repeat(pad) + right);
    if (it.discountPct && it.discountAmount) {
      const dl = `  ${it.discountName || "Discount"} (${it.discountPct}%)`;
      const dr = `-P${it.discountAmount.toFixed(2)}`;
      const dpad = Math.max(1, 32 - dl.length - dr.length);
      line(dl + " ".repeat(dpad) + dr);
    }
  });

  line("--------------------------------");

  if (order.deliveryFee && order.deliveryFee > 0) {
    const subtotal = order.total - order.deliveryFee;
    const l1 = "Subtotal";
    const r1 = `P${subtotal.toFixed(2)}`;
    line(l1 + " ".repeat(Math.max(1, 32 - l1.length - r1.length)) + r1);
    const l2 = "Delivery fee";
    const r2 = `P${order.deliveryFee.toFixed(2)}`;
    line(l2 + " ".repeat(Math.max(1, 32 - l2.length - r2.length)) + r2);
  }

  push(ESC, 0x45, 0x01);
  const lT = "TOTAL";
  const rT = `P${order.total.toFixed(2)}`;
  line(lT + " ".repeat(Math.max(1, 32 - lT.length - rT.length)) + rT);
  push(ESC, 0x45, 0x00);

  if (order.paymentMethod) {
    line(`Payment: ${order.paymentMethod.toUpperCase()}`);
  }

  if (hasCashPortion && order.cashReceived != null) {
    const cashDueForPortion =
      order.paymentMethod === "split" ? order.cashReceived : order.total;
    const lC =
      order.paymentMethod === "split"
        ? "Cash Received (split)"
        : "Cash Received";
    const rC = `P${order.cashReceived.toFixed(2)}`;
    line(lC + " ".repeat(Math.max(1, 32 - lC.length - rC.length)) + rC);

    const changeAmt = order.change ?? order.cashReceived - cashDueForPortion;
    const lG = "Change";
    const rG = `P${changeAmt.toFixed(2)}`;
    push(ESC, 0x45, 0x01);
    line(lG + " ".repeat(Math.max(1, 32 - lG.length - rG.length)) + rG);
    push(ESC, 0x45, 0x00);
  }

  line("--------------------------------");
  push(ESC, 0x61, 0x01); // center

  line("Visit 3rdspace.shop");

  line("Thank you for visiting!");
  line("3rd Space Cafe - Nueva Ecija");
  line("");
  line("");
  line("");

  // Cut paper
  push(GS, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

export function escPosToRawBtUrl(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const base64 = btoa(binary);
  return `rawbt:base64,${base64}`;
}
