"use client";

import { useEffect, useState, useRef } from "react";
import { buildEscPosReceipt, escPosToRawBtUrl } from "@/lib/escpos";
import { compressImage } from "@/lib/compressImage";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit2,
  LogOut,
  Clock,
  DollarSign,
  Package,
  X,
  UtensilsCrossed,
  BarChart3,
  QrCode,
  AlertCircle,
  RefreshCw,
  Zap,
  Users,
  UserPlus,
  Shield,
  Eye,
  EyeOff,
  ImageIcon,
  Newspaper,
  Banknote,
  MapPin,
  Check,
  Armchair,
  Bike,
  HelpCircle,
  Coffee,
  Power,
  PowerOff,
  Copy as CopyIcon,
  Printer,
  Pin,
  Navigation,
} from "lucide-react";

// Standard ESC/POS drawer-kick command (ESC p m t1 t2), sent to the
// printer's kick-out connector (pin 2). This is intentionally independent
// of buildEscPosReceipt() so the drawer can be popped for ANY cash-handling
// moment — split payments, paid in/out — not just full-cash order receipts.
function buildDrawerKickBytes(): Uint8Array {
  return new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

// Use a hidden <a> click instead of window.location.href for rawbt: URLs.
// window.location.href triggers a real navigation event on Android — the
// browser leaves the page, gets bounced back by the OS, causing the hiccup
// / back-and-forth glitch seen on the POS tablet. A programmatic anchor
// click fires the intent without any navigation side-effect.
function openRawBtUrl(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 500);
}

function kickCashDrawer() {
  try {
    const url = escPosToRawBtUrl(buildDrawerKickBytes());
    openRawBtUrl(url);
  } catch {
    // no-op if RawBT isn't reachable — never block the actual transaction
  }
}

// Paid In/Out slip — embeds the drawer-kick command in the SAME byte
// buffer as the printed slip (same fix pattern as buildEscPosReceipt for
// cash orders). Firing kickCashDrawer() and a receipt separately sends two
// competing rawbt: intent URLs and RawBT silently drops one of them — so
// this always sends exactly one combined rawbt: URL per Paid In/Out entry.
function buildCashLogReceiptBytes(entry: {
  type: "in" | "out";
  amount: number;
  note: string;
  staffName: string;
  at: string;
  totalIn: number;
  totalOut: number;
}): Uint8Array {
  const enc = new TextEncoder();
  const line = (s = "") => enc.encode(s + "\n");
  const init = new Uint8Array([0x1b, 0x40]);
  const center = new Uint8Array([0x1b, 0x61, 0x01]);
  const left = new Uint8Array([0x1b, 0x61, 0x00]);
  const boldOn = new Uint8Array([0x1b, 0x45, 0x01]);
  const boldOff = new Uint8Array([0x1b, 0x45, 0x00]);
  const cut = new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
  const drawerKick = buildDrawerKickBytes();

  const dateStr = new Date(entry.at).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
  });

  const parts: Uint8Array[] = [
    init,
    center,
    boldOn,
    line("3RD SPACE"),
    boldOff,
    line(entry.type === "out" ? "PAID OUT SLIP" : "PAID IN SLIP"),
    line("--------------------------------"),
    left,
    line(`Date:  ${dateStr}`),
    line(`Staff: ${entry.staffName}`),
    line(""),
    boldOn,
    line(`${entry.type === "out" ? "-" : "+"} ${fmt(entry.amount)}`),
    boldOff,
    line(`Note:  ${entry.note}`),
    line("--------------------------------"),
    line(`Total In:  ${fmt(entry.totalIn)}`),
    line(`Total Out: ${fmt(entry.totalOut)}`),
    line(""),
    line(""),
    line(""),
    cut,
    drawerKick,
  ];

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const T = {
  bg: "#0a0f0a",
  bgCard: "rgba(255,255,255,0.035)",
  gold: "#d4a843",
  goldDim: "rgba(212,168,67,0.15)",
  goldGlow: "rgba(212,168,67,0.08)",
  cream: "#e8d5a3",
  muted: "rgba(232,213,163,0.5)",
  faint: "rgba(232,213,163,0.2)",
  border: "rgba(232,213,163,0.1)",
  borderH: "rgba(212,168,67,0.4)",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#5b9bd5",
  purple: "#a855f7",
};

function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const fn = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setWidth(window.innerWidth), 100);
    };
    window.addEventListener("resize", fn);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", fn);
    };
  }, []);
  return width;
}

type Tag = "PROMO" | "EVENT" | "UPDATE" | "PINNED";
type PinColor = "gold" | "red" | "teal";

interface Post {
  id: number;
  tag: Tag;
  pinned?: boolean;
  pinColor?: PinColor;
  date: string;
  title: string;
  body: string;
  tilt?: number;
  size?: "sm" | "md" | "lg";
  image?: string;
  link?: string;
}

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";
type OrderItem = {
  name: string;
  price: number;
  quantity: number;
  customizations?: { type: string; label: string; price: number }[];
  discountName?: string;
  discountPct?: number;
  discountAmount?: number;
};
type DiscountPreset = {
  _id: string;
  name: string;
  percentage: number;
};

type Order = {
  _id: string;
  orderNumber: string;
  type: "delivery" | "dine-in" | "takeout";
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  originalTotal?: number;
  discountName?: string;
  discountPct?: number;
  discountAmount?: number;
  voucherCode?: string;
  voucherDiscount?: number;
  voucherItemName?: string;
  customerName?: string;
  customerContact?: string;
  deliveryAddress?: string;
  receiptUrl?: string;
  gcashRef?: string;
  gcashSenderName?: string;
  tableNumber?: string;
  paymentStatus: "pending" | "confirmed";
  paymentMethod?: "cash" | "gcash" | "pending" | "split";
  cashAmount?: number;
  gcashAmount?: number;
  notes?: string;
  createdAt: string;
  waiterName?: string;
  cancelReason?: string;
  deliveryFee?: number;
  cashReceived?: number;
  changeGiven?: number;
  archived?: boolean;
  archivedAt?: string;
  shiftDate?: string;
  deliveryAddressDetails?: {
    lat?: number;
    lng?: number;
    houseNo?: string;
    street?: string;
    barangay?: string;
    city?: string;
    landmark?: string;
    fullAddress?: string;
    distanceKm?: number;
  };
};
type OptionChoice = { label: string; price: number };
type OptionGroup = {
  name: string;
  type: "single" | "multi";
  required?: boolean;
  max?: number;
  choices: OptionChoice[];
};
type MenuItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  cost?: number;
  category: string;
  image: string;
  available: boolean;
  variants?: string[];
  options?: OptionGroup[];
};
type DailyReport = {
  _id: string;
  dayKey: string;
  date: string;
  openedAt: string | null;
  closedAt: string;
  revenue: number;
  netRevenue: number;
  deliveryFees: number;
  orderCount: number;
  cancelledCount: number;
  totalOrders: number;
  avgOrder: number;
  cashRev: number;
  gcashRev: number;
  dineInRev: number;
  deliveryRev: number;
  takeoutRev: number;
  discountTotal?: number;
  items: Record<string, { qty: number; revenue: number }>;
  orders: Order[];
  startingCash?: number;
  paidInTotal?: number;
  paidOutTotal?: number;
  countedCash?: number | null;
  expectedCash?: number;
  cashDiff?: number | null;
};

type ShiftReport = {
  _id: string;
  dayKey: string;
  shiftLabel: string;
  openedBy?: string | null;
  openedAt: string;
  closedAt: string;
  revenue: number;
  orderCount: number;
  cancelledCount: number;
  cashRev: number;
  gcashRev: number;
  startingCash: number;
  countedCash: number | null;
  cashDiff: number | null;
  items: Record<string, { qty: number; revenue: number }>;
  paidInTotal?: number;
  paidOutTotal?: number;
  discountTotal?: number;
};

type Tab =
  | "orders"
  | "menu"
  | "analytics"
  | "crew"
  | "board"
  | "vouchers"
  | "discounts"
  | "accounts";
type Role = "admin" | "staff" | null;

type Account = {
  _id: string;
  username: string;
  displayName: string;
  role: "admin" | "staff";
  createdAt: string;
};

const INITIAL_POSTS: Post[] = [];

const TAG_STYLES: Record<Tag, { bg: string; color: string; label: string }> = {
  PINNED: {
    bg: "#d4a843",
    color: "#0b150b",
    label: "PINNED",
  },
  PROMO: {
    bg: "rgba(212,168,67,0.18)",
    color: "#d4a843",
    label: "✦ PROMO",
  },
  EVENT: {
    bg: "rgba(100,180,120,0.14)",
    color: "#7ecb93",
    label: "◉ EVENT",
  },
  UPDATE: {
    bg: "rgba(232,213,163,0.08)",
    color: "rgba(232,213,163,0.55)",
    label: "↑ UPDATE",
  },
};

const PIN_COLORS: Record<PinColor, string> = {
  gold: "#d4a843",
  red: "#c0504d",
  teal: "#4caf8a",
};

const STATUS_CFG: Record<
  OrderStatus,
  { label: string; color: string; next?: OrderStatus }
> = {
  pending: { label: "Pending", color: "#d4a843", next: "confirmed" },
  confirmed: { label: "Confirmed", color: "#5b9bd5", next: "preparing" },
  preparing: { label: "Preparing", color: "#a855f7", next: "ready" },
  ready: { label: "Ready", color: "#22c55e", next: "completed" },
  completed: { label: "Completed", color: "#6b7280" },
  cancelled: { label: "Cancelled", color: "#ef4444" },
};

const MILK_SUBS = [
  { label: "Regular Milk", price: 0 },
  { label: "Oat Milk", price: 50 },
];
const BASE_SUBS = [
  { label: "Coffee", price: 0 },
  { label: "Matcha", price: 50 },
];
const DRINK_ADDONS = [
  { label: "Add Espresso Shot", price: 30 },
  { label: "Add Syrup", price: 30 },
  { label: "Add Sauce", price: 30 },
  { label: "Add Vanilla Ice Cream", price: 30 },
];

type CrewCustomizationConfig = {
  substitutions?: { label: string; price: number }[];
  baseSubs?: { label: string; price: number }[];
  addons?: { label: string; price: number }[];
  sauces?: { name: string; image: string }[];
  eggStyles?: { name: string; image: string }[];
};

const ITEM_VARIANTS: Record<string, { label: string; price?: number }[]> = {
  longganisa: [{ label: "Garlic" }, { label: "Hamonado" }, { label: "Mixed" }],
  tapa: [{ label: "Chicken" }, { label: "Beef" }],
  ramen: [{ label: "Mild" }, { label: "Spicy" }],
  "pancake classic": [
    { label: "Classic 2pcs", price: 40 },
    { label: "Classic 4pcs", price: 70 },
  ],
  "pancake caramel": [
    { label: "Caramel 2pcs", price: 65 },
    { label: "Caramel 4pcs", price: 100 },
  ],
  "pancake biscoff": [
    { label: "Biscoff 2 pcs", price: 80 },
    { label: "Biscoff 4pcs", price: 125 },
  ],
};

function getCrewCustomizations(
  category: string,
  itemName?: string,
  liveSauces?: { name: string; image: string }[],
  liveEggStyles?: { name: string; image: string }[],
  liveMilkSubs?: { label: string; price: number }[],
  liveBaseSubs?: { label: string; price: number }[],
): CrewCustomizationConfig | null {
  const c = category.toLowerCase().trim();
  const n = (itemName || "").toLowerCase();

  // If "Substitutions" menu items exist for milk/base, they are the source
  // of truth — hiding "Oatmilk Substitution" (etc.) as a menu item now
  // hides it everywhere it's offered as an option. undefined (no such
  // items created yet) falls back to the old hardcoded lists.
  const effMilk: { label: string; price: number }[] =
    liveMilkSubs !== undefined
      ? [{ label: "Regular Milk", price: 0 }, ...liveMilkSubs]
      : MILK_SUBS;
  const effBase: { label: string; price: number }[] =
    liveBaseSubs !== undefined
      ? [{ label: "Coffee", price: 0 }, ...liveBaseSubs]
      : BASE_SUBS;

  if (n.includes("americano")) return { addons: DRINK_ADDONS };
  if (n.includes("orange")) return { addons: DRINK_ADDONS };

  if (c.includes("3rd space"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  if (c.includes("coffee"))
    return {
      substitutions: effMilk,
      baseSubs: effBase,
      addons: DRINK_ADDONS,
    };
  if (c.includes("brain fuel")) return { addons: DRINK_ADDONS };
  if (c.includes("oat")) return { addons: DRINK_ADDONS };
  if (c.includes("flavored soda")) return { addons: DRINK_ADDONS };
  if (c.includes("matcha"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  if (c.includes("non"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  if (c.includes("tea"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  if (c.includes("house plate"))
    return {
      addons: [
        { label: "Add Rice", price: 25 },
        { label: "Add Egg", price: 15 },
      ],
    };
  if (c.includes("noodle") || c.includes("soup"))
    return {
      addons: [
        { label: "Add Egg", price: 15 },
        { label: "Add Extra Toppings", price: 25 },
      ],
    };
  if (c.includes("pasta"))
    return { addons: [{ label: "Add Rice", price: 25 }] };
  if (c.includes("appetizer") || c.includes("snack"))
    return {
      sauces:
        liveSauces && liveSauces.length > 0
          ? liveSauces
          : [
              "Garlic Mayo",
              "Ketchup",
              "Sweet Chili",
              "Honey Mustard",
              "Toyo Calamansi",
              "Vinegar",
              "Tonkatsu Sauce",
            ].map((name) => ({ name, image: "" })),
      addons: [{ label: "Extra Serving", price: 30 }],
    };
  if (c.includes("savory"))
    return {
      eggStyles:
        liveEggStyles && liveEggStyles.length > 0
          ? liveEggStyles
          : [
              "Sunny Side Up",
              "Over Easy",
              "Over Hard",
              "Soft Scramble",
              "Hard Scramble",
              "Soft Boiled",
              "Hard Boiled",
            ].map((name) => ({ name, image: "" })),
      addons: [
        { label: "Add Sauce", price: 15 },
        { label: "Add Egg", price: 15 },
        { label: "Add Rice", price: 25 },
      ],
    };
  return null;
}

function deriveLegacyOptions(item: {
  name?: string;
  category?: string;
  variants?: string[];
}): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const nameKey = (item.name || "").toLowerCase();
  const nameVariants = Object.entries(ITEM_VARIANTS).find(([k]) =>
    nameKey.includes(k),
  )?.[1];
  const effectiveVariants =
    item.variants && item.variants.length > 0
      ? item.variants.map((v) => ({ label: v, price: 0 }))
      : nameVariants;
  if (effectiveVariants && effectiveVariants.length > 0) {
    groups.push({
      name: "Variant",
      type: "single",
      required: true,
      choices: effectiveVariants.map((v) => ({
        label: v.label,
        price: v.price || 0,
      })),
    });
  }
  const config = getCrewCustomizations(item.category || "", item.name);
  if (config?.substitutions)
    groups.push({
      name: "Milk",
      type: "single",
      choices: config.substitutions,
    });
  if (config?.baseSubs)
    groups.push({ name: "Base", type: "single", choices: config.baseSubs });
  if (config?.eggStyles)
    groups.push({
      name: "Egg Style",
      type: "single",
      choices: config.eggStyles.map((e) => ({ label: e.name, price: 0 })),
    });
  if (config?.sauces)
    groups.push({
      name: "Sauce",
      type: "multi",
      max: 2,
      choices: config.sauces.map((s) => ({ label: s.name, price: 0 })),
    });
  if (config?.addons)
    groups.push({ name: "Add-Ons", type: "multi", choices: config.addons });
  return groups;
}

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}
function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function PinDot({ color = "gold" }: { color?: PinColor }) {
  const c = PIN_COLORS[color];
  return (
    <div
      style={{
        position: "absolute",
        top: -9,
        left: "50%",
        transform: "translateX(-50%)",
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, #fff8, transparent 60%), ${c}`,
        boxShadow: `0 2px 8px rgba(0,0,0,0.7), 0 0 0 2px rgba(0,0,0,0.3)`,
        zIndex: 10,
        flexShrink: 0,
      }}
    />
  );
}

function BoardPostCard({
  post,
  onDelete,
  isAdmin,
}: {
  post: Post;
  onDelete?: (id: number) => void;
  isAdmin: boolean;
}) {
  const tag = TAG_STYLES[post.tag];
  const tilt = post.tilt ?? 0;
  const fontSizeTitle =
    post.size === "lg"
      ? "clamp(1.25rem, 2.8vw, 1.9rem)"
      : post.size === "sm"
        ? "clamp(0.95rem, 1.8vw, 1.2rem)"
        : "clamp(1.05rem, 2.2vw, 1.5rem)";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: post.pinned
          ? "linear-gradient(160deg, rgba(212,168,67,0.07) 0%, rgba(15,26,15,0.98) 60%)"
          : "rgba(15,26,15,0.97)",
        border: `1px solid ${post.pinned ? "rgba(212,168,67,0.28)" : T.border}`,
        padding: "clamp(1.2rem, 2.5vw, 1.6rem)",
        paddingTop: "clamp(2rem, 3.5vw, 2.4rem)",
        transform: `rotate(${tilt}deg)`,
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
        breakInside: "avoid",
        marginBottom: "clamp(0.75rem, 2vw, 1.25rem)",
        marginTop: 14,
        overflow: "visible",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "rotate(0deg) translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = `rotate(${tilt}deg)`;
      }}
    >
      <PinDot color={post.pinColor ?? "gold"} />
      {post.image && (
        <div
          style={{
            margin: "0 -clamp(1.2rem, 2.5vw, 1.6rem) 0.75rem",
            marginTop: "-clamp(1.6rem, 3vw, 2rem)",
            overflow: "hidden",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <img
            src={post.image}
            alt={post.title}
            style={{
              width: "100%",
              display: "block",
              objectFit: "contain",
            }}
          />
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.6rem",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "'Cinzel',serif",
            fontWeight: 700,
            fontSize: "0.65rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            padding: "3px 10px",
            background: tag.bg,
            color: tag.color,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {post.tag === "PINNED" && <Pin size={10} />}
          {tag.label}
        </span>
        <span
          style={{
            fontSize: "0.65rem",
            color: "rgba(232,213,163,0.28)",
            letterSpacing: "0.06em",
          }}
        >
          {post.date}
        </span>
      </div>
      <h3
        style={{
          fontFamily: "'Cinzel',serif",
          fontWeight: 700,
          fontSize: fontSizeTitle,
          color: T.cream,
          lineHeight: 1.15,
          margin: "0 0 0.55rem",
        }}
      >
        {post.title}
      </h3>
      <p
        style={{
          fontSize: "0.875rem",
          color: T.muted,
          lineHeight: 1.65,
          margin: 0,
          flex: 1,
          whiteSpace: "pre-wrap",
        }}
      >
        {post.body}
      </p>

      {post.link && (
        <a
          href={post.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: "0.75rem",
            fontSize: "0.7rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.gold,
            textDecoration: "none",
            border: "1px solid rgba(212,168,67,0.35)",
            padding: "6px 14px",
            background: "rgba(212,168,67,0.07)",
            borderRadius: 4,
          }}
        >
          ↗ Visit Link
        </a>
      )}

      {isAdmin && onDelete && (
        <button
          onClick={() => onDelete(post.id)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(192,80,77,0.1)",
            border: "1px solid rgba(192,80,77,0.25)",
            color: "#c0504d",
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 13,
            borderRadius: 2,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function BoardPostModal({
  onPost,
  onClose,
}: {
  onPost: (post: Omit<Post, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<Tag>("UPDATE");
  const [pinColor, setPinColor] = useState<PinColor>("gold");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [pinned, setPinned] = useState(false);
  const [image, setImage] = useState("");
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    const tilt = Math.random() * 2.4 - 1.2;
    const date = new Date().toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
    setPosting(true);
    setPostErr("");
    try {
      await onPost({
        tag,
        pinned,
        pinColor,
        date,
        title,
        body,
        image: image || undefined,
        link: link || undefined,
        tilt,
        size,
      });
      onClose();
    } catch (err) {
      console.error("[BoardPostModal] post failed", err);
      setPostErr("Failed to post — check your connection and try again.");
    } finally {
      setPosting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(232,213,163,0.04)",
    border: `1px solid ${T.borderH}`,
    color: T.cream,
    fontSize: "0.875rem",
    padding: "0.65rem 0.9rem",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: 1.5,
    borderRadius: 8,
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#0f1a0f",
          border: `1px solid ${T.borderH}`,
          padding: "2rem",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              fontSize: "1.5rem",
              color: T.cream,
            }}
          >
            Post to The Board
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: T.muted,
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <span
            style={{
              color: T.muted,
              fontSize: "0.68rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            Category
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["PROMO", "EVENT", "UPDATE", "PINNED"] as Tag[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTag(t);
                  setPinned(t === "PINNED");
                }}
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 700,
                  fontSize: "0.66rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  padding: "5px 14px",
                  border: `1px solid ${tag === t ? T.gold : T.border}`,
                  background:
                    tag === t ? "rgba(212,168,67,0.18)" : "transparent",
                  color: tag === t ? T.gold : T.muted,
                  cursor: "pointer",
                  borderRadius: 6,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <span
            style={{
              color: T.muted,
              fontSize: "0.68rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            Pin Color
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            {(["gold", "red", "teal"] as PinColor[]).map((c) => (
              <button
                key={c}
                onClick={() => setPinColor(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: PIN_COLORS[c],
                  border:
                    pinColor === c
                      ? `2px solid ${T.cream}`
                      : "2px solid transparent",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              color: T.muted,
              fontSize: "0.68rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekend Deals Are Back"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              color: T.muted,
              fontSize: "0.68rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's the announcement?"
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        {/* Image upload */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              color: T.muted,
              fontSize: "0.68rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            Image (optional)
          </label>
          {image && (
            <div
              style={{
                position: "relative",
                marginBottom: "0.5rem",
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${T.borderH}`,
              }}
            >
              <img
                src={image}
                alt="preview"
                style={{
                  width: "100%",
                  maxHeight: 140,
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <button
                onClick={() => setImage("")}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  background: "rgba(0,0,0,0.6)",
                  border: `1px solid ${T.border}`,
                  color: T.cream,
                  width: 26,
                  height: 26,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 14px",
              border: `1px dashed ${uploading ? T.gold : T.borderH}`,
              borderRadius: 8,
              cursor: uploading ? "wait" : "pointer",
              background: uploading
                ? "rgba(212,168,67,0.06)"
                : "rgba(212,168,67,0.03)",
              color: uploading ? T.gold : T.muted,
              fontSize: 12,
            }}
          >
            {uploading
              ? "Uploading…"
              : image
                ? "Replace image"
                : "Upload image"}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const toSend =
                    file.size > 1_200_000 ? await compressImage(file) : file;
                  const fd = new FormData();
                  fd.append("file", toSend);
                  const res = await fetch("/api/upload", {
                    method: "POST",
                    body: fd,
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setImage(data.url);
                  } else {
                    const errText = await res.text().catch(() => "");
                    console.error(
                      "[BoardPostModal] upload failed",
                      res.status,
                      errText,
                    );
                    alert(
                      res.status === 413
                        ? "Image is too large — try a smaller photo."
                        : `Image upload failed (${res.status}). Check console for details.`,
                    );
                  }
                } catch (err) {
                  console.error("[BoardPostModal] upload network error", err);
                  alert("Image upload failed — network error.");
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              color: T.muted,
              fontSize: "0.68rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
              display: "block",
              marginBottom: "0.4rem",
            }}
          >
            Link (optional)
          </label>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        {postErr && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "rgba(239,68,68,0.85)",
              fontSize: 12,
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "9px 12px",
              marginBottom: "0.75rem",
            }}
          >
            <AlertCircle size={13} /> {postErr}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !body.trim() || uploading || posting}
          style={{
            width: "100%",
            fontFamily: "'Cinzel',serif",
            fontWeight: 700,
            fontSize: "0.95rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            background:
              title.trim() && body.trim() ? T.gold : "rgba(212,168,67,0.15)",
            color: title.trim() && body.trim() ? "#0a0f0a" : T.muted,
            border: "none",
            padding: "0.85rem",
            cursor:
              title.trim() && body.trim() && !posting
                ? "pointer"
                : "not-allowed",
            borderRadius: 10,
          }}
        >
          {posting ? "Posting…" : "Pin It to The Board"}
        </button>
      </div>
    </div>
  );
}

function BoardTab({
  posts,
  setPosts,
}: {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data) => setPosts(data.map((p: any) => ({ ...p, id: p._id }))));
  }, []);

  const handleNewPost = async (postData: Omit<Post, "id">) => {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postData),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[BoardTab.handleNewPost] failed", res.status, errText);
      throw new Error(`Failed to create post (${res.status})`);
    }
    const saved = await res.json();
    setPosts((prev) => [{ ...saved, id: saved._id }, ...prev]);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {showModal && (
        <BoardPostModal
          onPost={handleNewPost}
          onClose={() => setShowModal(false)}
        />
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <p style={{ color: T.muted, fontSize: 12 }}>{posts.length} posts</p>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "8px 16px",
            background: T.gold,
            border: "none",
            borderRadius: 8,
            color: "#0a0f0a",
            fontFamily: "'Cinzel',serif",
            fontSize: 11,
            letterSpacing: ".1em",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={13} /> NEW POST
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
          paddingTop: 14,
          alignItems: "start",
        }}
      >
        {posts.map((post) => (
          <BoardPostCard
            key={post.id}
            post={post}
            isAdmin={true}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ── IMAGE LIGHTBOX ───────────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(4px)",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: "rgba(255,255,255,0.1)",
          border: `1px solid ${T.border}`,
          borderRadius: "50%",
          width: 40,
          height: 40,
          color: T.cream,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        <X size={18} />
      </button>
      <img
        src={src}
        alt="Receipt"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "88vh",
          objectFit: "contain",
          borderRadius: 12,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          border: `1px solid ${T.border}`,
        }}
      />
    </div>
  );
}

// ── CONFIRM MODAL ────────────────────────────────────────────────────────────
function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  danger = true,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${danger ? "rgba(239,68,68,0.4)" : T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,36px) clamp(16px,4vw,32px)",
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {danger ? (
            <Trash2 size={36} color={T.red} />
          ) : (
            <AlertCircle size={36} color={T.gold} />
          )}
        </div>
        <p
          style={{
            color: T.cream,
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 28,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onConfirm}
            style={{
              padding: "11px 28px",
              background: danger ? "rgba(239,68,68,0.12)" : T.goldDim,
              border: `1px solid ${danger ? "rgba(239,68,68,0.5)" : T.gold}`,
              borderRadius: 10,
              color: danger ? T.red : T.gold,
              fontFamily: "'Cinzel',serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              cursor: "pointer",
            }}
          >
            {danger ? "DELETE" : "CONFIRM"}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "11px 28px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ status }: { status: OrderStatus }) {
  const { label, color } = STATUS_CFG[status];
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  const c = accent || T.gold;
  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "border-color .2s",
      }}
      className="stat-card"
    >
      <div>
        <p
          style={{
            color: T.muted,
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            fontFamily: "'Cinzel',serif",
            marginBottom: 8,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "'Cinzel',serif",
            fontSize: 22,
            fontWeight: 700,
            color: c,
          }}
        >
          {value}
        </p>
      </div>
      <div style={{ color: c, opacity: 0.7 }}>{icon}</div>
    </div>
  );
}

function CancelReasonModal({
  onConfirm,
  onCancel,
  title = "CANCEL ORDER",
  subtitle = "Select a reason for cancellation",
  reasons,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  reasons?: string[];
}) {
  const [selected, setSelected] = useState("");
  const [other, setOther] = useState("");

  const REASONS = reasons || [
    "Item no longer available",
    "Customer request",
    "Duplicate order",
    "Payment not received",
    "Out of delivery range",
    "Other",
  ];

  const finalReason = selected === "Other" ? other.trim() : selected;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 18,
          padding: "clamp(16px,3.5vw,28px) clamp(14px,3vw,24px)",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.cream,
              fontSize: 14,
              letterSpacing: ".1em",
              marginBottom: 4,
            }}
          >
            {title}
          </p>
          <p style={{ color: T.muted, fontSize: 12 }}>{subtitle}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
                background:
                  selected === r
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${selected === r ? "rgba(239,68,68,0.5)" : T.border}`,
                color: selected === r ? T.red : T.muted,
                fontWeight: selected === r ? 700 : 400,
                transition: "all .15s",
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {selected === "Other" && (
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Describe the reason…"
            rows={3}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.borderH}`,
              borderRadius: 8,
              padding: "10px 12px",
              color: T.cream,
              fontSize: 13,
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => finalReason && onConfirm(finalReason)}
            disabled={!finalReason}
            style={{
              flex: 1,
              padding: "11px",
              background: finalReason
                ? "rgba(239,68,68,0.12)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${finalReason ? "rgba(239,68,68,0.5)" : T.border}`,
              borderRadius: 10,
              color: finalReason ? T.red : T.muted,
              fontFamily: "'Cinzel',serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              cursor: finalReason ? "pointer" : "not-allowed",
            }}
          >
            CANCEL ORDER
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "11px 18px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CASH REGISTER MODAL ──────────────────────────────────────────────────────
function CashRegisterModal({
  total,
  orderNumber,
  onConfirm,
  onCancel,
}: {
  total: number;
  orderNumber: string;
  onConfirm: (cashReceived: number, change: number) => void;
  onCancel: () => void;
}) {
  const [cashInput, setCashInput] = useState("");
  const cashReceived = parseFloat(cashInput) || 0;
  const change = cashReceived - total;
  const valid = cashReceived >= total;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  const QUICK_AMOUNTS = Array.from(
    new Set([
      total,
      ...[20, 50, 100, 200, 500, 1000].filter((v) => v >= total),
    ]),
  ).slice(0, 5);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Banknote
            size={32}
            color={T.green}
            style={{ margin: "0 auto 8px" }}
          />
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.cream,
              fontSize: 14,
              letterSpacing: ".1em",
              marginBottom: 2,
            }}
          >
            CASH REGISTER
          </p>
          <p style={{ color: T.muted, fontSize: 12 }}>Order #{orderNumber}</p>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: T.muted, fontSize: 12 }}>Amount Due</span>
          <span
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.gold,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {fmt(total)}
          </span>
        </div>

        <div>
          <label
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              display: "block",
              marginBottom: 6,
            }}
          >
            CASH RECEIVED
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={cashInput}
            onChange={(e) => setCashInput(e.target.value)}
            placeholder="0.00"
            autoFocus
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.borderH}`,
              borderRadius: 10,
              padding: "12px 14px",
              color: T.cream,
              fontSize: 22,
              fontFamily: "'Cinzel',serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => setCashInput(String(amt))}
              style={{
                flex: "1 1 60px",
                padding: "7px 8px",
                borderRadius: 8,
                background: "rgba(212,168,67,0.08)",
                border: `1px solid ${T.border}`,
                color: T.gold,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {amt === total ? "EXACT" : `₱${amt}`}
            </button>
          ))}
        </div>

        <div
          style={{
            background: valid
              ? "rgba(34,197,94,0.08)"
              : "rgba(255,255,255,0.02)",
            border: `1px solid ${valid ? "rgba(34,197,94,0.3)" : T.border}`,
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: T.muted, fontSize: 12 }}>Change</span>
          <span
            style={{
              fontFamily: "'Cinzel',serif",
              color: valid ? T.green : T.muted,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {fmt(Math.max(change, 0))}
          </span>
        </div>

        {cashInput !== "" && !valid && (
          <p style={{ color: T.red, fontSize: 12, textAlign: "center" }}>
            Cash received is less than the amount due.
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => valid && onConfirm(cashReceived, change)}
            disabled={!valid}
            style={{
              flex: 1,
              padding: "12px",
              background: valid ? T.green : "rgba(34,197,94,0.15)",
              border: `1px solid ${valid ? T.green : T.border}`,
              borderRadius: 10,
              color: valid ? "#0a0f0a" : T.muted,
              fontFamily: "'Cinzel',serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            CONFIRM & PRINT
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "12px 18px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveryMapPanel({
  details,
  orderId,
}: {
  details: NonNullable<Order["deliveryAddressDetails"]>;
  orderId: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [riderName, setRiderName] = useState<string | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);

  // Subscribe to rider location SSE
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/location`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.type === "location") {
          setRiderPos({ lat: data.lat, lng: data.lng });
          if (data.riderName) setRiderName(data.riderName);
        } else if (
          data.type === "stopped" ||
          data.type === "waiting" ||
          !data.type
        ) {
          setRiderPos(null);
          setRiderName(null);
        }
      } catch {}
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId]);

  // Update rider marker when position changes
  useEffect(() => {
    if (!riderPos || !mapObjRef.current || !(window as any).L) return;
    const L = (window as any).L;
    if (!riderMarkerRef.current) {
      const icon = L.divIcon({
        html: `<div style="
          width:36px;height:36px;
          background:#d4a843;
          border-radius:50%;
          border:3px solid white;
          box-shadow:0 0 14px rgba(212,168,67,0.8);
          display:flex;align-items:center;justify-content:center;
        "><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></div>`,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      riderMarkerRef.current = L.marker([riderPos.lat, riderPos.lng], { icon })
        .addTo(mapObjRef.current)
        .bindPopup(riderName ? `Rider: ${riderName}` : "Rider");
    } else {
      riderMarkerRef.current.setLatLng([riderPos.lat, riderPos.lng]);
      mapObjRef.current.panTo([riderPos.lat, riderPos.lng], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [riderPos]);

  const lat = details?.lat;
  const lng = details?.lng;

  const CAFE_LAT = 15.461629;
  const CAFE_LNG = 120.9492521;

  useEffect(() => {
    if (!lat || !lng) return;

    function initMap(L: any) {
      if (!mapRef.current || mapObjRef.current) return;
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;
          background:${T.gold};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid white;
          box-shadow:0 4px 12px rgba(0,0,0,0.5);
        "><div style="
          transform:rotate(45deg);
          width:7px;height:7px;
          background:white;
          border-radius:50%;
          margin:7px auto 0;
        "></div></div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      L.marker([lat, lng], { icon }).addTo(map);

      // Café marker
      L.circleMarker([CAFE_LAT, CAFE_LNG], {
        radius: 7,
        fillColor: "#d4a843",
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      })
        .bindTooltip("3rd Space", { permanent: false })
        .addTo(map);

      // Draw route
      fetch(
        `https://router.project-osrm.org/route/v1/driving/${CAFE_LNG},${CAFE_LAT};${lng},${lat}?overview=full&geometries=geojson`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.routes?.[0] && mapObjRef.current) {
            const routeLayer = L.geoJSON(data.routes[0].geometry, {
              style: { color: "#4ade80", weight: 4, opacity: 0.75 },
            }).addTo(mapObjRef.current);
            const km = (data.routes[0].distance / 1000).toFixed(1);
            const mins = Math.round(data.routes[0].duration / 60);
            setRouteDistance(`${km} km · ~${mins} min by road`);
            mapObjRef.current.fitBounds(routeLayer.getBounds(), {
              padding: [30, 30],
            });
          }
        })
        .catch(() => {});

      mapObjRef.current = map;
      setReady(true);
    }

    if ((window as any).L) {
      initMap((window as any).L);
      return;
    }

    if (!document.querySelector('link[href*="leaflet"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => initMap((window as any).L);
    document.head.appendChild(script);

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
    };
  }, [lat, lng]);

  if (!lat || !lng) return null;

  const rows = [
    { label: "House / Unit", value: details.houseNo },
    { label: "Street", value: details.street },
    { label: "Barangay", value: details.barangay },
    { label: "City", value: details.city },
    { label: "Landmark", value: details.landmark },
  ].filter((r) => r.value?.trim());

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        overflow: "hidden",
        marginTop: 2,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box" as const,
      }}
    >
      <div
        className="dash-map"
        style={{
          position: "relative",
          height: "clamp(150px, 28vw, 220px)",
          width: "100%",
          overflow: "hidden",
        }}
      >
        <div
          ref={mapRef}
          style={{ width: "100%", height: "100%", zIndex: 0 }}
        />
        {!ready && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(10,15,10,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: T.muted,
              fontSize: 12,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                border: `2px solid ${T.gold}`,
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin .7s linear infinite",
              }}
            />
            Loading map…
          </div>
        )}
        {ready && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              background: "rgba(10,15,10,0.82)",
              backdropFilter: "blur(4px)",
              borderRadius: 6,
              padding: "3px 8px",
              zIndex: 998,
            }}
          >
            <span
              style={{ color: T.muted, fontSize: 10, fontFamily: "monospace" }}
            >
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          </div>
        )}
      </div>

      {(routeDistance || riderPos) && (
        <div
          style={{
            padding: "8px 14px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {routeDistance && (
            <span
              style={{
                color: "#4ade80",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Navigation size={12} /> {routeDistance}
            </span>
          )}
          {riderPos && (
            <span
              style={{
                fontSize: 11,
                color: "#d4a843",
                background: "rgba(212,168,67,0.1)",
                border: "1px solid rgba(212,168,67,0.3)",
                borderRadius: 6,
                padding: "3px 10px",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 6px rgba(74,222,128,0.8)",
                  display: "inline-block",
                }}
              />
              {riderName ? `${riderName} is riding` : "Rider live"}
            </span>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ padding: "10px 14px" }}>
          <p
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              fontFamily: "'Cinzel',serif",
              marginBottom: 8,
            }}
          >
            PINNED ADDRESS DETAILS
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {rows.map((r) => (
              <div
                key={r.label}
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    color: T.muted,
                    fontSize: 11,
                    minWidth: 90,
                    flexShrink: 0,
                  }}
                >
                  {r.label}
                </span>
                <span
                  style={{
                    color: T.cream,
                    fontSize: 11,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}
          >
            <button
              onClick={() =>
                window.open(
                  `https://www.google.com/maps?q=${lat},${lng}`,
                  "_blank",
                )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: T.blue,
                background: "rgba(91,155,213,0.08)",
                border: "1px solid rgba(91,155,213,0.2)",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              <MapPin size={11} /> Open in Maps
            </button>
            <button
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&origin=${CAFE_LAT},${CAFE_LNG}&destination=${lat},${lng}&travelmode=driving`,
                  "_blank",
                )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: "#0a0f0a",
                background: T.gold,
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontFamily: "'Cinzel',serif",
                letterSpacing: ".06em",
                cursor: "pointer",
              }}
            >
              <Navigation size={12} /> NAVIGATE TO CUSTOMER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RIDER TRACKING BUTTON ────────────────────────────────────────────────────
// Paste this component somewhere ABOVE the OrderCard function in dashboard/page.tsx

function RiderTrackingButton({
  orderId,
  orderNumber,
  riderName,
}: {
  orderId: string;
  orderNumber: string;
  riderName: string;
}) {
  const [tracking, setTracking] = useState(false);
  const [activeRider, setActiveRider] = useState<string | null>(null);
  const [error, setError] = useState("");
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/location`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.type === "location" && data.riderName) {
          setActiveRider(data.riderName);
        } else if (
          data.type === "stopped" ||
          data.type === "waiting" ||
          !data.type
        ) {
          setActiveRider(null);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId]);

  const pushLocation = async (lat: number, lng: number) => {
    try {
      await fetch(`/api/orders/${orderId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, riderName }),
      });
    } catch {}
  };

  // 3rd Space fixed coordinates — update these to the actual café location
  const CAFE_LAT = 15.461629;
  const CAFE_LNG = 120.9492521;

  function startTracking() {
    setError("");
    setTracking(true);
    pushLocation(CAFE_LAT, CAFE_LNG);
    // Push every 30s to keep the location "alive" on the customer's map
    watchIdRef.current = window.setInterval(() => {
      pushLocation(CAFE_LAT, CAFE_LNG);
    }, 30000) as unknown as number;
  }

  async function stopTracking() {
    if (watchIdRef.current !== null) {
      clearInterval(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    try {
      await fetch(`/api/orders/${orderId}/location`, { method: "DELETE" });
    } catch {}
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const someoneElseTracking =
    activeRider && activeRider !== riderName && !tracking;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 8,
      }}
    >
      {someoneElseTracking ? (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(212,168,67,0.08)",
            border: "1px solid rgba(212,168,67,0.3)",
            borderRadius: 8,
            fontSize: 12,
            color: "#d4a843",
            textAlign: "center",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <MapPin size={13} /> {activeRider} is currently tracking this order
        </div>
      ) : (
        <button
          onClick={tracking ? stopTracking : startTracking}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: tracking
              ? "rgba(239,68,68,0.12)"
              : "rgba(212,168,67,0.12)",
            border: `1px solid ${tracking ? "rgba(239,68,68,0.4)" : "rgba(212,168,67,0.4)"}`,
            color: tracking ? T.red : T.gold,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Cinzel',serif",
            letterSpacing: ".06em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {tracking ? (
            <>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: T.red,
                  boxShadow: "0 0 6px rgba(239,68,68,0.8)",
                  animation: "pulse-track 1s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
              STOP TRACKING · #{orderNumber}
            </>
          ) : (
            <>
              <Navigation size={13} /> START RIDER TRACKING
            </>
          )}
        </button>
      )}
      {!someoneElseTracking && tracking && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ color: T.muted, fontSize: 11, textAlign: "center" }}>
            Broadcasting your location · Customer can see you live
          </p>
          <button
            onClick={async () => {
              await stopTracking();
              try {
                await fetch(`/api/orders/${orderId}/location`, {
                  method: "DELETE",
                });
              } catch {}
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(74,222,128,0.12)",
              border: "1px solid rgba(74,222,128,0.4)",
              color: "#4ade80",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Cinzel',serif",
              letterSpacing: ".06em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Check size={13} /> I'M HERE — ARRIVED AT CUSTOMER
          </button>
        </div>
      )}
      {error && (
        <p style={{ color: T.red, fontSize: 11, textAlign: "center" }}>
          {error}
        </p>
      )}
      <style>{`@keyframes pulse-track{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── EDIT ORDER ITEMS MODAL ───────────────────────────────────────────────────
function EditOrderItemsModal({
  order,
  menuItems,
  onSave,
  onClose,
}: {
  order: Order;
  menuItems: MenuItem[];
  onSave: (items: OrderItem[], total: number) => Promise<void> | void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<OrderItem[]>(() =>
    order.items.map((it) => ({ ...it })),
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const deliveryFee = (order as any).deliveryFee || 0;
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const total = subtotal + deliveryFee;

  function updateQty(idx: number, qty: number) {
    if (qty <= 0) {
      setItems((p) => p.filter((_, i) => i !== idx));
      return;
    }
    setItems((p) =>
      p.map((it, i) => (i === idx ? { ...it, quantity: qty } : it)),
    );
  }
  function removeItem(idx: number) {
    setItems((p) => p.filter((_, i) => i !== idx));
  }
  function addMenuItem(mi: MenuItem) {
    setItems((p) => {
      const existingIdx = p.findIndex((it) => it.name === mi.name);
      if (existingIdx >= 0) {
        return p.map((it, i) =>
          i === existingIdx ? { ...it, quantity: it.quantity + 1 } : it,
        );
      }
      return [...p, { name: mi.name, price: mi.price, quantity: 1 }];
    });
    setSearch("");
  }
  // Quick-add a generic charge (e.g. a delivery fee for a takeout order
  // that turned into a delivery). "Others" isn't a real menu product, so
  // instead of a fixed price ladder, staff build their own list of go-to
  // amounts once (typed + saved), then just tap a button after that —
  // no retyping every time. The list persists in localStorage per device,
  // and staff can remove any preset they no longer want.
  // Shared across the whole store (DB-backed, not per-browser) — anyone
  // editing an order sees the same set of quick-add "Others" amounts,
  // and it survives clearing browser data / switching devices.
  const [othersPresets, setOthersPresets] = useState<number[]>([]);
  const [othersInput, setOthersInput] = useState("");
  const [othersManaging, setOthersManaging] = useState(false);

  useEffect(() => {
    fetch("/api/others-presets")
      .then((r) => r.json())
      .then((d) => setOthersPresets(d.amounts || []))
      .catch(() => {});
  }, []);

  async function savePresets(next: number[]) {
    setOthersPresets(next);
    try {
      await fetch("/api/others-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amounts: next }),
      });
    } catch {}
  }
  function addOthersPreset() {
    const price = parseFloat(othersInput);
    if (!price || price <= 0) return;
    if (!othersPresets.includes(price)) {
      savePresets([...othersPresets, price].sort((a, b) => a - b));
    }
    setOthersInput("");
  }
  function removeOthersPreset(price: number) {
    savePresets(othersPresets.filter((p) => p !== price));
  }
  function addOthersItem(price: number) {
    setItems((p) => [...p, { name: "Others", price, quantity: 1 }]);
  }
  // In Manage mode, tapping a preset edits its value in place instead of
  // deleting it — retype the amount and it swaps out, keeping the same
  // slot in the (sorted) list rather than deleting + re-adding at the end.
  const [editingPreset, setEditingPreset] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  function startEditPreset(price: number) {
    setEditingPreset(price);
    setEditingValue(String(price));
  }
  function commitEditPreset(oldPrice: number) {
    const newPrice = parseFloat(editingValue);
    setEditingPreset(null);
    if (!newPrice || newPrice <= 0 || newPrice === oldPrice) return;
    const next = othersPresets
      .filter((p) => p !== oldPrice)
      .concat(newPrice)
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .sort((a, b) => a - b);
    savePresets(next);
  }

  const filteredMenu = search.trim()
    ? menuItems
        .filter(
          (m) =>
            m.available && m.name.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  async function handleSave() {
    if (items.length === 0) {
      alert("Order must have at least one item. Cancel the order instead.");
      return;
    }
    setSaving(true);
    await onSave(items, total);
    setSaving(false);
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.cream,
              fontSize: 14,
              letterSpacing: ".1em",
            }}
          >
            EDIT ITEMS — #{order.orderNumber}
          </p>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: T.muted,
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    color: T.cream,
                    fontSize: 12,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.name}
                </p>
                <p style={{ color: T.gold, fontSize: 12 }}>
                  ₱{it.price.toFixed(2)} each
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => updateQty(idx, it.quantity - 1)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    border: `1px solid ${T.border}`,
                    background: "none",
                    color: T.muted,
                    cursor: "pointer",
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    width: 22,
                    textAlign: "center",
                    color: T.cream,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {it.quantity}
                </span>
                <button
                  onClick={() => updateQty(idx, it.quantity + 1)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: T.gold,
                    border: "none",
                    color: "#0a0f0a",
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>
              <button
                onClick={() => removeItem(idx)}
                title="Remove item"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: T.red,
                  borderRadius: 6,
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p
              style={{
                color: T.faint,
                fontSize: 12,
                textAlign: "center",
                padding: "10px 0",
              }}
            >
              No items left — add one below, or cancel the order instead.
            </p>
          )}
        </div>

        <div>
          <label
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              display: "block",
              marginBottom: 6,
            }}
          >
            ADD / REPLACE ITEM
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu..."
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "9px 12px",
              color: T.cream,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {filteredMenu.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginTop: 6,
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {filteredMenu.map((mi) => (
                <button
                  key={mi._id}
                  onClick={() => addMenuItem(mi)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: "rgba(255,255,255,0.02)",
                    color: T.cream,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <span>{mi.name}</span>
                  <span style={{ color: T.gold, fontWeight: 700 }}>
                    ₱{mi.price.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <label
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".1em",
              }}
            >
              OTHERS (e.g. delivery fee)
            </label>
            {othersPresets.length > 0 && (
              <button
                onClick={() => setOthersManaging((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: othersManaging ? T.gold : T.muted,
                  fontSize: 10,
                  letterSpacing: ".05em",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {othersManaging ? "Done" : "Manage"}
              </button>
            )}
          </div>

          {othersPresets.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {othersPresets.map((price) =>
                othersManaging && editingPreset === price ? (
                  <input
                    key={price}
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => commitEditPreset(price)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditPreset(price);
                      if (e.key === "Escape") setEditingPreset(null);
                    }}
                    style={{
                      width: 70,
                      padding: "7px 8px",
                      borderRadius: 8,
                      border: `1px solid ${T.gold}`,
                      background: "rgba(255,255,255,0.06)",
                      color: T.cream,
                      fontSize: 12,
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                ) : (
                  <div
                    key={price}
                    style={{ position: "relative", display: "inline-flex" }}
                  >
                    <button
                      onClick={() =>
                        othersManaging
                          ? startEditPreset(price)
                          : addOthersItem(price)
                      }
                      style={{
                        padding: othersManaging
                          ? "8px 22px 8px 12px"
                          : "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${othersManaging ? T.gold : T.border}`,
                        background: "rgba(255,255,255,0.02)",
                        color: T.cream,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      +₱{price}
                    </button>
                    {othersManaging && (
                      <span
                        onClick={() => removeOthersPreset(price)}
                        title="Remove preset"
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          background: T.red,
                          color: "#fff",
                          fontSize: 10,
                          lineHeight: "16px",
                          textAlign: "center",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              inputMode="decimal"
              value={othersInput}
              onChange={(e) => setOthersInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOthersPreset()}
              placeholder="Add new amount (₱)"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: T.cream,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={addOthersPreset}
              disabled={!othersInput || parseFloat(othersInput) <= 0}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "none",
                background:
                  othersInput && parseFloat(othersInput) > 0
                    ? T.gold
                    : "rgba(255,255,255,0.06)",
                color:
                  othersInput && parseFloat(othersInput) > 0
                    ? "#0a0f0a"
                    : T.muted,
                fontSize: 12,
                fontWeight: 700,
                cursor:
                  othersInput && parseFloat(othersInput) > 0
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              Save
            </button>
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            paddingTop: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: T.muted, fontSize: 12 }}>New Total</span>
          <span
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.gold,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            ₱{total.toFixed(2)}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            style={{
              flex: 1,
              padding: "11px",
              background: items.length > 0 ? T.green : "rgba(34,197,94,0.2)",
              border: "none",
              borderRadius: 10,
              color: items.length > 0 ? "#0a0f0a" : T.muted,
              fontFamily: "'Cinzel',serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              cursor: items.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "SAVING…" : "SAVE CHANGES"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "11px 18px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ORDER CARD ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  menuItems,
  onStatusChange,
  onPaymentConfirm,
  onCashConfirm,
  onSetPaymentMethod,
  onAdjustSplit,
  onDelete,
  onItemsUpdate,
  onApplyItemDiscount,
  onRemoveItemDiscount,
  discounts,
  staffName,
}: {
  order: Order;
  menuItems: MenuItem[];
  onStatusChange: (id: string, s: OrderStatus, reason?: string) => void;
  onPaymentConfirm: (id: string) => void;
  onCashConfirm: (
    id: string,
    cashReceived: number,
    change: number,
  ) => Promise<void> | void;
  onSetPaymentMethod: (id: string, method: "cash" | "gcash") => void;
  onAdjustSplit: (
    id: string,
    cashAmount: number,
    gcashAmount: number,
  ) => Promise<void> | void;
  onDelete: (id: string) => void;
  onItemsUpdate: (
    id: string,
    items: OrderItem[],
    total: number,
  ) => Promise<void> | void;
  onApplyItemDiscount: (
    id: string,
    itemIndex: number,
    name: string,
    pct: number,
  ) => Promise<void>;
  onRemoveItemDiscount: (id: string, itemIndex: number) => Promise<void>;
  discounts: DiscountPreset[];
  staffName: string;
}) {
  const [open, setOpen] = useState(false);
  const [receiptSrc, setReceiptSrc] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCashRegister, setShowCashRegister] = useState(false);
  const [showEditItems, setShowEditItems] = useState(false);
  const [openItemDiscountIdx, setOpenItemDiscountIdx] = useState<number | null>(
    null,
  );
  const nextStatus = STATUS_CFG[order.status].next;
  // Only mount map/tracking when card is open
  const isDeliveryOpen = open && order.type === "delivery";

  async function printReceipt(
    copies = 1,
    extra?: { cashReceived?: number; change?: number },
  ) {
    for (let i = 0; i < copies; i++) {
      const receiptBytes = await buildEscPosReceipt({
        orderNumber: order.orderNumber,
        type: order.type,
        tableNumber: order.tableNumber,
        customerName: order.customerName,
        items: order.items,
        total: order.total,
        deliveryFee: (order as any).deliveryFee,
        paymentMethod: order.paymentMethod,
        cashReceived: extra?.cashReceived,
        change: extra?.change,
      });
      const url = escPosToRawBtUrl(receiptBytes);
      openRawBtUrl(url);
      if (i < copies - 1) await new Promise((r) => setTimeout(r, 1200));
    }
  }

  // Determine what to show for payment method
  // Anything that isn't explicitly "cash" or "gcash" counts as pending —
  // this covers "pending", null, undefined, or any other stray value.
  const methodKnown =
    order.paymentMethod === "cash" ||
    order.paymentMethod === "gcash" ||
    order.paymentMethod === "split";
  const methodPending = !methodKnown;
  const isSplit = order.paymentMethod === "split";
  const splitCash = order.cashAmount ?? 0;
  const splitGcash = order.gcashAmount ?? 0;
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [splitCashInput, setSplitCashInput] = useState("");
  const [splitGcashInput, setSplitGcashInput] = useState("");

  function openSplitEditor() {
    setSplitCashInput(
      isSplit ? String(splitCash) : String(order.total.toFixed(2)),
    );
    setSplitGcashInput(isSplit ? String(splitGcash) : "0");
    setShowSplitEditor(true);
  }

  const splitInputsSum =
    (parseFloat(splitCashInput) || 0) + (parseFloat(splitGcashInput) || 0);
  const splitInputsValid =
    Math.abs(splitInputsSum - order.total) < 0.01 &&
    parseFloat(splitCashInput) >= 0 &&
    parseFloat(splitGcashInput) >= 0;

  return (
    <>
      {receiptSrc && (
        <ImageLightbox src={receiptSrc} onClose={() => setReceiptSrc(null)} />
      )}
      {showCancelModal && (
        <CancelReasonModal
          onConfirm={(reason) => {
            setShowCancelModal(false);
            onStatusChange(order._id, "cancelled", reason);
          }}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
      {showRejectModal && (
        <CancelReasonModal
          title="REJECT RECEIPT"
          subtitle="Why is this receipt invalid?"
          reasons={[
            "Fake or edited screenshot",
            "Wrong amount sent",
            "Payment not received in GCash",
            "Ref number doesn't match",
            "Screenshot is too old",
            "Other",
          ]}
          onConfirm={(reason) => {
            setShowRejectModal(false);
            onStatusChange(
              order._id,
              "cancelled",
              `Receipt rejected: ${reason}`,
            );
          }}
          onCancel={() => setShowRejectModal(false)}
        />
      )}
      {showCashRegister && (
        <CashRegisterModal
          total={isSplit ? splitCash : order.total}
          orderNumber={order.orderNumber}
          onConfirm={async (cashReceived, change) => {
            setShowCashRegister(false);
            await onCashConfirm(order._id, cashReceived, change);
            // NOTE: no separate kickCashDrawer() call here — buildEscPosReceipt()
            // already embeds the drawer-kick ESC command inside the receipt
            // bytes whenever paymentMethod is "cash". Firing a standalone
            // kickCashDrawer() AND printReceipt() back-to-back sent two
            // competing rawbt: intent URLs via window.location.href, and
            // RawBT/Android would only honor one of them — silently dropping
            // the actual receipt print while still popping the drawer.
            printReceipt(1, { cashReceived, change });
          }}
          onCancel={() => setShowCashRegister(false)}
        />
      )}
      {showEditItems && (
        <EditOrderItemsModal
          order={order}
          menuItems={menuItems}
          onClose={() => setShowEditItems(false)}
          onSave={async (items, total) => {
            await onItemsUpdate(order._id, items, total);
            setShowEditItems(false);
          }}
        />
      )}
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          overflow: "hidden",
          transition: "border-color .2s",
        }}
        className="order-card"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setOpen((v) => !v)}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              flexShrink: 0,
              background: order.type === "delivery" ? T.gold : T.green,
              boxShadow: `0 0 8px ${order.type === "delivery" ? T.gold : T.green}88`,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: T.cream,
                  letterSpacing: ".04em",
                }}
              >
                #{order.orderNumber}
              </span>
              <Badge status={order.status} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.cream,
                  background: "rgba(232,213,163,0.14)",
                  border: `1px solid ${T.border}`,
                  padding: "5px 12px",
                  borderRadius: 6,
                }}
              >
                {order.type === "delivery" ? (
                  <>
                    <Bike
                      size={14}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 4,
                      }}
                    />{" "}
                    Delivery
                  </>
                ) : order.type === "takeout" ? (
                  <>
                    <Coffee
                      size={14}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 4,
                      }}
                    />{" "}
                    Takeout
                  </>
                ) : (
                  <>
                    <Armchair
                      size={14}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 4,
                      }}
                    />{" "}
                    Dine-in
                  </>
                )}
              </span>
              {order.paymentStatus === "pending" && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#f59e0b",
                    background: "rgba(245,158,11,0.1)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  <Clock
                    size={10}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 4,
                    }}
                  />
                  Unpaid
                </span>
              )}
              {order.waiterName && (
                <span
                  style={{
                    fontSize: 11,
                    color: T.blue,
                    background: "rgba(91,155,213,0.1)",
                    border: "1px solid rgba(91,155,213,0.25)",
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  <Users
                    size={10}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 4,
                    }}
                  />
                  {order.waiterName}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
              {order.type === "delivery"
                ? order.customerName
                : order.type === "takeout"
                  ? order.customerName || "Takeout"
                  : order.tableNumber
                    ? `Table ${order.tableNumber}${order.customerName ? ` · ${order.customerName}` : ""}`
                    : order.customerName || "Walk-in"}
              {" · "}
              {fmtDate(order.createdAt)} · {ago(order.createdAt)}
            </p>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              {order.items.map((it, idx) => {
                const img = menuItems.find(
                  (m) =>
                    m.name === it.name ||
                    it.name.toLowerCase().startsWith(m.name.toLowerCase()),
                )?.image;
                if (!img) return null;
                return (
                  <div
                    key={`${it.name}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReceiptSrc(img);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      cursor: "zoom-in",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <img
                        src={img}
                        alt={it.name}
                        title={it.name}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          objectFit: "cover",
                          border: `1px solid ${T.borderH}`,
                          display: "block",
                          transition: "transform .15s, box-shadow .15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.08)";
                          e.currentTarget.style.boxShadow = `0 4px 16px rgba(212,168,67,0.35)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 8,
                          background: "rgba(212,168,67,0.0)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background .15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(212,168,67,0.15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(212,168,67,0.0)")
                        }
                      >
                        <span
                          style={{
                            fontSize: 14,
                            opacity: 0,
                            transition: "opacity .15s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "1")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "0")
                          }
                        >
                          🔍
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p
              style={{
                fontSize: 11,
                color: T.faint,
                marginTop: 3,
                lineHeight: 1.5,
              }}
            >
              {order.items
                .map((it) => `${it.quantity}× ${it.name}`)
                .join(" · ")}
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            {order.discountPct && order.originalTotal ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: T.muted,
                    textDecoration: "line-through",
                  }}
                >
                  {fmt(order.originalTotal)}
                </span>
                <span
                  style={{
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    color: T.green,
                    borderRadius: 6,
                    padding: "2px 7px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  -{order.discountPct}%
                </span>
              </div>
            ) : null}
            <span
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 17,
                fontWeight: 700,
                color: T.gold,
                display: "block",
              }}
            >
              {fmt(order.total)}
            </span>
          </div>
          {order.receiptUrl && order.paymentStatus !== "confirmed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReceiptSrc(order.receiptUrl!);
              }}
              title="View GCash screenshot"
              style={{
                background: "rgba(91,155,213,0.12)",
                border: "1px solid rgba(91,155,213,0.35)",
                borderRadius: 6,
                color: T.blue,
                padding: "5px 9px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <ImageIcon size={12} /> GCash
            </button>
          )}
          {order.paymentStatus === "confirmed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                printReceipt(1);
              }}
              title="Reprint order receipt"
              style={{
                background: "rgba(212,168,67,0.12)",
                border: "1px solid rgba(212,168,67,0.35)",
                borderRadius: 6,
                color: T.gold,
                padding: "5px 9px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <Printer size={12} /> Receipt
            </button>
          )}
          <div style={{ color: T.muted }}>
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {open && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              borderTop: `1px solid ${T.border}`,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {order.waiterName && (
              <div
                style={{
                  background: "rgba(91,155,213,0.08)",
                  border: "1px solid rgba(91,155,213,0.2)",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 12,
                  color: T.blue,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Shield size={13} />
                <span>
                  Order taken by{" "}
                  <strong style={{ color: T.cream }}>{order.waiterName}</strong>
                </span>
              </div>
            )}

            {/* ── CUSTOMER / ORDER DETAILS ── */}
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <p
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  fontFamily: "'Cinzel',serif",
                }}
              >
                ORDER DETAILS
              </p>

              {order.type === "dine-in" && order.tableNumber && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: T.muted, fontSize: 12, minWidth: 100 }}>
                    Table
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: T.green,
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      padding: "3px 10px",
                      borderRadius: 6,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Armchair
                      size={11}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 4,
                      }}
                    />
                    Table {order.tableNumber}
                  </span>
                </div>
              )}

              {order.customerName && (
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: T.muted, fontSize: 12, minWidth: 100 }}>
                    Customer
                  </span>
                  <span
                    style={{ color: T.cream, fontSize: 12, fontWeight: 600 }}
                  >
                    {order.customerName}
                  </span>
                </div>
              )}

              {order.customerContact && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      color: T.muted,
                      fontSize: 12,
                      minWidth: 100,
                      flexShrink: 0,
                    }}
                  >
                    Phone
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const num = `+63${order.customerContact}`;
                      const btn = e.currentTarget;
                      const prev = btn.textContent ?? "";
                      btn.textContent = "Copied!";
                      navigator.clipboard.writeText(num).finally(() => {
                        setTimeout(() => {
                          if (btn) btn.textContent = prev;
                        }, 1500);
                      });
                    }}
                    style={{
                      background: "rgba(232,213,163,0.06)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      padding: "4px 10px",
                      color: T.cream,
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      letterSpacing: ".02em",
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.gold;
                      e.currentTarget.style.color = T.gold;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.color = T.cream;
                    }}
                  >
                    +63 {order.customerContact}
                  </button>
                </div>
              )}

              {order.type === "delivery" && (
                <>
                  {order.deliveryAddress && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <span
                        style={{
                          color: T.muted,
                          fontSize: 12,
                          minWidth: 100,
                          flexShrink: 0,
                        }}
                      >
                        Address
                      </span>
                      <span
                        style={{
                          color: T.cream,
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {order.deliveryAddress}
                      </span>
                    </div>
                  )}
                  {(order as any).deliveryFee != null && (
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <span
                        style={{
                          color: T.muted,
                          fontSize: 12,
                          minWidth: 100,
                          flexShrink: 0,
                        }}
                      >
                        Delivery Fee
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: T.gold,
                          background: "rgba(212,168,67,0.08)",
                          border: "1px solid rgba(212,168,67,0.25)",
                          borderRadius: 6,
                          padding: "3px 10px",
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        ₱{(order as any).deliveryFee}
                      </span>
                      {(order as any).deliveryAddressDetails?.distanceKm !=
                        null && (
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          ·{" "}
                          {(
                            (order as any).deliveryAddressDetails
                              .distanceKm as number
                          ).toFixed(1)}{" "}
                          km away
                        </span>
                      )}
                    </div>
                  )}
                  {isDeliveryOpen && order.deliveryAddressDetails?.lat && (
                    <DeliveryMapPanel
                      details={order.deliveryAddressDetails}
                      orderId={order._id}
                    />
                  )}
                </>
              )}

              {order.notes && (
                <div
                  style={{
                    marginTop: 2,
                    background: "rgba(212,168,67,0.06)",
                    border: "1px solid rgba(212,168,67,0.2)",
                    borderRadius: 8,
                    padding: "9px 12px",
                  }}
                >
                  <p
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: ".08em",
                      fontFamily: "'Cinzel',serif",
                      marginBottom: 4,
                    }}
                  >
                    SPECIAL REQUESTS
                  </p>
                  <p style={{ color: T.cream, fontSize: 12, lineHeight: 1.6 }}>
                    {order.notes}
                  </p>
                </div>
              )}

              {order.cancelReason && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 8,
                    padding: "9px 12px",
                  }}
                >
                  <p
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: ".08em",
                      fontFamily: "'Cinzel',serif",
                      marginBottom: 4,
                    }}
                  >
                    CANCEL REASON
                  </p>
                  <p style={{ color: T.red, fontSize: 12, lineHeight: 1.5 }}>
                    {order.cancelReason}
                  </p>
                </div>
              )}

              <div
                style={{
                  borderTop: `1px solid ${T.border}`,
                  paddingTop: 10,
                  marginTop: 4,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {order.items.map((it, i) => {
                  const hasVoucher =
                    !!order.voucherItemName &&
                    it.name.startsWith(order.voucherItemName);
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            color: T.cream,
                            fontSize: 16,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {it.quantity}× {it.name}
                          {hasVoucher && (
                            <span
                              style={{
                                color: "#4ade80",
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: ".04em",
                                background: "rgba(74,222,128,.1)",
                                border: "1px solid rgba(74,222,128,.3)",
                                borderRadius: 5,
                                padding: "2px 6px",
                              }}
                            >
                              🎟 VOUCHER -₱
                              {(order.voucherDiscount || 0).toFixed(2)}
                            </span>
                          )}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          {(it as any).discountPct ? (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 15,
                                  color: T.muted,
                                  textDecoration: "line-through",
                                }}
                              >
                                ₱{(it.price * it.quantity).toFixed(2)}
                              </span>
                              <span
                                style={{
                                  color: T.green,
                                  fontSize: 16,
                                  fontWeight: 700,
                                }}
                              >
                                ₱
                                {(
                                  it.price * it.quantity -
                                  ((it as any).discountAmount || 0)
                                ).toFixed(2)}
                              </span>
                              {order.status !== "completed" &&
                                order.status !== "cancelled" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveItemDiscount(order._id, i);
                                    }}
                                    title="Remove discount"
                                    style={{
                                      background: "rgba(239,68,68,0.08)",
                                      border: "1px solid rgba(239,68,68,0.25)",
                                      color: T.red,
                                      borderRadius: 6,
                                      padding: "3px 6px",
                                      cursor: "pointer",
                                      fontSize: 10,
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                            </span>
                          ) : hasVoucher ? (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 15,
                                  color: T.muted,
                                  textDecoration: "line-through",
                                }}
                              >
                                ₱{(it.price * it.quantity).toFixed(2)}
                              </span>
                              <span
                                style={{
                                  color: "#4ade80",
                                  fontSize: 16,
                                  fontWeight: 700,
                                }}
                              >
                                ₱
                                {(
                                  it.price * it.quantity -
                                  (order.voucherDiscount || 0)
                                ).toFixed(2)}
                              </span>
                            </span>
                          ) : (
                            <>
                              <span
                                style={{
                                  color: T.cream,
                                  fontSize: 16,
                                  fontWeight: 600,
                                }}
                              >
                                ₱{(it.price * it.quantity).toFixed(2)}
                              </span>
                              {order.status !== "completed" &&
                                order.status !== "cancelled" &&
                                discounts.length > 0 && (
                                  <div style={{ position: "relative" }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenItemDiscountIdx((p) =>
                                          p === i ? null : i,
                                        );
                                      }}
                                      style={{
                                        background: T.goldGlow,
                                        border: `1px solid ${T.border}`,
                                        color: T.muted,
                                        borderRadius: 6,
                                        padding: "4px 8px",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 3,
                                      }}
                                    >
                                      <DollarSign size={10} />
                                      Discount
                                    </button>
                                    {openItemDiscountIdx === i && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          position: "absolute",
                                          top: "calc(100% + 6px)",
                                          right: 0,
                                          minWidth: 170,
                                          background: "#141f14",
                                          border: `1px solid ${T.borderH}`,
                                          borderRadius: 10,
                                          zIndex: 999,
                                          maxHeight: 200,
                                          overflowY: "auto",
                                          boxShadow:
                                            "0 8px 24px rgba(0,0,0,0.6)",
                                        }}
                                      >
                                        {discounts.map((d) => (
                                          <button
                                            key={d._id}
                                            onClick={() => {
                                              onApplyItemDiscount(
                                                order._id,
                                                i,
                                                d.name,
                                                d.percentage,
                                              );
                                              setOpenItemDiscountIdx(null);
                                            }}
                                            style={{
                                              width: "100%",
                                              padding: "9px 12px",
                                              background: "transparent",
                                              border: "none",
                                              borderBottom: `1px solid ${T.border}`,
                                              color: T.cream,
                                              fontSize: 12,
                                              cursor: "pointer",
                                              textAlign: "left",
                                              display: "flex",
                                              justifyContent: "space-between",
                                            }}
                                          >
                                            <span>{d.name}</span>
                                            <span
                                              style={{
                                                color: T.gold,
                                                fontWeight: 700,
                                              }}
                                            >
                                              {d.percentage}%
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                            </>
                          )}
                        </div>
                      </div>
                      {it.customizations && it.customizations.length > 0 && (
                        <div
                          style={{
                            paddingLeft: 14,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          {Object.entries(
                            it.customizations.reduce(
                              (
                                groups: Record<
                                  string,
                                  typeof it.customizations
                                >,
                                c,
                              ) => {
                                // Resolve legacy type values to friendly display labels
                                const EGG_STYLES = new Set([
                                  "sunny side up",
                                  "over easy",
                                  "over hard",
                                  "soft scramble",
                                  "hard scramble",
                                  "soft boiled",
                                  "hard boiled",
                                  "soft boil",
                                  "hard boil",
                                ]);
                                const MILK_LABELS = new Set([
                                  "regular milk",
                                  "oat milk",
                                ]);
                                const BASE_LABELS = new Set([
                                  "coffee",
                                  "matcha",
                                ]);
                                const rawType = c.type?.trim() || "Option";
                                let key = rawType;
                                const lc = (c.label || "").toLowerCase();
                                if (rawType.toLowerCase() === "substitution") {
                                  if (EGG_STYLES.has(lc)) key = "Egg Style";
                                  else if (MILK_LABELS.has(lc)) key = "Milk";
                                  else if (BASE_LABELS.has(lc)) key = "Base";
                                  else key = "Option";
                                } else if (rawType.toLowerCase() === "addon") {
                                  key = "Add-On";
                                } else if (rawType.toLowerCase() === "sauce") {
                                  key = "Sauce";
                                }
                                if (!groups[key]) groups[key] = [];
                                groups[key]!.push(c);
                                return groups;
                              },
                              {},
                            ),
                          ).map(([groupType, choices]) => (
                            <div
                              key={groupType}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  color: T.gold,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: ".08em",
                                  textTransform: "uppercase",
                                  background: "rgba(212,168,67,0.12)",
                                  border: `1px solid ${T.gold}44`,
                                  borderRadius: 4,
                                  padding: "2px 6px",
                                  flexShrink: 0,
                                  marginTop: 1,
                                }}
                              >
                                {groupType}
                              </span>
                              <span
                                style={{
                                  color: T.cream,
                                  fontSize: 11,
                                  opacity: 0.85,
                                }}
                              >
                                {choices!
                                  .map(
                                    (c) =>
                                      c.label +
                                      (c.price > 0 ? ` (+₱${c.price})` : ""),
                                  )
                                  .join(", ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div
                  style={{
                    borderTop: `1px solid ${T.border}`,
                    paddingTop: 8,
                    marginTop: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {(order as any).deliveryFee > 0 && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 12 }}>
                          Items subtotal
                        </span>
                        <span style={{ color: T.cream, fontSize: 12 }}>
                          ₱
                          {(order.total - (order as any).deliveryFee).toFixed(
                            2,
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 12 }}>
                          Delivery fee
                        </span>
                        <span
                          style={{
                            color: T.gold,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          ₱{(order as any).deliveryFee}
                        </span>
                      </div>
                    </>
                  )}
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span
                      style={{
                        color: T.muted,
                        fontSize: 12,
                        fontFamily: "'Cinzel',serif",
                        letterSpacing: ".08em",
                      }}
                    >
                      TOTAL
                    </span>
                    <span
                      style={{
                        color: T.gold,
                        fontSize: 16,
                        fontWeight: 700,
                        fontFamily: "'Cinzel',serif",
                      }}
                    >
                      ₱{order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PAYMENT SECTION ── */}
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <p
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  fontFamily: "'Cinzel',serif",
                }}
              >
                PAYMENT
              </p>

              {/* Row 1: Payment status + method badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {/* Payment status pill */}
                <span
                  style={{
                    fontSize: 12,
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontWeight: 600,
                    color:
                      order.paymentStatus === "confirmed" ? T.green : "#f59e0b",
                    background:
                      order.paymentStatus === "confirmed"
                        ? "rgba(34,197,94,0.1)"
                        : "rgba(245,158,11,0.1)",
                    border: `1px solid ${
                      order.paymentStatus === "confirmed"
                        ? "rgba(34,197,94,0.3)"
                        : "rgba(245,158,11,0.3)"
                    }`,
                  }}
                >
                  {order.paymentStatus === "confirmed"
                    ? "✓ Paid"
                    : "⏳ Payment Pending"}
                </span>

                {/* Method badge — only show if method is known (cash or gcash) */}
                {methodKnown && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 6,
                      color: order.paymentMethod === "cash" ? T.green : T.gold,
                      background:
                        order.paymentMethod === "cash"
                          ? "rgba(34,197,94,0.08)"
                          : "rgba(212,168,67,0.1)",
                      border: `1px solid ${
                        order.paymentMethod === "cash"
                          ? "rgba(34,197,94,0.25)"
                          : "rgba(212,168,67,0.3)"
                      }`,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {order.paymentMethod === "cash" ? (
                      <>
                        <Banknote
                          size={11}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                            marginRight: 4,
                          }}
                        />
                        Cash
                      </>
                    ) : order.paymentMethod === "split" ? (
                      <>
                        Split — ₱{splitCash.toFixed(0)} cash + ₱
                        {splitGcash.toFixed(0)} GCash
                      </>
                    ) : (
                      <>
                        <img
                          src="/images/gcash.png"
                          alt="GCash"
                          style={{
                            width: 13,
                            height: 13,
                            objectFit: "contain",
                            verticalAlign: "middle",
                            marginRight: 4,
                          }}
                        />
                        GCash
                      </>
                    )}
                  </span>
                )}

                {/* Decide later label */}
                {methodPending && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 6,
                      color: T.muted,
                      background: "rgba(232,213,163,0.05)",
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <HelpCircle
                      size={10}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 4,
                      }}
                    />
                    Method unknown
                  </span>
                )}

                {/* Admin override: split the payment yourself, even if the
                    customer picked (or was recorded as) a single method */}
                {methodKnown && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openSplitEditor();
                    }}
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 6,
                      color: T.muted,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${T.border}`,
                      cursor: "pointer",
                    }}
                  >
                    {isSplit ? "Edit Split" : "Split Payment"}
                  </button>
                )}

                {/* GCash reference number (customer chose "Enter Reference No."
                    instead of uploading a screenshot — no image to show, so
                    surface the sender name + ref no. directly for staff to
                    check against the GCash business inbox). */}
                {!order.receiptUrl && order.gcashRef && (
                  <div
                    style={{
                      fontSize: 12,
                      color: T.blue,
                      background: "rgba(91,155,213,0.08)",
                      border: "1px solid rgba(91,155,213,0.2)",
                      borderRadius: 6,
                      padding: "5px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ImageIcon size={12} />
                    <span>
                      {order.gcashSenderName && (
                        <strong>{order.gcashSenderName}</strong>
                      )}
                      {order.gcashSenderName && " · "}
                      Ref: {order.gcashRef}
                    </span>
                  </div>
                )}

                {/* Receipt button */}
                {order.receiptUrl && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptSrc(order.receiptUrl!);
                      }}
                      style={{
                        fontSize: 12,
                        color: T.blue,
                        background: "rgba(91,155,213,0.08)",
                        border: "1px solid rgba(91,155,213,0.2)",
                        borderRadius: 6,
                        padding: "5px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <ImageIcon size={12} /> GCash Screenshot
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        printReceipt(1);
                      }}
                      style={{
                        fontSize: 12,
                        color: T.gold,
                        background: "rgba(212,168,67,0.08)",
                        border: "1px solid rgba(212,168,67,0.2)",
                        borderRadius: 6,
                        padding: "5px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Printer size={12} /> Print Receipt
                    </button>
                    {order.paymentStatus !== "confirmed" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRejectModal(true);
                        }}
                        style={{
                          fontSize: 12,
                          color: T.red,
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 6,
                          padding: "5px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <X
                          size={12}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                            marginRight: 4,
                          }}
                        />
                        Reject Receipt
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Split-payment override editor */}
              {showSplitEditor && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "12px",
                    borderRadius: 8,
                    background: "rgba(212,168,67,0.05)",
                    border: `1px solid ${T.borderH}`,
                  }}
                >
                  <p style={{ color: T.muted, fontSize: 11 }}>
                    Total is {fmt(order.total)}. Enter how much was actually
                    cash vs GCash:
                  </p>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <label style={{ flex: 1 }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: T.muted,
                          display: "block",
                          marginBottom: 3,
                        }}
                      >
                        Cash
                      </span>
                      <input
                        type="number"
                        value={splitCashInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSplitCashInput(v);
                          const cashNum = parseFloat(v) || 0;
                          const remainder = Math.max(order.total - cashNum, 0);
                          setSplitGcashInput(
                            remainder % 1 === 0
                              ? String(remainder)
                              : remainder.toFixed(2),
                          );
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.3)",
                          border: `1px solid ${T.border}`,
                          color: T.cream,
                          fontSize: 13,
                        }}
                      />
                    </label>
                    <label style={{ flex: 1 }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: T.muted,
                          display: "block",
                          marginBottom: 3,
                        }}
                      >
                        GCash
                      </span>
                      <input
                        type="number"
                        value={splitGcashInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSplitGcashInput(v);
                          const gcashNum = parseFloat(v) || 0;
                          const remainder = Math.max(order.total - gcashNum, 0);
                          setSplitCashInput(
                            remainder % 1 === 0
                              ? String(remainder)
                              : remainder.toFixed(2),
                          );
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.3)",
                          border: `1px solid ${T.border}`,
                          color: T.cream,
                          fontSize: 13,
                        }}
                      />
                    </label>
                  </div>
                  {!splitInputsValid && (
                    <p style={{ color: T.red, fontSize: 10 }}>
                      Cash + GCash must add up to {fmt(order.total)} (currently{" "}
                      {fmt(splitInputsSum)}).
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        await onAdjustSplit(
                          order._id,
                          parseFloat(splitCashInput) || 0,
                          parseFloat(splitGcashInput) || 0,
                        );
                        setShowSplitEditor(false);
                      }}
                      disabled={!splitInputsValid}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: splitInputsValid
                          ? T.gold
                          : "rgba(255,255,255,0.05)",
                        color: splitInputsValid ? "#0a0f0a" : T.faint,
                        border: "none",
                        cursor: splitInputsValid ? "pointer" : "default",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Save Split
                    </button>
                    <button
                      onClick={() => setShowSplitEditor(false)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.03)",
                        color: T.muted,
                        border: `1px solid ${T.border}`,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Row 2: Actions — only show if not yet paid */}
              {order.paymentStatus !== "confirmed" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {/* Step 1: If method is unknown, let staff pick it first */}
                  {methodPending && (
                    <div>
                      <p
                        style={{
                          color: T.muted,
                          fontSize: 11,
                          marginBottom: 6,
                        }}
                      >
                        Step 1 — Ask customer how they'll pay:
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["cash", "gcash"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetPaymentMethod(order._id, m);
                            }}
                            style={{
                              flex: 1,
                              padding: "9px 12px",
                              borderRadius: 8,
                              cursor: "pointer",
                              background:
                                m === "cash"
                                  ? "rgba(34,197,94,0.08)"
                                  : "rgba(212,168,67,0.08)",
                              border: `1px solid ${
                                m === "cash"
                                  ? "rgba(34,197,94,0.3)"
                                  : "rgba(212,168,67,0.3)"
                              }`,
                              color: m === "cash" ? T.green : T.gold,
                              fontWeight: 700,
                              fontSize: 12,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {m === "cash" ? (
                              <>
                                <Banknote size={15} />
                                Set Cash
                              </>
                            ) : (
                              <>
                                <img
                                  src="/images/gcash.png"
                                  alt="GCash"
                                  style={{
                                    width: 15,
                                    height: 15,
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                />
                                Set GCash
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Once method is known, confirm payment */}
                  {methodKnown && (
                    <div>
                      <p
                        style={{
                          color: T.muted,
                          fontSize: 11,
                          marginBottom: 6,
                        }}
                      >
                        {isSplit
                          ? splitGcash > 0
                            ? `Step 2 — Check the GCash screenshot above for ₱${splitGcash.toFixed(0)}, then collect ₱${splitCash.toFixed(0)} cash:`
                            : `Step 2 — Collect ₱${splitCash.toFixed(0)} cash then confirm:`
                          : `Step 2 — Collect ${
                              order.paymentMethod === "cash"
                                ? "cash"
                                : "GCash transfer"
                            } then confirm:`}
                      </p>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            order.paymentMethod === "cash" ||
                            (isSplit && splitCash > 0)
                          ) {
                            setShowCashRegister(true);
                          } else {
                            await onPaymentConfirm(order._id);
                            printReceipt(1);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          background: "rgba(34,197,94,0.12)",
                          border: "1px solid rgba(34,197,94,0.4)",
                          color: T.green,
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "'Cinzel',serif",
                          letterSpacing: ".06em",
                        }}
                      >
                        {order.paymentMethod === "cash" ||
                        (isSplit && splitCash > 0) ? (
                          <>
                            <Banknote
                              size={13}
                              style={{
                                display: "inline",
                                verticalAlign: "middle",
                                marginRight: 6,
                              }}
                            />
                            OPEN CASH REGISTER
                            {isSplit ? ` (₱${splitCash.toFixed(0)})` : ""}
                          </>
                        ) : (
                          <>
                            <Check
                              size={13}
                              style={{
                                display: "inline",
                                verticalAlign: "middle",
                                marginRight: 6,
                              }}
                            />
                            CONFIRM PAYMENT RECEIVED
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIDER TRACKING ── */}
            {isDeliveryOpen && order.status !== "cancelled" && (
              <RiderTrackingButton
                orderId={order._id}
                orderNumber={order.orderNumber}
                riderName={staffName}
              />
            )}

            {/* ── STATUS ACTIONS ── */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {order.status !== "completed" && order.status !== "cancelled" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditItems(true);
                  }}
                  style={{
                    padding: "9px 12px",
                    background: "rgba(91,155,213,0.1)",
                    border: "1px solid rgba(91,155,213,0.3)",
                    color: T.blue,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Edit2 size={12} /> Edit Items
                </button>
              )}
              {nextStatus && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const shouldPrint =
                      order.status === "pending" &&
                      order.paymentStatus !== "confirmed";
                    await onStatusChange(order._id, nextStatus);
                    if (shouldPrint) printReceipt(2);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 130,
                    padding: "9px 12px",
                    background: STATUS_CFG[nextStatus].color + "18",
                    border: `1px solid ${STATUS_CFG[nextStatus].color}44`,
                    color: STATUS_CFG[nextStatus].color,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  → {STATUS_CFG[nextStatus].label}
                </button>
              )}
              {order.status !== "cancelled" && order.status !== "completed" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCancelModal(true);
                  }}
                  style={{
                    padding: "9px 12px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: T.red,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
              {(order.status === "completed" ||
                order.status === "cancelled") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(order._id);
                  }}
                  style={{
                    padding: "9px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${T.border}`,
                    color: T.muted,
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── MENU ITEM FORM ───────────────────────────────────────────────────────────
function MenuItemForm({
  item,
  onSave,
  onCancel,
}: {
  item?: Partial<MenuItem>;
  onSave: (data: Partial<MenuItem>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<MenuItem>>(() => {
    if (!item) return { available: true };
    if (item.options && item.options.length > 0) return item;
    const derived = deriveLegacyOptions(item);
    return derived.length > 0 ? { ...item, options: derived } : item;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [variantInput, setVariantInput] = useState("");
  const set = (k: keyof MenuItem, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const valid = !!(
    form.name?.trim() &&
    form.price !== undefined &&
    form.price >= 0 &&
    form.category?.trim()
  );

  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items || [])
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (!file) return;
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          set("image", data.url);
        }
      } catch {}
      setUploading(false);
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);
  const w = useWindowWidth();
  const isMobile = w < 600;

  async function handleSave() {
    if (!valid) return;
    setErr("");
    setSaving(true);
    const finalVariants = variantInput.trim()
      ? [...(form.variants || []), variantInput.trim()]
      : form.variants || [];
    const cleanedOptions = (form.options || [])
      .filter((g) => g.name.trim())
      .map((g) => {
        if (g.name.toLowerCase() === "variant" && finalVariants.length > 0) {
          return {
            ...g,
            choices: finalVariants.map((v: string) => ({ label: v, price: 0 })),
          };
        }
        return { ...g, choices: g.choices.filter((c) => c.label.trim()) };
      })
      .filter((g) => g.choices.length > 0);
    const ok = await onSave({
      ...form,
      variants: finalVariants,
      options: cleanedOptions,
    });
    setSaving(false);
    if (!ok) setErr("Failed to save — check your connection and try again.");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: T.cream,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    color: T.muted,
    fontSize: 10,
    letterSpacing: ".1em",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.4)",
        border: `1px solid ${T.borderH}`,
        borderRadius: 16,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            fontFamily: "'Cinzel',serif",
            color: T.cream,
            fontSize: 14,
            letterSpacing: ".1em",
          }}
        >
          {item?._id ? "EDIT ITEM" : "ADD ITEM"}
        </h3>
        <button
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            color: T.muted,
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
        }}
      >
        {[
          { k: "name", label: "Name *", placeholder: "Café Latte" },
          { k: "category", label: "Category *", placeholder: "Coffee" },
        ].map(({ k, label, placeholder }) => (
          <div key={k}>
            <label style={labelStyle}>{label.toUpperCase()}</label>
            <input
              value={(form as any)[k] || ""}
              placeholder={placeholder}
              onChange={(e) => set(k as keyof MenuItem, e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
        }}
      >
        <div>
          <label style={labelStyle}>PRICE (₱) *</label>
          <input
            type="number"
            value={form.price || ""}
            placeholder="0"
            onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>AVAILABLE</label>
          <button
            onClick={() => set("available", !form.available)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              cursor: "pointer",
              background: form.available
                ? "rgba(34,197,94,0.1)"
                : "rgba(239,68,68,0.1)",
              border: `1px solid ${form.available ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: form.available ? T.green : T.red,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {form.available ? "✓ Available" : "✗ Unavailable"}
          </button>
        </div>
      </div>

      <div>
        <label style={labelStyle}>
          VARIANTS (optional — e.g. Chicken, Tuna)
        </label>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}
        >
          {(form.variants || []).map((v: string) => (
            <span
              key={v}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(212,168,67,0.12)",
                border: `1px solid ${T.gold}44`,
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 12,
                color: T.gold,
              }}
            >
              {v}
              <button
                onClick={() =>
                  set(
                    "variants",
                    (form.variants || []).filter((x: string) => x !== v),
                  )
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.muted,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={variantInput}
            onChange={(e) => setVariantInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && variantInput.trim()) {
                set("variants", [
                  ...(form.variants || []),
                  variantInput.trim(),
                ]);
                setVariantInput("");
              }
            }}
            placeholder="e.g. Chicken — press Enter to add"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => {
              if (variantInput.trim()) {
                set("variants", [
                  ...(form.variants || []),
                  variantInput.trim(),
                ]);
                setVariantInput("");
              }
            }}
            style={{
              padding: "9px 14px",
              background: T.goldDim,
              border: `1px solid ${T.gold}44`,
              borderRadius: 8,
              color: T.gold,
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <label style={labelStyle}>
          OPTIONS (e.g. Milk, Pieces, Spice Level — fully custom, editable
          anytime)
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(form.options || []).map((group: OptionGroup, gi: number) => (
            <div
              key={gi}
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: 12,
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={group.name}
                  onChange={(e) => {
                    const next = [...(form.options || [])];
                    next[gi] = { ...next[gi], name: e.target.value };
                    set("options", next);
                  }}
                  placeholder="Group name (e.g. Milk, Pieces)"
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                />
                <button
                  onClick={() => {
                    const next = [...(form.options || [])];
                    next[gi] = {
                      ...next[gi],
                      type: next[gi].type === "single" ? "multi" : "single",
                    };
                    set("options", next);
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                    background: "rgba(212,168,67,0.08)",
                    color: T.gold,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {group.type === "single" ? "ONE PICK" : "MULTI PICK"}
                </button>
                <button
                  onClick={() => {
                    const next = (form.options || []).filter(
                      (_: any, i: number) => i !== gi,
                    );
                    set("options", next);
                  }}
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: T.red,
                    borderRadius: 6,
                    padding: "8px 9px",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {group.type === "multi" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.muted, fontSize: 11 }}>
                    Max picks:
                  </span>
                  <input
                    type="number"
                    value={group.max ?? ""}
                    onChange={(e) => {
                      const next = [...(form.options || [])];
                      next[gi] = {
                        ...next[gi],
                        max: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      };
                      set("options", next);
                    }}
                    placeholder="no limit"
                    style={{
                      ...inputStyle,
                      width: 90,
                      fontSize: 12,
                      padding: "5px 8px",
                    }}
                  />
                  <button
                    onClick={() => {
                      const next = [...(form.options || [])];
                      next[gi] = { ...next[gi], required: !next[gi].required };
                      set("options", next);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: `1px solid ${group.required ? T.gold : T.border}`,
                      background: group.required ? T.goldDim : "transparent",
                      color: group.required ? T.gold : T.muted,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {group.required ? "✓ REQUIRED" : "OPTIONAL"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.choices.map((choice, ci) => (
                  <div key={ci} style={{ display: "flex", gap: 6 }}>
                    <input
                      value={choice.label}
                      onChange={(e) => {
                        const next = [...(form.options || [])];
                        const choices = [...next[gi].choices];
                        choices[ci] = { ...choices[ci], label: e.target.value };
                        next[gi] = { ...next[gi], choices };
                        set("options", next);
                      }}
                      placeholder="Choice label (e.g. Oat Milk)"
                      style={{
                        ...inputStyle,
                        flex: 1,
                        fontSize: 12,
                        padding: "6px 10px",
                      }}
                    />
                    <input
                      type="number"
                      value={choice.price || ""}
                      onChange={(e) => {
                        const next = [...(form.options || [])];
                        const choices = [...next[gi].choices];
                        choices[ci] = {
                          ...choices[ci],
                          price: parseFloat(e.target.value) || 0,
                        };
                        next[gi] = { ...next[gi], choices };
                        set("options", next);
                      }}
                      placeholder="₱0"
                      style={{
                        ...inputStyle,
                        width: 70,
                        fontSize: 12,
                        padding: "6px 8px",
                      }}
                    />
                    <button
                      onClick={() => {
                        const next = [...(form.options || [])];
                        next[gi] = {
                          ...next[gi],
                          choices: next[gi].choices.filter((_, i) => i !== ci),
                        };
                        set("options", next);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: T.muted,
                        cursor: "pointer",
                        padding: "0 4px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const next = [...(form.options || [])];
                    next[gi] = {
                      ...next[gi],
                      choices: [...next[gi].choices, { label: "", price: 0 }],
                    };
                    set("options", next);
                  }}
                  style={{
                    alignSelf: "flex-start",
                    padding: "5px 10px",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px dashed ${T.border}`,
                    borderRadius: 6,
                    color: T.muted,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  + Add Choice
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              set("options", [
                ...(form.options || []),
                {
                  name: "",
                  type: "single",
                  choices: [{ label: "", price: 0 }],
                },
              ])
            }
            style={{
              padding: "9px 14px",
              background: T.goldDim,
              border: `1px solid ${T.gold}44`,
              borderRadius: 8,
              color: T.gold,
              cursor: "pointer",
              fontSize: 12,
              alignSelf: "flex-start",
            }}
          >
            + Add Option Group
          </button>
        </div>
      </div>

      <div>
        <label style={labelStyle}>DESCRIPTION</label>
        <textarea
          value={form.description || ""}
          rows={2}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Short description..."
          style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }}
        />
      </div>

      <div>
        <label style={labelStyle}>IMAGE</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.image && (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 120,
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${T.border}`,
              }}
            >
              <img
                src={form.image}
                alt="Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <button
                onClick={() => set("image", "")}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  background: "rgba(0,0,0,0.7)",
                  border: `1px solid ${T.border}`,
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  color: T.cream,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px dashed ${uploading ? T.gold : T.borderH}`,
              cursor: uploading ? "wait" : "pointer",
              background: uploading
                ? "rgba(212,168,67,0.08)"
                : "rgba(212,168,67,0.04)",
              color: T.muted,
              fontSize: 12,
              transition: "all .15s",
            }}
          >
            <ImageIcon size={14} color={T.gold} />
            <span style={{ color: uploading ? T.gold : T.cream }}>
              {uploading
                ? "Uploading…"
                : form.image
                  ? "Replace image"
                  : "Upload image or paste (Ctrl+V)"}
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const fd = new FormData();
                fd.append("file", file);
                try {
                  const res = await fetch("/api/upload", {
                    method: "POST",
                    body: fd,
                  });
                  if (res.ok) {
                    const data = await res.json();
                    set("image", data.url);
                  } else {
                    alert("Upload failed — check your R2 config.");
                  }
                } catch {
                  alert("Upload failed — network error.");
                } finally {
                  setUploading(false);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {err && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "rgba(239,68,68,0.85)",
            fontSize: 12,
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: "9px 12px",
          }}
        >
          <AlertCircle size={13} /> {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          style={{
            flex: 1,
            padding: "11px",
            background: valid ? T.gold : "rgba(212,168,67,0.25)",
            color: valid ? "#0a0f0a" : T.muted,
            border: "none",
            borderRadius: 10,
            fontFamily: "'Cinzel',serif",
            fontSize: 12,
            letterSpacing: ".1em",
            fontWeight: 700,
            cursor: valid && !saving ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "SAVING…" : "SAVE ITEM"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "11px 18px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            color: T.muted,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── MENU TAB ─────────────────────────────────────────────────────────────────
function MenuTab({
  items,
  onRefresh,
}: {
  items: MenuItem[];
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [localItems, setLocalItems] = useState<MenuItem[]>(items);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const busyIdsRef = useRef<Set<string>>(new Set());
  // Tracks cost edits that are in-flight or have been saved but not yet
  // confirmed by a fresh GET. Maps id -> the cost value we expect the
  // server to eventually echo back. Until it does, we keep showing our
  // own optimistic value instead of letting a stale background refetch
  // clobber it.
  const pendingCostRef = useRef<Map<string, number>>(new Map());
  const [menuView, setMenuView] = useState<"cards" | "costs">("cards");
  const [editingCost, setEditingCost] = useState<{
    id: string;
    val: string;
  } | null>(null);
  const [savingCostId, setSavingCostId] = useState<string | null>(null);
  const w = useWindowWidth();
  const isMobile = w < 640;

  async function saveCost(item: MenuItem, cost: number) {
    setSavingCostId(item._id);
    pendingCostRef.current.set(item._id, cost);
    try {
      const res = await fetch(`/api/menu/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost }),
      });
      if (res.ok) {
        setLocalItems((prev) =>
          prev.map((i) => (i._id === item._id ? { ...i, cost } : i)),
        );
      } else {
        // Save failed — stop guarding this id, let the next refetch win.
        pendingCostRef.current.delete(item._id);
      }
    } catch {
      pendingCostRef.current.delete(item._id);
    }
    setSavingCostId(null);
    setEditingCost(null);
  }

  useEffect(() => {
    setLocalItems((prev) =>
      items.map((incoming) => {
        const pendingCost = pendingCostRef.current.get(incoming._id);
        if (pendingCost !== undefined) {
          if (incoming.cost === pendingCost) {
            // Server has caught up — safe to stop guarding this id.
            pendingCostRef.current.delete(incoming._id);
            return incoming;
          }
          // Server data is still stale relative to what we saved —
          // keep our optimistic local value instead of overwriting it.
          const local = prev.find((p) => p._id === incoming._id);
          return local ? { ...incoming, cost: local.cost } : incoming;
        }
        if (busyIdsRef.current.has(incoming._id)) {
          return prev.find((p) => p._id === incoming._id) ?? incoming;
        }
        return incoming;
      }),
    );
  }, [items]);

  const categories = Array.from(new Set(localItems.map((i) => i.category)));

  async function saveItem(data: Partial<MenuItem>): Promise<boolean> {
    const isEdit = !!editItem;
    const isHardcoded = isEdit && editItem!._id.startsWith("hardcoded-");
    const url =
      isEdit && !isHardcoded ? `/api/menu/${editItem!._id}` : "/api/menu";
    const method = isEdit && !isHardcoded ? "PATCH" : "POST";
    console.log(`[MenuTab.saveItem] → ${method} ${url}`, data);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(
          `[MenuTab.saveItem] ${method} ${url} → ${res.status}`,
          errBody,
        );
        return false;
      }

      const saved: MenuItem = await res.json();

      if (isEdit) {
        setLocalItems((prev) =>
          prev.map((i) => (i._id === editItem!._id ? saved : i)),
        );
      } else {
        setLocalItems((prev) => [...prev, saved]);
      }

      setShowForm(false);
      setEditItem(null);
      onRefresh().catch(console.error);
      return true;
    } catch (err) {
      console.error("[MenuTab.saveItem] network error", err);
      return false;
    }
  }

  async function doDelete(id: string) {
    setBusyIds((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLocalItems((prev) => prev.filter((i) => i._id !== id));
        onRefresh().catch(console.error);
      } else {
        alert(`Delete failed (${res.status}).`);
      }
    } catch {
      alert("Delete failed — network error.");
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setDeleteTarget(null);
    }
  }

  async function toggleAvail(item: MenuItem) {
    const isHardcoded = item._id.startsWith("hardcoded-");
    const newVal = !item.available;
    if (isHardcoded) {
      setLocalItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, available: newVal } : i)),
      );
      return;
    }
    busyIdsRef.current.add(item._id);
    setLocalItems((prev) =>
      prev.map((i) => (i._id === item._id ? { ...i, available: newVal } : i)),
    );
    try {
      const res = await fetch(`/api/menu/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: newVal }),
      });
      if (!res.ok) {
        setLocalItems((prev) =>
          prev.map((i) =>
            i._id === item._id ? { ...i, available: item.available } : i,
          ),
        );
      }
    } catch {
      setLocalItems((prev) =>
        prev.map((i) =>
          i._id === item._id ? { ...i, available: item.available } : i,
        ),
      );
    } finally {
      busyIdsRef.current.delete(item._id);
    }
  }

  function startEdit(item: MenuItem) {
    setShowForm(false);
    setEditItem(item);
  }

  function startAdd() {
    setEditItem(null);
    setShowForm(true);
  }

  const formKey = editItem ? `edit-${editItem._id}` : "add-new";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {deleteTarget && (
        <ConfirmModal
          message="Delete this menu item? This cannot be undone."
          onConfirm={() => doDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <p style={{ color: T.muted, fontSize: 12 }}>
          {localItems.length} items · {categories.length} categories
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {(["cards", "costs"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMenuView(v)}
                style={{
                  padding: "8px 14px",
                  background: menuView === v ? T.goldDim : "transparent",
                  border: "none",
                  borderRight: v === "cards" ? `1px solid ${T.border}` : "none",
                  color: menuView === v ? T.gold : T.muted,
                  fontSize: 11,
                  fontWeight: menuView === v ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: ".06em",
                }}
              >
                {v === "cards" ? "MENU" : "COST SHEET"}
              </button>
            ))}
          </div>
          <button
            onClick={() => onRefresh()}
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={startAdd}
            style={{
              padding: "8px 16px",
              background: T.gold,
              border: "none",
              borderRadius: 8,
              color: "#0a0f0a",
              fontFamily: "'Cinzel',serif",
              fontSize: 11,
              letterSpacing: ".1em",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={13} /> ADD ITEM
          </button>
        </div>
      </div>

      {menuView === "costs" && (
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: isMobile ? 480 : undefined,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "rgba(212,168,67,0.08)",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {["Product", "Category", "Price", "Cost", "Margin", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        color: T.muted,
                        textAlign:
                          h === "Product" || h === "Category"
                            ? "left"
                            : "right",
                        padding: "10px 14px",
                        fontWeight: 600,
                        fontSize: 10,
                        letterSpacing: 0.8,
                        fontFamily: "'Cinzel',serif",
                        whiteSpace: "nowrap",
                        display:
                          isMobile && h === "Category" ? "none" : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {localItems.map((item, i) => {
                const margin =
                  item.cost && item.cost > 0 && item.price > 0
                    ? ((item.price - item.cost) / item.price) * 100
                    : null;
                const isEditingThis = editingCost?.id === item._id;
                return (
                  <tr
                    key={item._id}
                    style={{
                      borderBottom:
                        i < localItems.length - 1
                          ? `1px solid rgba(255,255,255,0.04)`
                          : "none",
                      background:
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      transition: "background .1s",
                    }}
                  >
                    <td
                      style={{
                        padding: "9px 14px",
                        color: T.cream,
                        fontWeight: 500,
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                            onError={(e) =>
                              (e.currentTarget.style.display = "none")
                            }
                          />
                        )}
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "9px 14px",
                        color: T.muted,
                        fontSize: 11,
                        display: isMobile ? "none" : undefined,
                      }}
                    >
                      {item.category}
                    </td>
                    <td
                      style={{
                        padding: "9px 14px",
                        textAlign: "right",
                        color: T.gold,
                        fontFamily: "'Cinzel',serif",
                        fontWeight: 700,
                      }}
                    >
                      {fmt(item.price)}
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      {isEditingThis ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            justifyContent: "flex-end",
                          }}
                        >
                          <input
                            type="number"
                            value={editingCost.val}
                            autoFocus
                            onChange={(e) =>
                              setEditingCost({
                                id: item._id,
                                val: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                saveCost(
                                  item,
                                  parseFloat(editingCost.val) || 0,
                                );
                              if (e.key === "Escape") setEditingCost(null);
                            }}
                            style={{
                              width: 72,
                              background: "rgba(255,255,255,0.06)",
                              border: `1px solid ${T.gold}`,
                              borderRadius: 6,
                              padding: "4px 8px",
                              color: T.cream,
                              fontSize: 12,
                              textAlign: "right",
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() =>
                              saveCost(item, parseFloat(editingCost.val) || 0)
                            }
                            style={{
                              background: T.green,
                              border: "none",
                              borderRadius: 5,
                              color: "#0a0f0a",
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {savingCostId === item._id ? "…" : "✓"}
                          </button>
                          <button
                            onClick={() => setEditingCost(null)}
                            style={{
                              background: "none",
                              border: "none",
                              color: T.muted,
                              cursor: "pointer",
                              fontSize: 14,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setEditingCost({
                              id: item._id,
                              val: String(item.cost || ""),
                            })
                          }
                          style={{
                            background: "none",
                            border: `1px dashed ${item.cost ? T.border : "rgba(212,168,67,0.3)"}`,
                            borderRadius: 6,
                            color: item.cost ? T.cream : "rgba(212,168,67,0.5)",
                            padding: "3px 10px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "'Cinzel',serif",
                            minWidth: 60,
                            textAlign: "right",
                          }}
                        >
                          {item.cost ? fmt(item.cost) : "+ add"}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      {margin !== null ? (
                        <span
                          style={{
                            color:
                              margin >= 40
                                ? T.green
                                : margin >= 20
                                  ? "#f59e0b"
                                  : "#f87171",
                            fontWeight: 700,
                          }}
                        >
                          {margin.toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: T.faint }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      <button
                        onClick={() => startEdit(item)}
                        style={{
                          background: "rgba(212,168,67,0.06)",
                          border: `1px solid rgba(212,168,67,0.2)`,
                          borderRadius: 6,
                          color: T.gold,
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontSize: 11,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editItem && (
        <div
          onClick={(e) => e.target === e.currentTarget && setEditItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "90svh",
              overflowY: "auto",
              background: "#0f1a0f",
              borderRadius: 16,
              boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
            }}
          >
            <MenuItemForm
              key={`edit-${editItem._id}`}
              item={editItem}
              onSave={saveItem}
              onCancel={() => setEditItem(null)}
            />
          </div>
        </div>
      )}

      {menuView === "cards" && (
        <>
          {showForm && (
            <MenuItemForm
              key="add-new"
              item={undefined}
              onSave={saveItem}
              onCancel={() => setShowForm(false)}
            />
          )}

          {categories.map((cat) => (
            <div key={cat}>
              <p
                style={{
                  color: T.gold,
                  fontSize: 11,
                  letterSpacing: ".15em",
                  textTransform: "uppercase",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 10,
                }}
              >
                ──{cat}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                  gap: 10,
                }}
              >
                {localItems
                  .filter((i) => i.category === cat)
                  .map((item) => (
                    <div
                      key={item._id}
                      style={{
                        background: T.bgCard,
                        border: `1px solid ${editItem?._id === item._id ? T.gold : T.border}`,
                        borderRadius: 12,
                        overflow: "hidden",
                        transition: "all .2s",
                        opacity: item.available ? 1 : 0.55,
                        position: "relative",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = T.borderH)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor =
                          editItem?._id === item._id ? T.gold : T.border)
                      }
                    >
                      {item.image && (
                        <div
                          style={{
                            height: 80,
                            overflow: "hidden",
                            background: "rgba(212,168,67,0.05)",
                          }}
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            width={240}
                            height={80}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              contentVisibility: "auto",
                            }}
                            onError={(e) =>
                              (e.currentTarget.style.display = "none")
                            }
                          />
                        </div>
                      )}
                      <div
                        style={{
                          padding: "11px 13px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                color: T.cream,
                                fontSize: 13,
                                fontWeight: 600,
                                marginBottom: 2,
                              }}
                            >
                              {item.name}
                            </p>
                            {item.description && (
                              <p
                                style={{
                                  color: T.muted,
                                  fontSize: 11,
                                  lineHeight: 1.4,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span
                            style={{
                              fontFamily: "'Cinzel',serif",
                              fontSize: 15,
                              fontWeight: 700,
                              color: T.gold,
                              marginLeft: 8,
                              flexShrink: 0,
                            }}
                          >
                            {fmt(item.price)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAvail(item);
                            }}
                            style={{
                              flex: 1,
                              padding: "7px 8px",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 11,
                              background: item.available
                                ? "rgba(34,197,94,0.08)"
                                : "rgba(239,68,68,0.08)",
                              border: `1px solid ${item.available ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                              color: item.available ? T.green : T.red,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                            }}
                          >
                            {item.available ? "✓ On Menu" : "✗ Hidden"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(item);
                            }}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 6,
                              cursor: "pointer",
                              background:
                                editItem?._id === item._id
                                  ? T.goldDim
                                  : "rgba(212,168,67,0.06)",
                              border: `1px solid ${editItem?._id === item._id ? T.gold : "rgba(212,168,67,0.2)"}`,
                              color: T.gold,
                              fontSize: 11,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            disabled={busyIds.has(item._id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(item._id);
                            }}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 6,
                              cursor: busyIds.has(item._id)
                                ? "wait"
                                : "pointer",
                              background: "rgba(239,68,68,0.07)",
                              border: "1px solid rgba(239,68,68,0.2)",
                              color: T.red,
                              fontSize: 11,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              opacity: busyIds.has(item._id) ? 0.5 : 1,
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {localItems.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: T.faint,
              }}
            >
              <UtensilsCrossed
                size={40}
                style={{ margin: "0 auto 12px", opacity: 0.3 }}
              />
              <p style={{ fontSize: 14 }}>
                No menu items yet — add your first one above
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── SALES CALENDAR ────────────────────────────────────────────────────────────
function SalesCalendar({
  orders,
  dailyReports,
}: {
  orders: Order[];
  dailyReports: DailyReport[];
}) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const dailyStats: Record<
    string,
    { revenue: number; count: number; orders: Order[]; report?: DailyReport }
  > = {};

  dailyReports.forEach((r) => {
    dailyStats[r.dayKey] = {
      revenue: r.revenue,
      count: r.orderCount,
      orders: r.orders || [],
      report: r,
    };
  });

  orders.forEach((o) => {
    if (o.status !== "completed") return;
    const d = new Date(o.createdAt);
    const calKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const key = (o as any).shiftDate || calKey;
    if (!dailyStats[key] || !dailyStats[key].report) {
      if (!dailyStats[key])
        dailyStats[key] = { revenue: 0, count: 0, orders: [] };
      dailyStats[key].revenue += o.total;
      dailyStats[key].count++;
      dailyStats[key].orders.push(o);
    }
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStats = Object.entries(dailyStats).filter(([k]) =>
    k.startsWith(monthPrefix),
  );
  const monthRevenue = monthStats.reduce((s, [, v]) => s + v.revenue, 0);
  const monthOrders = monthStats.reduce((s, [, v]) => s + v.count, 0);
  const maxRev = Math.max(
    ...Object.values(dailyStats).map((d) => d.revenue),
    1,
  );

  const today = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const selectedStats = selectedDay ? dailyStats[selectedDay] : null;

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

  async function copyAsImage() {
    if (!calendarRef.current) return;
    setCopying(true);
    try {
      if (!(window as any).html2canvas) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src =
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = () => res();
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const canvas = await (window as any).html2canvas(calendarRef.current, {
        backgroundColor: "#0a0f0a",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob: Blob = await new Promise((res) =>
        canvas.toBlob(res, "image/png"),
      );
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopying(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback: download if clipboard not supported
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `3rdspace-${monthPrefix}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setCopying(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.error(e);
      setCopying(false);
    }
  }

  function fmtShort(n: number) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${Math.round(n)}`;
  }

  return (
    <div
      ref={calendarRef}
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <p
            style={{
              color: T.gold,
              fontSize: 11,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              fontFamily: "'Cinzel',serif",
              marginBottom: 6,
            }}
          >
            ──Sales Calendar
          </p>
          <p
            style={{
              color: T.cream,
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Cinzel',serif",
            }}
          >
            {MONTHS[month]} {year}
          </p>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
            <span
              style={{
                color: T.gold,
                fontFamily: "'Cinzel',serif",
                fontWeight: 700,
              }}
            >
              ₱
              {monthRevenue.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </span>
            {" · "}
            {monthOrders} order{monthOrders !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={copyAsImage}
            disabled={copying}
            style={{
              padding: "6px 14px",
              minWidth: 92,
              background: copied
                ? "rgba(34,197,94,0.12)"
                : "rgba(212,168,67,0.08)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : T.borderH}`,
              borderRadius: 8,
              color: copied ? T.green : T.gold,
              fontSize: 11,
              cursor: copying ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "'Cinzel',serif",
              letterSpacing: ".06em",
              transition: "all .15s",
            }}
          >
            {copying ? (
              <>
                <RefreshCw
                  size={12}
                  style={{ animation: "spin .7s linear infinite" }}
                />{" "}
                COPYING
              </>
            ) : copied ? (
              <>
                <Check size={12} /> COPIED
              </>
            ) : (
              <>
                <CopyIcon size={12} /> COPY
              </>
            )}
          </button>
          <button
            onClick={() => {
              setCurrentMonth(new Date(year, month - 1, 1));
              setSelectedDay(null);
            }}
            style={{
              width: 34,
              height: 34,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.muted,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ‹
          </button>
          <button
            onClick={() => {
              setCurrentMonth(new Date(year, month + 1, 1));
              setSelectedDay(null);
            }}
            style={{
              width: 34,
              height: 34,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.muted,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ›
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: 3,
          marginBottom: 3,
        }}
      >
        {DAYS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              color: T.faint,
              fontSize: 10,
              padding: "4px 0",
              fontFamily: "'Cinzel',serif",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: 3,
        }}
      >
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const stats = dailyStats[key];
          const isClosed = !!stats?.report;
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const intensity = stats ? Math.min(stats.revenue / maxRev, 1) : 0;
          const isFuture =
            new Date(key + "T23:59:59") > today && key !== todayKey;
          return (
            <div
              key={key}
              onClick={() =>
                !isFuture && setSelectedDay(isSelected ? null : key)
              }
              title={
                stats
                  ? `₱${stats.revenue.toLocaleString("en-PH", { minimumFractionDigits: 0 })} · ${stats.count} orders${isClosed ? " ✓ Closed" : ""}`
                  : undefined
              }
              style={{
                aspectRatio: "1",
                borderRadius: 6,
                cursor: isFuture ? "default" : "pointer",
                background: isSelected
                  ? "rgba(212,168,67,0.22)"
                  : stats
                    ? `rgba(34,197,94,${0.07 + intensity * 0.38})`
                    : "rgba(255,255,255,0.02)",
                border: isSelected
                  ? `1px solid ${T.gold}`
                  : isClosed
                    ? "1px solid rgba(34,197,94,0.45)"
                    : isToday
                      ? "1px solid rgba(212,168,67,0.55)"
                      : stats
                        ? `1px solid rgba(34,197,94,${0.1 + intensity * 0.35})`
                        : `1px solid ${T.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 2,
                transition: "all .12s",
                opacity: isFuture ? 0.3 : 1,
                position: "relative",
              }}
            >
              {isClosed && (
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: T.green,
                    boxShadow: "0 0 4px rgba(34,197,94,0.8)",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isToday || isSelected ? 700 : 400,
                  color: isSelected
                    ? T.gold
                    : isToday
                      ? T.gold
                      : stats
                        ? "#4ade80"
                        : T.muted,
                  lineHeight: 1,
                }}
              >
                {day}
              </span>
              {stats && (
                <span
                  style={{
                    fontSize: "0.62rem",
                    color: isSelected ? T.gold : "#4ade80",
                    lineHeight: 1,
                    marginTop: 2,
                    fontWeight: 600,
                  }}
                >
                  ₱{fmtShort(stats.revenue)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: T.faint, fontSize: 10 }}>Less</span>
        {[0.07, 0.15, 0.24, 0.33, 0.45].map((a, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: `rgba(34,197,94,${a})`,
              border: `1px solid rgba(34,197,94,${a + 0.1})`,
            }}
          />
        ))}
        <span style={{ color: T.faint, fontSize: 10 }}>More</span>
        <span style={{ color: T.faint, fontSize: 10, marginLeft: 8 }}>·</span>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: T.green,
          }}
        />
        <span style={{ color: T.faint, fontSize: 10 }}>Day Closed</span>
      </div>

      {selectedDay && (
        <div
          onClick={() => setSelectedDay(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f1a0f",
              border: `1px solid ${T.borderH}`,
              borderRadius: 18,
              padding: "24px",
              width: "100%",
              maxWidth: 560,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: -8,
              }}
            >
              <button
                onClick={() => setSelectedDay(null)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${T.border}`,
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  color: T.muted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <p
                style={{
                  color: T.cream,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                {new Date(selectedDay + "T12:00:00").toLocaleDateString(
                  "en-PH",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </p>
              {selectedStats ? (
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span
                    style={{
                      color: T.green,
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "'Cinzel',serif",
                    }}
                  >
                    ₱
                    {selectedStats.revenue.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span style={{ color: T.muted, fontSize: 12 }}>
                    {selectedStats.count} completed
                  </span>
                </div>
              ) : (
                <span style={{ color: T.faint, fontSize: 12 }}>No sales</span>
              )}
            </div>

            {selectedStats?.report && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {selectedStats.report.openedAt && (
                    <div
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 8,
                        padding: "10px 12px",
                      }}
                    >
                      <p
                        style={{
                          color: T.muted,
                          fontSize: 9,
                          letterSpacing: ".1em",
                          fontFamily: "'Cinzel',serif",
                          marginBottom: 4,
                        }}
                      >
                        OPENED AT
                      </p>
                      <p
                        style={{
                          color: T.green,
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {new Date(
                          selectedStats.report.openedAt,
                        ).toLocaleTimeString("en-PH", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  )}
                  <div
                    style={{
                      background: "rgba(239,68,68,0.06)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        color: T.muted,
                        fontSize: 9,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                        marginBottom: 4,
                      }}
                    >
                      CLOSED AT
                    </p>
                    <p style={{ color: T.red, fontSize: 14, fontWeight: 700 }}>
                      {new Date(
                        selectedStats.report.closedAt,
                      ).toLocaleTimeString("en-PH", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                  </div>
                  <div
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        color: T.muted,
                        fontSize: 9,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                        marginBottom: 4,
                      }}
                    >
                      NET SALES
                    </p>
                    <p
                      style={{
                        color: T.gold,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "'Cinzel',serif",
                      }}
                    >
                      ₱
                      {(
                        selectedStats.report.netRevenue ||
                        selectedStats.report.revenue
                      ).toLocaleString("en-PH", { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                  {!!selectedStats.report.paidInTotal && (
                    <div
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 8,
                        padding: "10px 12px",
                      }}
                    >
                      <p
                        style={{
                          color: T.muted,
                          fontSize: 9,
                          letterSpacing: ".1em",
                          fontFamily: "'Cinzel',serif",
                          marginBottom: 4,
                        }}
                      >
                        PAID IN
                      </p>
                      <p
                        style={{
                          color: T.green,
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        +₱
                        {selectedStats.report.paidInTotal.toLocaleString(
                          "en-PH",
                          { minimumFractionDigits: 0 },
                        )}
                      </p>
                    </div>
                  )}
                  {!!selectedStats.report.paidOutTotal && (
                    <div
                      style={{
                        background: "rgba(239,68,68,0.06)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 8,
                        padding: "10px 12px",
                      }}
                    >
                      <p
                        style={{
                          color: T.muted,
                          fontSize: 9,
                          letterSpacing: ".1em",
                          fontFamily: "'Cinzel',serif",
                          marginBottom: 4,
                        }}
                      >
                        PAID OUT
                      </p>
                      <p
                        style={{
                          color: T.red,
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        -₱
                        {selectedStats.report.paidOutTotal.toLocaleString(
                          "en-PH",
                          { minimumFractionDigits: 0 },
                        )}
                      </p>
                    </div>
                  )}
                  <div
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        color: T.muted,
                        fontSize: 9,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                        marginBottom: 4,
                      }}
                    >
                      AVG ORDER
                    </p>
                    <p
                      style={{
                        color: T.blue,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "'Cinzel',serif",
                      }}
                    >
                      ₱
                      {Math.round(
                        selectedStats.report.avgOrder || 0,
                      ).toLocaleString("en-PH")}
                    </p>
                  </div>
                  {selectedStats.report.deliveryFees > 0 && (
                    <div
                      style={{
                        background: T.bgCard,
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                      }}
                    >
                      <p
                        style={{
                          color: T.muted,
                          fontSize: 9,
                          letterSpacing: ".1em",
                          fontFamily: "'Cinzel',serif",
                          marginBottom: 4,
                        }}
                      >
                        DELIVERY FEES
                      </p>
                      <p
                        style={{ color: T.gold, fontSize: 13, fontWeight: 700 }}
                      >
                        ₱
                        {selectedStats.report.deliveryFees.toLocaleString(
                          "en-PH",
                          { minimumFractionDigits: 0 },
                        )}
                      </p>
                    </div>
                  )}
                  <div
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        color: T.muted,
                        fontSize: 9,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                        marginBottom: 4,
                      }}
                    >
                      CANCELLED
                    </p>
                    <p style={{ color: T.red, fontSize: 13, fontWeight: 700 }}>
                      {selectedStats.report.cancelledCount || 0}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        color: T.muted,
                        fontSize: 9,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                        marginBottom: 8,
                      }}
                    >
                      PAYMENT
                    </p>
                    {[
                      {
                        label: "Cash",
                        value: selectedStats.report.cashRev,
                        color: T.green,
                      },
                      {
                        label: "GCash",
                        value: selectedStats.report.gcashRev,
                        color: T.gold,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          {s.label}
                        </span>
                        <span
                          style={{
                            color: s.color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          ₱
                          {s.value.toLocaleString("en-PH", {
                            minimumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        color: T.muted,
                        fontSize: 9,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                        marginBottom: 8,
                      }}
                    >
                      BY TYPE
                    </p>
                    {[
                      {
                        label: "Dine-in",
                        value: selectedStats.report.dineInRev,
                        color: T.green,
                      },
                      {
                        label: "Delivery",
                        value: selectedStats.report.deliveryRev,
                        color: T.gold,
                      },
                      {
                        label: "Takeout",
                        value: selectedStats.report.takeoutRev,
                        color: T.blue,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 3,
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          {s.label}
                        </span>
                        <span
                          style={{
                            color: s.color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          ₱
                          {s.value.toLocaleString("en-PH", {
                            minimumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedStats &&
              (() => {
                const orderList = selectedStats.report?.orders?.length
                  ? selectedStats.report.orders
                  : selectedStats.orders;
                return (
                  orderList.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        maxHeight: 400,
                        overflowY: "auto",
                        marginTop: 8,
                        paddingRight: 4,
                      }}
                    >
                      {[...orderList]
                        .sort(
                          (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime(),
                        )
                        .map((o) => (
                          <div
                            key={o._id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "14px 18px",
                              background: "rgba(255,255,255,0.03)",
                              border: `1px solid ${T.border}`,
                              borderRadius: 12,
                              flexWrap: "wrap",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "'Cinzel',serif",
                                  fontSize: 12,
                                  color: T.cream,
                                  fontWeight: 700,
                                }}
                              >
                                #{o.orderNumber}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  color:
                                    o.type === "delivery"
                                      ? T.gold
                                      : o.type === "takeout"
                                        ? T.blue
                                        : T.green,
                                  background:
                                    o.type === "delivery"
                                      ? "rgba(212,168,67,0.1)"
                                      : o.type === "takeout"
                                        ? "rgba(91,155,213,0.1)"
                                        : "rgba(34,197,94,0.1)",
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: ".06em",
                                }}
                              >
                                {o.type}
                              </span>
                              {o.customerName && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: T.muted,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 110,
                                  }}
                                >
                                  {o.customerName}
                                </span>
                              )}
                              {o.items?.length > 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: T.faint,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 180,
                                  }}
                                >
                                  ·{" "}
                                  {o.items
                                    .map((it) => `${it.quantity}× ${it.name}`)
                                    .join(", ")}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <span style={{ fontSize: 11, color: T.faint }}>
                                {new Date(o.createdAt).toLocaleTimeString(
                                  "en-PH",
                                  {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  },
                                )}
                              </span>
                              <span
                                style={{
                                  fontFamily: "'Cinzel',serif",
                                  fontSize: 13,
                                  color: T.gold,
                                  fontWeight: 700,
                                }}
                              >
                                {fmt(o.total)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )
                );
              })()}

            {!selectedStats && (
              <p
                style={{
                  color: T.faint,
                  fontSize: 13,
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                No completed orders on this day
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// ── PRODUCT PROFIT TABLE ──────────────────────────────────────────────────────
function ProductProfitTable({
  orders,
  menuItems,
}: {
  orders: Order[];
  menuItems: MenuItem[];
}) {
  const completed = orders.filter((o) => o.status === "completed");
  if (!completed.length) return null;

  const map: Record<string, { qty: number; revenue: number; cost: number }> =
    {};
  for (const order of completed) {
    for (const it of order.items) {
      const itBase = it.name
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim();
      const mi = menuItems.find((m) => {
        const mBase = m.name
          .toLowerCase()
          .replace(/\s*\(.*?\)\s*/g, "")
          .trim();
        return (
          it.name.toLowerCase() === m.name.toLowerCase() ||
          itBase === mBase ||
          it.name.toLowerCase().includes(m.name.toLowerCase()) ||
          m.name.toLowerCase().includes(itBase)
        );
      });
      if (!map[it.name]) map[it.name] = { qty: 0, revenue: 0, cost: 0 };
      map[it.name].qty += it.quantity;
      map[it.name].revenue += it.price * it.quantity;
      map[it.name].cost += (mi?.cost || 0) * it.quantity;
    }
  }

  const rows = Object.entries(map)
    .map(([name, d]) => ({
      name,
      qty: d.qty,
      revenue: d.revenue,
      cost: d.cost,
      profit: d.revenue - d.cost,
      margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
      hasCost: d.cost > 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div style={{ marginTop: 28 }}>
      <p
        style={{
          color: T.gold,
          fontSize: 11,
          letterSpacing: ".15em",
          textTransform: "uppercase",
          fontFamily: "'Cinzel',serif",
          marginBottom: 4,
        }}
      >
        ──Product Profit Breakdown
      </p>
      <p style={{ color: T.muted, fontSize: 10, marginBottom: 14 }}>
        Based on completed orders · costs from costing sheet
      </p>
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        {[
          { label: "Total Revenue", value: fmt(totalRevenue), color: T.cream },
          { label: "Total Cost", value: fmt(totalCost), color: "#f87171" },
          { label: "Total Profit", value: fmt(totalProfit), color: T.green },
          {
            label: "Avg Margin",
            value: `${totalMargin.toFixed(1)}%`,
            color:
              totalMargin >= 40
                ? T.green
                : totalMargin >= 20
                  ? "#f59e0b"
                  : "#f87171",
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              minWidth: 100,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <p
              style={{
                color: T.muted,
                fontSize: 9,
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              {s.label}
            </p>
            <p
              style={{
                color: s.color,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "'Cinzel',serif",
              }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
      <div
        style={{
          overflowX: "auto",
          borderRadius: 8,
          border: `1px solid ${T.border}`,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}
        >
          <thead>
            <tr
              style={{
                background: "rgba(255,255,255,0.04)",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              {["Product", "Qty", "Revenue", "Cost", "Profit", "Margin"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      color: T.muted,
                      textAlign: h === "Product" ? "left" : "right",
                      padding: "8px 12px",
                      fontWeight: 600,
                      fontSize: 10,
                      letterSpacing: 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.name}
                style={{
                  borderBottom:
                    i < rows.length - 1
                      ? `1px solid rgba(255,255,255,0.04)`
                      : "none",
                  background:
                    i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                }}
              >
                <td
                  style={{
                    color: T.cream,
                    padding: "7px 12px",
                    maxWidth: 180,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.name}
                </td>
                <td
                  style={{
                    color: T.muted,
                    padding: "7px 12px",
                    textAlign: "right",
                  }}
                >
                  ×{r.qty}
                </td>
                <td
                  style={{
                    color: T.cream,
                    padding: "7px 12px",
                    textAlign: "right",
                  }}
                >
                  {fmt(r.revenue)}
                </td>
                <td
                  style={{
                    color: r.hasCost ? "#f87171" : T.muted,
                    padding: "7px 12px",
                    textAlign: "right",
                  }}
                >
                  {r.hasCost ? fmt(r.cost) : "—"}
                </td>
                <td
                  style={{
                    color: r.hasCost
                      ? r.profit >= 0
                        ? T.green
                        : "#f87171"
                      : T.muted,
                    padding: "7px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {r.hasCost ? fmt(r.profit) : "—"}
                </td>
                <td style={{ padding: "7px 12px", textAlign: "right" }}>
                  {r.hasCost ? (
                    <span
                      style={{
                        color:
                          r.margin >= 40
                            ? T.green
                            : r.margin >= 20
                              ? "#f59e0b"
                              : "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      {r.margin.toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ color: T.muted }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TODAY'S REPORT ────────────────────────────────────────────────────────────
function TodayReport({
  orders,
  activeShiftDate,
  activeShiftOpenedAt,
  closedReport,
  lastShiftReport,
  menuItems,
  shiftStartingCash = 0,
  liveCashLog = { paidInTotal: 0, paidOutTotal: 0 },
  cashDataLoaded = true,
  onPrintDayReport,
}: {
  orders: Order[];
  activeShiftDate?: string | null;
  activeShiftOpenedAt?: string | null;
  closedReport?: DailyReport | null;
  lastShiftReport?: ShiftReport | null;
  menuItems?: MenuItem[];
  shiftStartingCash?: number;
  liveCashLog?: { paidInTotal: number; paidOutTotal: number };
  cashDataLoaded?: boolean;
  onPrintDayReport?: () => void;
}) {
  const today = new Date();

  if (closedReport) {
    const topItems = Object.entries(closedReport.items || {})
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6);

    const hasCashRecon = typeof closedReport.expectedCash === "number";

    const printShiftReport = () => {
      const win = window.open("", "_blank", "width=380,height=600");
      if (!win) return;

      // Prefer the specific shift's own ShiftReport (accurate, per-shift
      // numbers) over the whole-day DailyReport, which sums every shift
      // that ran today and was silently overstating cash sales / expected
      // cash / total cash in drawer whenever more than one shift ran.
      const sr = lastShiftReport;
      // sr.revenue is already the actual amount charged (order.total is
      // computed post-discount at the item level) — so it's Net, not
      // Gross. Gross is net + discount added back, not net - discount.
      const discountTotal = sr
        ? sr.discountTotal || 0
        : closedReport.discountTotal || 0;
      const netRevenue = sr
        ? sr.revenue
        : (closedReport.netRevenue ?? closedReport.revenue);
      const revenue = netRevenue + discountTotal;
      const cashRev = sr ? sr.cashRev : closedReport.cashRev;
      const gcashRev = sr ? sr.gcashRev : closedReport.gcashRev;
      const orderCount = sr ? sr.orderCount : closedReport.orderCount;
      const cancelledCount = sr
        ? sr.cancelledCount || 0
        : closedReport.cancelledCount || 0;
      const avgOrder = sr
        ? sr.orderCount
          ? sr.revenue / sr.orderCount
          : 0
        : closedReport.avgOrder || 0;
      const deliveryFees = sr ? 0 : closedReport.deliveryFees || 0;
      const startingCash = sr
        ? sr.startingCash || 0
        : closedReport.startingCash || 0;
      const expectedCash = sr
        ? (sr.startingCash || 0) +
          sr.cashRev +
          (sr.paidInTotal || 0) -
          (sr.paidOutTotal || 0)
        : closedReport.expectedCash || 0;
      const countedCash = sr ? sr.countedCash : closedReport.countedCash;
      const cashDiff = sr ? sr.cashDiff : closedReport.cashDiff;
      const openedAtIso = sr ? sr.openedAt : closedReport.openedAt;
      const closedAtIso = sr ? sr.closedAt : closedReport.closedAt;
      const shiftHasCashRecon = sr ? true : hasCashRecon;

      const dateStr = new Date(closedAtIso).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const openedStr = openedAtIso
        ? new Date(openedAtIso).toLocaleTimeString("en-PH", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : "—";
      const closedStr = new Date(closedAtIso).toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const row = (label: string, value: string) =>
        `<tr><td>${label}</td><td style="text-align:right;font-weight:700;">${value}</td></tr>`;
      const cashReconRows = shiftHasCashRecon
        ? `
<tr class="section"><td colspan="2">CASH RECONCILIATION</td></tr>
            ${row("Starting cash", `₱${startingCash.toFixed(2)}`)}
            ${row("Cash sales", `₱${cashRev.toFixed(2)}`)}
            ${sr && sr.paidInTotal ? row("Paid in", `+₱${sr.paidInTotal.toFixed(2)}`) : ""}
            ${sr && sr.paidOutTotal ? row("Paid out", `-₱${sr.paidOutTotal.toFixed(2)}`) : ""}
            ${row("Expected cash", `₱${expectedCash.toFixed(2)}`)}
            ${row("Counted cash", countedCash != null ? `₱${countedCash.toFixed(2)}` : "—")}
            ${row(
              cashDiff != null && cashDiff < 0 ? "Short by" : "Over by",
              cashDiff != null ? `₱${Math.abs(cashDiff).toFixed(2)}` : "—",
            )}
          `
        : "";
      win.document.write(`
        <html>
        <head>
          <title>Shift Report — ${dateStr}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 16px; color: #000; }
            h1 { font-size: 16px; text-align: center; margin-bottom: 2px; }
            p.sub { text-align: center; font-size: 11px; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            td { padding: 4px 0; border-bottom: 1px dashed #999; }
            tr.total td { border-top: 2px solid #000; border-bottom: none; font-size: 15px; padding-top: 8px; }
            tr.section td { padding-top: 12px; font-weight: 700; border-bottom: 1px solid #000; }
          </style>
        </head>
        <body>
          <h1>3RD SPACE — SHIFT REPORT</h1>
          <p class="sub">${dateStr}<br/>Opened ${openedStr} · Closed ${closedStr}</p>
          <table>
            <tr class="section"><td colspan="2">SALES SUMMARY</td></tr>
            ${row("Gross sales", `₱${revenue.toFixed(2)}`)}
            ${row("Discounts", `₱${discountTotal.toFixed(2)}`)}
            ${row("Refunds", "₱0.00")}
            ${row("Net sales", `₱${netRevenue.toFixed(2)}`)}
            <tr class="section"><td colspan="2">PAYMENT BREAKDOWN</td></tr>
            ${row("Cash", `₱${cashRev.toFixed(2)}`)}
            ${row("GCash", `₱${gcashRev.toFixed(2)}`)}
            <tr class="section"><td colspan="2">ORDERS</td></tr>
            ${row("Completed", String(orderCount))}
            ${row("Cancelled", String(cancelledCount))}
            ${row("Avg order", `₱${Math.round(avgOrder)}`)}
            ${row("Delivery fees", `₱${deliveryFees}`)}
${cashReconRows}
            <tr class="total"><td>TOTAL CASH IN DRAWER</td><td style="text-align:right;font-weight:700;">₱${(countedCash != null ? countedCash : expectedCash).toFixed(2)}</td></tr>
          </table>
        </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: T.muted,
            flexWrap: "wrap",
          }}
        >
          <PowerOff size={14} color={T.red} />
          <span>
            Store closed at{" "}
            <strong style={{ color: T.red }}>
              {new Date(closedReport.closedAt).toLocaleTimeString("en-PH", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </strong>
          </span>
          {closedReport.openedAt && (
            <span style={{ color: T.faint, fontSize: 12 }}>
              · Opened at{" "}
              {new Date(closedReport.openedAt).toLocaleTimeString("en-PH", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          )}
          {onPrintDayReport && (
            <button
              onClick={onPrintDayReport}
              style={{
                marginLeft: "auto",
                padding: "6px 14px",
                background: "rgba(212,168,67,0.1)",
                border: `1px solid ${T.borderH}`,
                borderRadius: 8,
                color: T.gold,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'Cinzel',serif",
                letterSpacing: ".06em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Printer size={12} /> PRINT DAY REPORT
            </button>
          )}
        </div>

        {hasCashRecon && (
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 20,
            }}
          >
            <p
              style={{
                color: T.gold,
                fontSize: 11,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                fontFamily: "'Cinzel',serif",
                marginBottom: 14,
              }}
            >
              ──Cash Reconciliation
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {(
                [
                  {
                    label: "Starting cash",
                    val: fmt(closedReport.startingCash || 0),
                    color: T.cream,
                  },
                  {
                    label: "Cash sales",
                    val: fmt(closedReport.cashRev),
                    color: T.green,
                  },
                  ...(closedReport.paidInTotal
                    ? [
                        {
                          label: "Paid in",
                          val: `+${fmt(closedReport.paidInTotal)}`,
                          color: T.green,
                        },
                      ]
                    : []),
                  ...(closedReport.paidOutTotal
                    ? [
                        {
                          label: "Paid out",
                          val: `-${fmt(closedReport.paidOutTotal)}`,
                          color: T.red,
                        },
                      ]
                    : []),
                  {
                    label: "Expected cash",
                    val: fmt(closedReport.expectedCash || 0),
                    color: T.gold,
                  },
                  {
                    label: "Counted cash",
                    val:
                      closedReport.countedCash != null
                        ? fmt(closedReport.countedCash)
                        : "—",
                    color: T.cream,
                  },
                ] as { label: string; val: string; color: string }[]
              ).map(({ label, val, color }) => (
                <div
                  key={label}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: T.muted, fontSize: 12 }}>{label}</span>
                  <span
                    style={{
                      color: color as string,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {val}
                  </span>
                </div>
              ))}
              {closedReport.cashDiff != null && (
                <div
                  style={{
                    borderTop: `1px solid ${T.border}`,
                    paddingTop: 8,
                    marginTop: 2,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: T.muted, fontSize: 12 }}>
                    {closedReport.cashDiff === 0
                      ? "Drawer matched ✓"
                      : closedReport.cashDiff > 0
                        ? "Over by"
                        : "Short by"}
                  </span>
                  <span
                    style={{
                      color: closedReport.cashDiff === 0 ? T.green : T.red,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {fmt(Math.abs(closedReport.cashDiff))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            background:
              "linear-gradient(135deg,rgba(212,168,67,0.09) 0%,rgba(34,197,94,0.04) 100%)",
            border: `1px solid ${T.borderH}`,
            borderRadius: 16,
            padding: "22px 24px",
          }}
        >
          <p
            style={{
              color: T.gold,
              fontSize: 10,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              fontFamily: "'Cinzel',serif",
              marginBottom: 4,
            }}
          >
            ──Today's Final Report
          </p>
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              fontSize: "clamp(2.2rem,6vw,3.8rem)",
              fontWeight: 700,
              color: T.gold,
              lineHeight: 1,
              marginBottom: 10,
            }}
          >
            {fmt(closedReport.revenue)}
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ color: T.green, fontSize: 12 }}>
              ✓ {closedReport.orderCount} completed
            </span>
            {closedReport.cancelledCount > 0 && (
              <span style={{ color: T.red, fontSize: 12 }}>
                ✗ {closedReport.cancelledCount} cancelled
              </span>
            )}
            {closedReport.deliveryFees > 0 && (
              <span
                style={{
                  color: T.muted,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Bike size={12} /> {fmt(closedReport.deliveryFees)} delivery
                fees
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 10,
          }}
        >
          {[
            {
              label: "Net Revenue",
              value: fmt(closedReport.netRevenue || closedReport.revenue),
              color: T.green,
            },
            {
              label: "Avg Order",
              value: fmt(closedReport.avgOrder || 0),
              color: T.blue,
            },
            { label: "Cash", value: fmt(closedReport.cashRev), color: T.green },
            {
              label: "GCash",
              value: fmt(closedReport.gcashRev),
              color: T.gold,
            },
            {
              label: "Dine-In",
              value: fmt(closedReport.dineInRev),
              color: T.green,
            },
            {
              label: "Delivery",
              value: fmt(closedReport.deliveryRev),
              color: T.gold,
            },
            ...(closedReport.takeoutRev > 0
              ? [
                  {
                    label: "Takeout",
                    value: fmt(closedReport.takeoutRev),
                    color: T.blue,
                  },
                ]
              : []),
            ...(closedReport.discountTotal
              ? [
                  {
                    label: "Discounts Given",
                    value: fmt(closedReport.discountTotal),
                    color: T.red,
                  },
                ]
              : []),
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <p
                style={{
                  color: T.muted,
                  fontSize: 9,
                  letterSpacing: ".12em",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </p>
              <p
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: s.color,
                }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {topItems.length > 0 && (
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 20,
            }}
          >
            <p
              style={{
                color: T.gold,
                fontSize: 11,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                fontFamily: "'Cinzel',serif",
                marginBottom: 14,
              }}
            >
              ──Top Items Today
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topItems.map(([name, s], i) => (
                <div key={name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Cinzel',serif",
                          fontSize: 10,
                          color: i === 0 ? T.gold : T.faint,
                          fontWeight: 700,
                          minWidth: 14,
                          flexShrink: 0,
                        }}
                      >
                        #{i + 1}
                      </span>
                      <span
                        style={{
                          color: T.cream,
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                      </span>
                      <span
                        style={{ color: T.faint, fontSize: 10, flexShrink: 0 }}
                      >
                        {s.qty}×
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Cinzel',serif",
                        color: i === 0 ? T.gold : T.cream,
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {fmt(s.revenue)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        height: 4,
                        borderRadius: 99,
                        background:
                          i === 0 ? T.gold : `rgba(34,197,94,${0.8 - i * 0.1})`,
                        width: `${(s.revenue / (topItems[0][1].revenue || 1)) * 100}%`,
                        transition: "width .4s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);

  const todayOrders = !activeShiftOpenedAt
    ? []
    : orders.filter((o) => {
        const created = new Date(o.createdAt);
        if (created < new Date(activeShiftOpenedAt)) return false;
        // Guard against a stale/never-reset openedAt leaking prior-day
        // orders into "today's" totals — always require same calendar day,
        // compared in Asia/Manila (not the device's local timezone) so this
        // matches the server's dayKeyOf() exactly.
        return (
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(created) === todayKey
        );
      });

  const completed = todayOrders.filter((o) => o.status === "completed");
  const revenue = completed.reduce((s, o) => s + o.total, 0);
  const active = todayOrders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  ).length;
  const cancelled = todayOrders.filter((o) => o.status === "cancelled").length;

  // Top items
  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  completed.forEach((o) => {
    o.items.forEach((it) => {
      if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0 };
      itemMap[it.name].qty += it.quantity;
      itemMap[it.name].revenue += it.price * it.quantity;
    });
  });
  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6);

  // Payment split
  const cashOrders = completed.filter(
    (o) => o.paymentMethod === "cash" || o.paymentMethod === "split",
  );
  const gcashOrders = completed.filter(
    (o) => o.paymentMethod === "gcash" || o.paymentMethod === "split",
  );
  const cashRev = completed.reduce((s, o) => {
    if (o.paymentMethod === "cash") return s + o.total;
    if (o.paymentMethod === "split") return s + (o.cashAmount ?? 0);
    return s;
  }, 0);
  const gcashRev = completed.reduce((s, o) => {
    if (o.paymentMethod === "gcash") return s + o.total;
    if (o.paymentMethod === "split") return s + (o.gcashAmount ?? 0);
    return s;
  }, 0);

  // Order type revenue
  const deliveryRev = completed
    .filter((o) => o.type === "delivery")
    .reduce((s, o) => s + o.total, 0);
  const dineInRev = completed
    .filter((o) => o.type === "dine-in")
    .reduce((s, o) => s + o.total, 0);
  const takeoutRev = completed
    .filter((o) => o.type === "takeout")
    .reduce((s, o) => s + o.total, 0);

  // Delivery fees collected today
  const deliveryFeesTotal = completed
    .filter((o) => o.type === "delivery")
    .reduce((s, o) => s + ((o as any).deliveryFee || 0), 0);

  // Hourly breakdown
  const hourly: Record<number, number> = {};
  completed.forEach((o) => {
    const h = new Date(o.createdAt).getHours();
    hourly[h] = (hourly[h] || 0) + o.total;
  });
  const maxHourRev = Math.max(...Object.values(hourly), 1);
  const peakHourEntry = Object.entries(hourly).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  )[0];

  function fmtHour(h: number) {
    if (h === 0) return "12AM";
    if (h < 12) return `${h}AM`;
    if (h === 12) return "12PM";
    return `${h - 12}PM`;
  }

  const dateStr = today.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const w = useWindowWidth();
  const isMobile = w < 640;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Hero revenue */}
      <div
        style={{
          background:
            "linear-gradient(135deg,rgba(212,168,67,0.09) 0%,rgba(34,197,94,0.04) 100%)",
          border: `1px solid ${T.borderH}`,
          borderRadius: 16,
          padding: "22px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div>
            <p
              style={{
                color: T.gold,
                fontSize: 10,
                letterSpacing: ".2em",
                textTransform: "uppercase",
                fontFamily: "'Cinzel',serif",
                marginBottom: 4,
              }}
            >
              ──Current Shift's Report
            </p>
            <p style={{ color: T.muted, fontSize: 12, marginBottom: 14 }}>
              {dateStr}
            </p>
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: "clamp(2.2rem,6vw,3.8rem)",
                fontWeight: 700,
                color: T.gold,
                lineHeight: 1,
              }}
            >
              {fmt(revenue)}
            </p>
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: T.green, fontSize: 12 }}>
                ✓ {completed.length} completed
              </span>
              {active > 0 && (
                <span style={{ color: "#f59e0b", fontSize: 12 }}>
                  ⏳ {active} active
                </span>
              )}
              {cancelled > 0 && (
                <span style={{ color: T.red, fontSize: 12 }}>
                  ✗ {cancelled} cancelled
                </span>
              )}
              {deliveryFeesTotal > 0 && (
                <span
                  style={{
                    color: T.muted,
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Bike size={12} /> {fmt(deliveryFeesTotal)} delivery fees
                </span>
              )}
            </div>
          </div>
          {peakHourEntry && (
            <div
              style={{
                background: "rgba(212,168,67,0.08)",
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: "14px 20px",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  color: T.muted,
                  fontSize: 9,
                  letterSpacing: ".15em",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 8,
                }}
              >
                PEAK HOUR
              </p>
              <p
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 26,
                  fontWeight: 700,
                  color: T.cream,
                  lineHeight: 1,
                }}
              >
                {fmtHour(parseInt(peakHourEntry[0]))}
              </p>
              <p style={{ color: T.gold, fontSize: 12, marginTop: 6 }}>
                {fmt(Number(peakHourEntry[1]))}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hourly chart */}
      {Object.keys(hourly).length > 0 && (
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 20,
          }}
        >
          <p
            style={{
              color: T.gold,
              fontSize: 11,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              fontFamily: "'Cinzel',serif",
              marginBottom: 16,
            }}
          >
            ──Revenue by Hour
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 2,
              height: 72,
            }}
          >
            {Array.from({ length: 24 }, (_, h) => {
              const rev = hourly[h] || 0;
              const pct = rev / maxHourRev;
              const isNow = h === today.getHours();
              return (
                <div
                  key={h}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <div
                    title={
                      rev > 0 ? `${fmtHour(h)} — ${fmt(rev)}` : `${fmtHour(h)}`
                    }
                    style={{
                      width: "100%",
                      height: `${Math.max(pct * 56, rev > 0 ? 4 : 0)}px`,
                      background: isNow
                        ? T.gold
                        : rev > 0
                          ? `rgba(34,197,94,${0.25 + pct * 0.75})`
                          : "rgba(255,255,255,0.03)",
                      borderRadius: "3px 3px 0 0",
                      border: isNow ? `1px solid ${T.gold}` : "none",
                      cursor: rev > 0 ? "pointer" : "default",
                      transition: "height .3s",
                    }}
                  />
                  {h % 6 === 0 && (
                    <span
                      style={{
                        fontSize: 7,
                        color: T.faint,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtHour(h)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr 1fr",
          gap: 12,
        }}
      >
        {/* Top items */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 20,
          }}
        >
          <p
            style={{
              color: T.gold,
              fontSize: 11,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              fontFamily: "'Cinzel',serif",
              marginBottom: 14,
            }}
          >
            ──Top Items
          </p>
          {topItems.length === 0 ? (
            <p style={{ color: T.faint, fontSize: 12 }}>
              No completed orders yet
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topItems.map(([name, s], i) => (
                <div key={name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Cinzel',serif",
                          fontSize: 10,
                          color: i === 0 ? T.gold : T.faint,
                          fontWeight: 700,
                          minWidth: 14,
                          flexShrink: 0,
                        }}
                      >
                        #{i + 1}
                      </span>
                      <span
                        style={{
                          color: T.cream,
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                      </span>
                      <span
                        style={{ color: T.faint, fontSize: 10, flexShrink: 0 }}
                      >
                        {s.qty}×
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Cinzel',serif",
                        color: i === 0 ? T.gold : T.cream,
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {fmt(s.revenue)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        height: 4,
                        borderRadius: 99,
                        background:
                          i === 0 ? T.gold : `rgba(34,197,94,${0.8 - i * 0.1})`,
                        width: `${(s.revenue / (topItems[0][1].revenue || 1)) * 100}%`,
                        transition: "width .4s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment + By Type merged */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div>
            <p
              style={{
                color: T.gold,
                fontSize: 11,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                fontFamily: "'Cinzel',serif",
                marginBottom: 14,
              }}
            >
              ──Payment
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  label: "Cash",
                  value: cashRev,
                  count: cashOrders.length,
                  color: T.green,
                },
                {
                  label: "GCash",
                  value: gcashRev,
                  count: gcashOrders.length,
                  color: T.gold,
                },
              ].map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ color: T.muted, fontSize: 12 }}>
                      {s.label}{" "}
                      <span style={{ color: T.faint, fontSize: 10 }}>
                        ({s.count})
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: "'Cinzel',serif",
                        color: s.color,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {fmt(s.value)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        height: 5,
                        borderRadius: 99,
                        background: s.color,
                        width:
                          revenue > 0 ? `${(s.value / revenue) * 100}%` : "0%",
                        transition: "width .4s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderTop: `1px solid ${T.border}`,
              paddingTop: 14,
            }}
          >
            <p
              style={{
                color: T.gold,
                fontSize: 11,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                fontFamily: "'Cinzel',serif",
                marginBottom: 14,
              }}
            >
              ──By Type
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Dine-In", value: dineInRev, color: T.green },
                { label: "Delivery", value: deliveryRev, color: T.gold },
                { label: "Takeout", value: takeoutRev, color: T.blue },
              ].map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ color: T.muted, fontSize: 12 }}>
                      {s.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Cinzel',serif",
                        color: s.color,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {fmt(s.value)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        height: 5,
                        borderRadius: 99,
                        background: s.color,
                        width:
                          revenue > 0 ? `${(s.value / revenue) * 100}%` : "0%",
                        transition: "width .4s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cash Management */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 20,
          }}
        >
          <p
            style={{
              color: T.gold,
              fontSize: 11,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              fontFamily: "'Cinzel',serif",
              marginBottom: 14,
            }}
          >
            ──Cash Management
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!cashDataLoaded && (
              <p
                style={{
                  color: T.muted,
                  fontSize: 11,
                  fontStyle: "italic",
                  marginBottom: 2,
                }}
              >
                Loading cash data…
              </p>
            )}
            {[
              {
                label: "Starting Cash",
                value: shiftStartingCash,
                color: T.cream,
              },
              {
                label: "Paid In",
                value: liveCashLog.paidInTotal,
                color: T.green,
                sign: "+",
              },
              {
                label: "Paid Out",
                value: liveCashLog.paidOutTotal,
                color: T.red,
                sign: "-",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: T.muted, fontSize: 12 }}>{s.label}</span>
                <span
                  style={{
                    fontFamily: "'Cinzel',serif",
                    color: cashDataLoaded ? s.color : T.muted,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {!cashDataLoaded
                    ? "…"
                    : `${
                        s.sign === "-" && s.value > 0
                          ? "-"
                          : s.sign === "+" && s.value > 0
                            ? "+"
                            : ""
                      }${fmt(s.value)}`}
                </span>
              </div>
            ))}
            <div
              style={{
                borderTop: `1px solid ${T.border}`,
                paddingTop: 10,
                marginTop: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: T.muted, fontSize: 12 }}>
                Drawer Should Have
              </span>
              <span
                style={{
                  fontFamily: "'Cinzel',serif",
                  color: cashDataLoaded ? T.gold : T.muted,
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {!cashDataLoaded
                  ? "…"
                  : fmt(
                      shiftStartingCash +
                        cashRev +
                        liveCashLog.paidInTotal -
                        liveCashLog.paidOutTotal,
                    )}
              </span>
            </div>
          </div>
        </div>
      </div>
      <ProductProfitTable orders={todayOrders} menuItems={menuItems ?? []} />
    </div>
  );
}

// ── ANALYTICS TAB ────────────────────────────────────────────────────────────
function AnalyticsTab({
  orders,
  dailyReports,
  activeShiftDate,
  menuItems,
  shiftReports = [],
  currentShiftLabel = "Shift 1",
  activeShiftOpenedAt,
  shiftStartingCash = 0,
  liveCashLog = { paidInTotal: 0, paidOutTotal: 0 },
  cashDataLoaded = true,
}: {
  orders: Order[];
  dailyReports: DailyReport[];
  activeShiftDate?: string | null;
  menuItems?: MenuItem[];
  shiftReports?: ShiftReport[];
  currentShiftLabel?: string;
  activeShiftOpenedAt?: string | null;
  shiftStartingCash?: number;
  liveCashLog?: { paidInTotal: number; paidOutTotal: number };
  cashDataLoaded?: boolean;
}) {
  const w = useWindowWidth();
  const isMobile = w < 640;
  const [analyticsView, setAnalyticsView] = useState<"today" | "history">(
    "today",
  );

  const todayCalKey = (() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  })();
  const closedTodayReport = !activeShiftDate
    ? (dailyReports.find((r) => r.dayKey === todayCalKey) ?? null)
    : null;
  const todaysShiftReports = shiftReports.filter(
    (sr) => sr.dayKey === todayCalKey,
  );
  const lastShiftReportToday =
    todaysShiftReports.length > 0
      ? todaysShiftReports[todaysShiftReports.length - 1]
      : null;

  // ── History day picker ──────────────────────────────────────────────────
  function shiftDayKey(key: string, delta: number) {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  const [historyDayKey, setHistoryDayKey] = useState(todayCalKey);
  const [selectedShift, setSelectedShift] = useState<ShiftReport | null>(null);
  const isViewingToday = historyDayKey === todayCalKey;
  const [pastReports, setPastReports] = useState<ShiftReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    if (analyticsView !== "history" || isViewingToday) return;
    setHistoryLoading(true);
    fetch(`/api/shift-reports?dayKey=${historyDayKey}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPastReports(Array.isArray(data) ? data : []))
      .catch(() => setPastReports([]))
      .finally(() => setHistoryLoading(false));
  }, [analyticsView, historyDayKey, isViewingToday]);
  const displayedReports = isViewingToday ? shiftReports : pastReports;
  const historyDateLabel = (() => {
    const [y, m, d] = historyDayKey.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  })();
  const dailyAggRevenue = displayedReports.reduce((s, r) => s + r.revenue, 0);
  const dailyAggOrders = displayedReports.reduce((s, r) => s + r.orderCount, 0);
  const dailyAggShorts = displayedReports.reduce(
    (s, r) => s + (r.cashDiff && r.cashDiff < 0 ? r.cashDiff : 0),
    0,
  );

  const allTimeRevenue = dailyReports.reduce((s, r) => s + r.revenue, 0);
  const allTimeCompleted = dailyReports.reduce((s, r) => s + r.orderCount, 0);
  const daysOperated = dailyReports.length;
  const avgDailyRevenue = daysOperated > 0 ? allTimeRevenue / daysOperated : 0;

  function printShiftHandover(sr: ShiftReport) {
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    const dateStr = new Date(sr.closedAt).toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const openedStr = new Date(sr.openedAt).toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const closedStr = new Date(sr.closedAt).toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const row = (label: string, value: string) =>
      `<tr><td>${label}</td><td style="text-align:right;font-weight:700;">${value}</td></tr>`;
    const topItems = Object.entries(sr.items || {})
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8);
    const itemRows = topItems
      .map(([name, s]) => row(`${name} ×${s.qty}`, fmt(s.revenue)))
      .join("");
    win.document.write(`
      <html>
      <head>
        <title>Shift Handover — ${sr.shiftLabel}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 16px; color: #000; }
          h1 { font-size: 16px; text-align: center; margin-bottom: 2px; }
          p.sub { text-align: center; font-size: 11px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          td { padding: 4px 0; border-bottom: 1px dashed #999; }
          tr.total td { border-top: 2px solid #000; border-bottom: none; font-size: 15px; padding-top: 8px; }
          tr.section td { padding-top: 12px; font-weight: 700; border-bottom: 1px solid #000; }
        </style>
      </head>
      <body>
        <h1>3RD SPACE — SHIFT HANDOVER</h1>
        <p class="sub">${sr.shiftLabel}${sr.openedBy ? ` · ${sr.openedBy}` : ""}<br/>${dateStr}<br/>Opened ${openedStr} · Closed ${closedStr}</p>
      <table>
          <tr class="section"><td colspan="2">SALES</td></tr>
          ${row("Gross revenue", fmt(sr.revenue + (sr.discountTotal || 0)))}
          ${row("Discounts", fmt(sr.discountTotal || 0))}
          ${row("Net revenue", fmt(sr.revenue))}
          ${row("Cash", fmt(sr.cashRev))}
          ${row("GCash", fmt(sr.gcashRev))}
          ${row("Orders completed", String(sr.orderCount))}
          ${row("Cancelled", String(sr.cancelledCount || 0))}
          <tr class="section"><td colspan="2">CASH DRAWER</td></tr>
          ${row("Starting cash", fmt(sr.startingCash || 0))}
          ${sr.paidInTotal ? row("Paid in", `+${fmt(sr.paidInTotal)}`) : ""}
          ${sr.paidOutTotal ? row("Paid out", `-${fmt(sr.paidOutTotal)}`) : ""}
          ${row("Expected cash", fmt((sr.startingCash || 0) + sr.cashRev + (sr.paidInTotal || 0) - (sr.paidOutTotal || 0)))}
          ${row("Counted cash", sr.countedCash != null ? fmt(sr.countedCash) : "—")}
          ${
            sr.cashDiff != null
              ? row(
                  sr.cashDiff === 0
                    ? "Balanced"
                    : sr.cashDiff > 0
                      ? "Over by"
                      : "Short by",
                  fmt(Math.abs(sr.cashDiff)),
                )
              : ""
          }
          ${
            itemRows
              ? `<tr class="section"><td colspan="2">TOP ITEMS</td></tr>${itemRows}`
              : ""
          }
</table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  function printDailyReport(reports: ShiftReport[], dateLabel: string) {
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    const row = (label: string, value: string) =>
      `<tr><td>${label}</td><td style="text-align:right;font-weight:700;">${value}</td></tr>`;

    const sorted = [...reports].sort(
      (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
    );

    const totalRevenue = sorted.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalCash = sorted.reduce((s, r) => s + (r.cashRev || 0), 0);
    const totalGcash = sorted.reduce((s, r) => s + (r.gcashRev || 0), 0);
    const totalOrders = sorted.reduce((s, r) => s + (r.orderCount || 0), 0);
    const totalCancelled = sorted.reduce(
      (s, r) => s + (r.cancelledCount || 0),
      0,
    );
    const totalDiscount = sorted.reduce(
      (s, r) => s + (r.discountTotal || 0),
      0,
    );

    const shiftSections = sorted
      .map((sr) => {
        const openedStr = new Date(sr.openedAt).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        const closedStr = new Date(sr.closedAt).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        const expectedCash =
          (sr.startingCash || 0) +
          sr.cashRev +
          (sr.paidInTotal || 0) -
          (sr.paidOutTotal || 0);
        return `
          <tr class="section"><td colspan="2">${sr.shiftLabel}${sr.openedBy ? ` · ${sr.openedBy}` : ""}</td></tr>
          ${row("Opened – Closed", `${openedStr} – ${closedStr}`)}
          ${row("Revenue", fmt(sr.revenue))}
          ${row("Orders", String(sr.orderCount))}
${row("Cash", fmt(sr.cashRev))}
          ${row("GCash", fmt(sr.gcashRev))}
          ${row("Discounts", fmt(sr.discountTotal || 0))}
          ${row("Starting cash", fmt(sr.startingCash || 0))}
          ${sr.paidInTotal ? row("Paid in", `+${fmt(sr.paidInTotal)}`) : ""}
          ${sr.paidOutTotal ? row("Paid out", `-${fmt(sr.paidOutTotal)}`) : ""}
          ${row("Expected cash", fmt(expectedCash))}
          ${row("Counted cash", sr.countedCash != null ? fmt(sr.countedCash) : "—")}
          ${
            sr.cashDiff != null
              ? row(
                  sr.cashDiff === 0
                    ? "Balanced"
                    : sr.cashDiff > 0
                      ? "Over by"
                      : "Short by",
                  fmt(Math.abs(sr.cashDiff)),
                )
              : ""
          }
        `;
      })
      .join("");

    win.document.write(`
      <html>
      <head>
        <title>Day Report — ${dateLabel}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 16px; color: #000; }
          h1 { font-size: 16px; text-align: center; margin-bottom: 2px; }
          p.sub { text-align: center; font-size: 11px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          td { padding: 4px 0; border-bottom: 1px dashed #999; }
          tr.total td { border-top: 2px solid #000; border-bottom: none; font-size: 15px; padding-top: 8px; }
          tr.section td { padding-top: 12px; font-weight: 700; border-bottom: 1px solid #000; }
        </style>
      </head>
      <body>
        <h1>3RD SPACE — DAY REPORT</h1>
        <p class="sub">${dateLabel}<br/>${sorted.length} shift${sorted.length === 1 ? "" : "s"}</p>
        <table>
          ${shiftSections}
<tr class="section"><td colspan="2">DAY TOTAL</td></tr>
${row("Gross sales", fmt(totalRevenue + totalDiscount))}
          ${row("Discounts", fmt(totalDiscount))}
          ${row("Net sales", fmt(totalRevenue))}
          ${row("Orders", String(totalOrders))}
          ${row("Cancelled", String(totalCancelled))}
          ${row("Cash", fmt(totalCash))}
          ${row("GCash", fmt(totalGcash))}
          ${row("Final drawer count", fmt(sorted[sorted.length - 1]?.countedCash ?? 0))}
<tr class="total"><td>NET SALES</td><td style="text-align:right;font-weight:700;">₱${totalRevenue.toFixed(2)}</td></tr>
        </table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(
          [
            ["today", "Today"],
            ["history", "History"],
          ] as const
        ).map(([id, label]) => {
          const a = analyticsView === id;
          return (
            <button
              key={id}
              onClick={() => setAnalyticsView(id)}
              style={{
                padding: "8px 24px",
                borderRadius: 8,
                cursor: "pointer",
                background: a ? T.gold : "rgba(255,255,255,0.04)",
                border: `1px solid ${a ? T.gold : T.border}`,
                color: a ? "#0a0f0a" : T.muted,
                fontFamily: "'Cinzel',serif",
                fontSize: 11,
                fontWeight: a ? 700 : 400,
                letterSpacing: ".1em",
              }}
            >
              {label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {analyticsView === "today" ? (
        <TodayReport
          orders={orders}
          activeShiftDate={activeShiftDate}
          activeShiftOpenedAt={activeShiftOpenedAt}
          closedReport={closedTodayReport}
          lastShiftReport={lastShiftReportToday}
          menuItems={menuItems}
          shiftStartingCash={shiftStartingCash}
          liveCashLog={liveCashLog}
          cashDataLoaded={cashDataLoaded}
          onPrintDayReport={() =>
            printDailyReport(displayedReports, historyDateLabel)
          }
        />
      ) : analyticsView === "history" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap" as const,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setHistoryDayKey((k) => shiftDayKey(k, -1))}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  color: T.cream,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ‹
              </button>
              <p
                style={{
                  fontFamily: "'Cinzel',serif",
                  color: T.cream,
                  fontSize: 13,
                  fontWeight: 700,
                  minWidth: 200,
                  textAlign: "center" as const,
                }}
              >
                {historyDateLabel}
              </p>
              <button
                onClick={() =>
                  !isViewingToday && setHistoryDayKey((k) => shiftDayKey(k, 1))
                }
                disabled={isViewingToday}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  color: isViewingToday ? T.faint : T.cream,
                  padding: "4px 10px",
                  cursor: isViewingToday ? "default" : "pointer",
                  fontSize: 13,
                  opacity: isViewingToday ? 0.4 : 1,
                }}
              >
                ›
              </button>
              {!isViewingToday && (
                <button
                  onClick={() => setHistoryDayKey(todayCalKey)}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.gold,
                    fontSize: 11,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Today
                </button>
              )}
            </div>
            {displayedReports.length > 0 && (
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: T.muted }}>
                  {displayedReports.length} shift
                  {displayedReports.length === 1 ? "" : "s"}
                </span>
                <span style={{ fontSize: 11, color: T.muted }}>
                  Total <b style={{ color: T.gold }}>{fmt(dailyAggRevenue)}</b>
                </span>
                <span style={{ fontSize: 11, color: T.muted }}>
                  Orders <b style={{ color: T.cream }}>{dailyAggOrders}</b>
                </span>
                {dailyAggShorts < 0 && (
                  <span style={{ fontSize: 11, color: T.muted }}>
                    Short{" "}
                    <b style={{ color: T.red }}>
                      {fmt(Math.abs(dailyAggShorts))}
                    </b>
                  </span>
                )}
              </div>
            )}
          </div>
          {historyLoading ? (
            <p style={{ color: T.faint, fontSize: 12 }}>Loading…</p>
          ) : (displayedReports?.length ?? 0) === 0 ? (
            <p style={{ color: T.faint, fontSize: 12 }}>
              No shifts recorded for this day.
            </p>
          ) : (
            <>
              <p
                style={{
                  color: T.gold,
                  fontSize: 11,
                  letterSpacing: ".15em",
                  textTransform: "uppercase" as const,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                ──Shift Comparison
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 10,
                }}
              >
                {displayedReports.map((sr) => (
                  <div
                    key={sr._id}
                    onClick={() => setSelectedShift(sr)}
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 12,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      cursor: "pointer",
                      transition: "border-color .15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = T.borderH)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = T.border)
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontFamily: "'Cinzel',serif",
                            color: T.gold,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {sr.shiftLabel}
                        </p>
                        {sr.openedBy && (
                          <p
                            style={{
                              color: T.faint,
                              fontSize: 10,
                              marginTop: 2,
                            }}
                          >
                            by {sr.openedBy}
                          </p>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: T.muted,
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}
                        >
                          Closed
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            printShiftHandover(sr);
                          }}
                          title="Print shift handover report"
                          style={{
                            background: "rgba(212,168,67,0.08)",
                            border: `1px solid ${T.borderH}`,
                            borderRadius: 6,
                            color: T.gold,
                            padding: "3px 6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Printer size={11} />
                        </button>
                      </div>
                    </div>
                    <p
                      style={{
                        fontFamily: "'Cinzel',serif",
                        fontSize: 22,
                        fontWeight: 700,
                        color: T.cream,
                      }}
                    >
                      {fmt(sr.revenue)}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          Starting Cash (float)
                        </span>
                        <span
                          style={{
                            color: T.cream,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {fmt(sr.startingCash || 0)}
                        </span>
                      </div>
                      <div
                        style={{
                          background: "rgba(212,168,67,0.06)",
                          border: `1px solid ${T.border}`,
                          borderRadius: 6,
                          padding: "5px 8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 10 }}>
                          Drawer should have
                        </span>
                        <span
                          style={{
                            color: T.gold,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {fmt(
                            (sr.startingCash || 0) +
                              sr.cashRev +
                              (sr.paidInTotal || 0) -
                              (sr.paidOutTotal || 0),
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          Orders
                        </span>
                        <span
                          style={{
                            color: T.cream,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {sr.orderCount}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          Cash
                        </span>
                        <span
                          style={{
                            color: T.green,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {fmt(sr.cashRev)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          GCash
                        </span>
                        <span
                          style={{
                            color: T.gold,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {fmt(sr.gcashRev)}
                        </span>
                      </div>
                      {!!sr.paidInTotal && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ color: T.muted, fontSize: 11 }}>
                            Paid In
                          </span>
                          <span
                            style={{
                              color: T.green,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            +{fmt(sr.paidInTotal)}
                          </span>
                        </div>
                      )}
                      {!!sr.paidOutTotal && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ color: T.muted, fontSize: 11 }}>
                            Paid Out
                          </span>
                          <span
                            style={{
                              color: T.red,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            -{fmt(sr.paidOutTotal)}
                          </span>
                        </div>
                      )}
                      {!!sr.discountTotal && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ color: T.muted, fontSize: 11 }}>
                            Discounts Given
                          </span>
                          <span
                            style={{
                              color: T.red,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            -{fmt(sr.discountTotal)}
                          </span>
                        </div>
                      )}
                      {sr.cashDiff !== null && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            borderTop: `1px solid ${T.border}`,
                            paddingTop: 4,
                            marginTop: 2,
                          }}
                        >
                          <span style={{ color: T.muted, fontSize: 11 }}>
                            {sr.cashDiff === 0
                              ? "Balanced ✓"
                              : sr.cashDiff > 0
                                ? "Over"
                                : "Short"}
                          </span>
                          <span
                            style={{
                              color: sr.cashDiff === 0 ? T.green : T.red,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {fmt(Math.abs(sr.cashDiff))}
                          </span>
                        </div>
                      )}
                    </div>
                    <p style={{ color: T.faint, fontSize: 10 }}>
                      {sr.dayKey ??
                        new Date(sr.openedAt).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                      ·{" "}
                      {new Date(sr.openedAt).toLocaleTimeString("en-PH", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}{" "}
                      –{" "}
                      {new Date(sr.closedAt).toLocaleTimeString("en-PH", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                  </div>
                ))}
                {isViewingToday &&
                  (() => {
                    const windows: { start: number; end: number }[] =
                      displayedReports.map((sr) => ({
                        start: new Date(sr.openedAt).getTime(),
                        end: new Date(sr.closedAt).getTime(),
                      }));
                    if (activeShiftOpenedAt) {
                      windows.push({
                        start: new Date(activeShiftOpenedAt).getTime(),
                        end: Date.now(),
                      });
                    }
                    const untrackedOrders = orders.filter((o) => {
                      if (o.status !== "completed") return false;
                      const t = new Date(o.createdAt).getTime();
                      const dKey = new Intl.DateTimeFormat("en-CA", {
                        timeZone: "Asia/Manila",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(new Date(o.createdAt));
                      if (dKey !== todayCalKey) return false;
                      return !windows.some((w) => t >= w.start && t <= w.end);
                    });
                    const untrackedRev = untrackedOrders.reduce(
                      (s, o) => s + o.total,
                      0,
                    );
                    if (untrackedRev <= 0) return null;
                    return (
                      <div
                        style={{
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.3)",
                          borderRadius: 12,
                          padding: "14px 16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "'Cinzel',serif",
                              color: T.red,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            Untracked
                          </p>
                          <span
                            style={{
                              fontSize: 10,
                              color: T.red,
                              background: "rgba(239,68,68,0.1)",
                              border: "1px solid rgba(239,68,68,0.2)",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            No Shift
                          </span>
                        </div>
                        <p
                          style={{
                            fontFamily: "'Cinzel',serif",
                            fontSize: 22,
                            fontWeight: 700,
                            color: T.cream,
                          }}
                        >
                          {fmt(untrackedRev)}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ color: T.muted, fontSize: 11 }}>
                            Orders
                          </span>
                          <span
                            style={{
                              color: T.cream,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {untrackedOrders.length}
                          </span>
                        </div>
                        <p style={{ color: T.faint, fontSize: 10 }}>
                          Placed outside any tracked shift window
                        </p>
                      </div>
                    );
                  })()}
                {isViewingToday && activeShiftDate && (
                  <div
                    style={{
                      background: "rgba(34,197,94,0.06)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: 12,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "'Cinzel',serif",
                          color: T.green,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {currentShiftLabel}
                      </p>
                      <span
                        style={{
                          fontSize: 10,
                          color: T.green,
                          background: "rgba(34,197,94,0.1)",
                          border: "1px solid rgba(34,197,94,0.2)",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        Active
                      </span>
                    </div>
                    {(() => {
                      const liveOrders = orders.filter(
                        (o) =>
                          o.status === "completed" &&
                          activeShiftOpenedAt &&
                          new Date(o.createdAt) >=
                            new Date(activeShiftOpenedAt),
                      );
                      const liveRev = liveOrders.reduce(
                        (s, o) => s + o.total,
                        0,
                      );
                      return (
                        <>
                          <p
                            style={{
                              fontFamily: "'Cinzel',serif",
                              fontSize: 22,
                              fontWeight: 700,
                              color: T.green,
                            }}
                          >
                            {fmt(liveRev)}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ color: T.muted, fontSize: 11 }}>
                                Starting Cash (float)
                              </span>
                              <span
                                style={{
                                  color: T.cream,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {fmt(shiftStartingCash || 0)}
                              </span>
                            </div>
                            <div
                              style={{
                                background: "rgba(212,168,67,0.06)",
                                border: `1px solid ${T.border}`,
                                borderRadius: 6,
                                padding: "5px 8px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ color: T.muted, fontSize: 10 }}>
                                Drawer should have
                              </span>
                              <span
                                style={{
                                  color: T.gold,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {fmt(
                                  (shiftStartingCash || 0) +
                                    liveOrders.reduce((s, o) => {
                                      if (o.paymentMethod === "cash")
                                        return s + o.total;
                                      if (o.paymentMethod === "split")
                                        return s + (o.cashAmount ?? 0);
                                      return s;
                                    }, 0) +
                                    liveCashLog.paidInTotal -
                                    liveCashLog.paidOutTotal,
                                )}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ color: T.muted, fontSize: 11 }}>
                                Orders
                              </span>
                              <span
                                style={{
                                  color: T.cream,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {liveOrders.length}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ color: T.muted, fontSize: 11 }}>
                                Cash
                              </span>
                              <span
                                style={{
                                  color: T.green,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {fmt(
                                  liveOrders.reduce((s, o) => {
                                    if (o.paymentMethod === "cash")
                                      return s + o.total;
                                    if (o.paymentMethod === "split")
                                      return s + (o.cashAmount ?? 0);
                                    return s;
                                  }, 0),
                                )}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ color: T.muted, fontSize: 11 }}>
                                GCash
                              </span>
                              <span
                                style={{
                                  color: T.gold,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {fmt(
                                  liveOrders.reduce((s, o) => {
                                    if (o.paymentMethod === "gcash")
                                      return s + o.total;
                                    if (o.paymentMethod === "split")
                                      return s + (o.gcashAmount ?? 0);
                                    return s;
                                  }, 0),
                                )}
                              </span>
                            </div>
                            {liveCashLog.paidInTotal > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <span style={{ color: T.muted, fontSize: 11 }}>
                                  Paid In
                                </span>
                                <span
                                  style={{
                                    color: T.green,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  +{fmt(liveCashLog.paidInTotal)}
                                </span>
                              </div>
                            )}
                            {liveCashLog.paidOutTotal > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <span style={{ color: T.muted, fontSize: 11 }}>
                                  Paid Out
                                </span>
                                <span
                                  style={{
                                    color: T.red,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  -{fmt(liveCashLog.paidOutTotal)}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <TodayReport
                orders={orders}
                activeShiftDate={activeShiftDate}
                activeShiftOpenedAt={activeShiftOpenedAt}
                closedReport={closedTodayReport}
                lastShiftReport={lastShiftReportToday}
                menuItems={menuItems}
                shiftStartingCash={shiftStartingCash}
                liveCashLog={liveCashLog}
                cashDataLoaded={cashDataLoaded}
                onPrintDayReport={() =>
                  printDailyReport(displayedReports, historyDateLabel)
                }
              />
            </>
          )}
          {daysOperated === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: T.faint,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
              }}
            >
              <BarChart3
                size={36}
                style={{ margin: "0 auto 12px", opacity: 0.3 }}
              />
              <p style={{ fontSize: 14 }}>
                No history yet — open the store, take orders, close the day
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? "140px" : "170px"},1fr))`,
                  gap: 12,
                }}
              >
                {[
                  {
                    label: "Total Revenue",
                    value: fmt(allTimeRevenue),
                    icon: <DollarSign size={20} />,
                    color: T.gold,
                  },
                  {
                    label: "Orders Completed",
                    value: String(allTimeCompleted),
                    icon: <Package size={20} />,
                    color: T.green,
                  },
                  {
                    label: "Days Operated",
                    value: String(daysOperated),
                    icon: <Clock size={20} />,
                    color: T.blue,
                  },
                  {
                    label: "Avg Daily Revenue",
                    value: fmt(avgDailyRevenue),
                    icon: <BarChart3 size={20} />,
                    color: T.purple,
                  },
                ].map((s) => (
                  <StatCard
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    icon={s.icon}
                    accent={s.color}
                  />
                ))}
              </div>
              <SalesCalendar orders={orders} dailyReports={dailyReports} />
            </>
          )}
        </div>
      ) : null}

      {selectedShift &&
        (() => {
          const start = new Date(selectedShift.openedAt).getTime();
          const end = new Date(selectedShift.closedAt).getTime();
          const shiftOrders = orders
            .filter((o) => {
              const t = new Date(o.createdAt).getTime();
              return t >= start && t <= end && o.status !== "pending";
            })
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
          return (
            <div
              onClick={() => setSelectedShift(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "rgba(0,0,0,0.75)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#0f1a0f",
                  border: `1px solid ${T.borderH}`,
                  borderRadius: 18,
                  padding: "24px",
                  width: "100%",
                  maxWidth: 560,
                  maxHeight: "85vh",
                  overflowY: "auto",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: "'Cinzel',serif",
                        color: T.gold,
                        fontSize: 16,
                        fontWeight: 700,
                      }}
                    >
                      {selectedShift.shiftLabel}
                      {selectedShift.openedBy
                        ? ` · ${selectedShift.openedBy}`
                        : ""}
                    </p>
                    <p style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                      {new Date(selectedShift.openedAt).toLocaleTimeString(
                        "en-PH",
                        { hour: "numeric", minute: "2-digit", hour12: true },
                      )}{" "}
                      –{" "}
                      {new Date(selectedShift.closedAt).toLocaleTimeString(
                        "en-PH",
                        { hour: "numeric", minute: "2-digit", hour12: true },
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedShift(null)}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${T.border}`,
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      color: T.muted,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
                    gap: 8,
                  }}
                >
                  {[
                    {
                      label: "Revenue",
                      val: fmt(selectedShift.revenue),
                      color: T.gold,
                    },
                    {
                      label: "Orders",
                      val: String(selectedShift.orderCount),
                      color: T.cream,
                    },
                    {
                      label: "Cash",
                      val: fmt(selectedShift.cashRev),
                      color: T.green,
                    },
                    {
                      label: "GCash",
                      val: fmt(selectedShift.gcashRev),
                      color: T.gold,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                      }}
                    >
                      <p
                        style={{
                          color: T.muted,
                          fontSize: 9,
                          letterSpacing: ".08em",
                          marginBottom: 3,
                        }}
                      >
                        {s.label.toUpperCase()}
                      </p>
                      <p
                        style={{
                          color: s.color,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {s.val}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedShift.cashDiff !== null && (
                  <div
                    style={{
                      background:
                        selectedShift.cashDiff === 0
                          ? "rgba(34,197,94,0.06)"
                          : "rgba(239,68,68,0.06)",
                      border: `1px solid ${selectedShift.cashDiff === 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: T.muted, fontSize: 11 }}>
                      Starting {fmt(selectedShift.startingCash || 0)} · Expected{" "}
                      {fmt(
                        (selectedShift.startingCash || 0) +
                          selectedShift.cashRev +
                          (selectedShift.paidInTotal || 0) -
                          (selectedShift.paidOutTotal || 0),
                      )}{" "}
                      · Counted{" "}
                      {selectedShift.countedCash != null
                        ? fmt(selectedShift.countedCash)
                        : "—"}
                    </span>
                    <span
                      style={{
                        color: selectedShift.cashDiff === 0 ? T.green : T.red,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {selectedShift.cashDiff === 0
                        ? "Balanced ✓"
                        : `${selectedShift.cashDiff > 0 ? "Over" : "Short"} ${fmt(Math.abs(selectedShift.cashDiff))}`}
                    </span>
                  </div>
                )}

                <p
                  style={{
                    color: T.gold,
                    fontSize: 11,
                    letterSpacing: ".12em",
                    fontFamily: "'Cinzel',serif",
                    marginTop: 4,
                  }}
                >
                  ──Orders ({shiftOrders.length})
                </p>

                {shiftOrders.length === 0 ? (
                  <p
                    style={{
                      color: T.faint,
                      fontSize: 13,
                      textAlign: "center",
                      padding: "16px 0",
                    }}
                  >
                    No orders found in this shift's time window.
                  </p>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {shiftOrders.map((o) => (
                      <div
                        key={o._id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${T.border}`,
                          borderRadius: 10,
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Cinzel',serif",
                              fontSize: 12,
                              color: T.cream,
                              fontWeight: 700,
                            }}
                          >
                            #{o.orderNumber}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: o.status === "cancelled" ? T.red : T.green,
                              background:
                                o.status === "cancelled"
                                  ? "rgba(239,68,68,0.1)"
                                  : "rgba(34,197,94,0.1)",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {o.status}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color:
                                o.paymentMethod === "cash" ? T.green : T.gold,
                            }}
                          >
                            {o.paymentMethod || "—"}
                          </span>
                          {o.items?.length > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                color: T.faint,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: 180,
                              }}
                            >
                              ·{" "}
                              {o.items
                                .map((it) => `${it.quantity}× ${it.name}`)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 11, color: T.faint }}>
                            {new Date(o.createdAt).toLocaleTimeString("en-PH", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                          <span
                            style={{
                              fontFamily: "'Cinzel',serif",
                              fontSize: 13,
                              color: T.gold,
                              fontWeight: 700,
                            }}
                          >
                            {fmt(o.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ── GCASH PAYMENT SCREEN ─────────────────────────────────────────────────────
function GCashPaymentScreen({
  total,
  orderNumber,
  onDone,
}: {
  total: number;
  orderNumber: string;
  onDone: () => void;
}) {
  const GCASH_NUMBER = "09XX XXX XXXX";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background:
          "radial-gradient(ellipse at 50% 30%,rgba(212,168,67,0.12) 0%,transparent 60%), #0a0f0a",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          onClick={onDone}
          style={{
            position: "absolute",
            top: -10,
            right: 0,
            background: "rgba(255,255,255,0.08)",
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            width: 36,
            height: 36,
            color: T.muted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={16} />
        </button>
        <p
          style={{
            color: T.muted,
            fontSize: 11,
            letterSpacing: ".2em",
            fontFamily: "'Cinzel',serif",
            marginBottom: 8,
          }}
        >
          GCASH PAYMENT
        </p>
        <p
          style={{
            fontFamily: "'Cinzel',serif",
            fontSize: 13,
            color: T.cream,
            marginBottom: 24,
            letterSpacing: ".06em",
          }}
        >
          Order #{orderNumber}
        </p>
        <div
          style={{
            background: T.goldDim,
            border: `2px solid ${T.gold}`,
            borderRadius: 20,
            padding: "20px 32px",
            marginBottom: 28,
            display: "inline-block",
          }}
        >
          <p
            style={{
              color: T.muted,
              fontSize: 11,
              letterSpacing: ".15em",
              marginBottom: 4,
            }}
          >
            AMOUNT DUE
          </p>
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              fontSize: "clamp(2rem,8vw,3.5rem)",
              fontWeight: 700,
              color: T.gold,
            }}
          >
            {fmt(total)}
          </p>
        </div>
        <div
          style={{
            background: "white",
            borderRadius: 20,
            padding: 16,
            width: 200,
            height: 200,
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 40px rgba(212,168,67,0.2)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <QrCode size={100} color="#1a73e8" />
            <p
              style={{
                fontSize: 10,
                color: "#333",
                marginTop: 6,
                fontWeight: 600,
              }}
            >
              PLACE YOUR GCASH QR
            </p>
            <p style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
              Replace with /gcash-qr.png
            </p>
          </div>
        </div>
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: "14px 20px",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              marginBottom: 4,
            }}
          >
            SEND TO
          </p>
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              fontSize: 22,
              fontWeight: 700,
              color: T.cream,
              letterSpacing: ".04em",
            }}
          >
            {GCASH_NUMBER}
          </p>
          <p style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
            3rd Space Coffee
          </p>
        </div>
        <button
          onClick={onDone}
          style={{
            width: "100%",
            padding: "15px",
            background: T.green,
            border: "none",
            borderRadius: 14,
            color: "#0a0f0a",
            fontFamily: "'Cinzel',serif",
            fontSize: 13,
            letterSpacing: ".12em",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ✓ PAYMENT RECEIVED — CONFIRM ORDER
        </button>
      </div>
    </div>
  );
}

// ── CASH ORDER PLACED SCREEN ─────────────────────────────────────────────────
function CashOrderPlacedScreen({
  total,
  orderNumber,
  onDone,
}: {
  total: number;
  orderNumber: string;
  onDone: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background:
          "radial-gradient(ellipse at 50% 30%,rgba(34,197,94,0.1) 0%,transparent 60%), #0a0f0a",
      }}
    >
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <Banknote size={48} color={T.green} style={{ margin: "0 auto 16px" }} />
        <p
          style={{
            color: T.muted,
            fontSize: 11,
            letterSpacing: ".2em",
            fontFamily: "'Cinzel',serif",
            marginBottom: 8,
          }}
        >
          ORDER PLACED
        </p>
        <p
          style={{
            fontFamily: "'Cinzel',serif",
            fontSize: 13,
            color: T.cream,
            marginBottom: 24,
            letterSpacing: ".06em",
          }}
        >
          Order #{orderNumber}
        </p>
        <div
          style={{
            background: "rgba(34,197,94,0.08)",
            border: `2px solid ${T.green}`,
            borderRadius: 20,
            padding: "20px 32px",
            marginBottom: 28,
          }}
        >
          <p
            style={{
              color: T.muted,
              fontSize: 11,
              letterSpacing: ".15em",
              marginBottom: 4,
            }}
          >
            AMOUNT DUE — CASH
          </p>
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              fontSize: "clamp(2rem,8vw,3.5rem)",
              fontWeight: 700,
              color: T.green,
            }}
          >
            {fmt(total)}
          </p>
        </div>
        <p
          style={{
            color: T.cream,
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 28,
          }}
        >
          Please proceed to the counter to pay.
        </p>
        <button
          onClick={onDone}
          style={{
            width: "100%",
            padding: "15px",
            background: T.green,
            border: "none",
            borderRadius: 14,
            color: "#0a0f0a",
            fontFamily: "'Cinzel',serif",
            fontSize: 13,
            letterSpacing: ".12em",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ✓ DONE
        </button>
      </div>
    </div>
  );
}

// ── ACCOUNTS TAB ─────────────────────────────────────────────────────────────
function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "staff" as "admin" | "staff",
  });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const w = useWindowWidth();
  const isMobile = w < 600;

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) setAccounts(await res.json());
    } catch {}
    setLoading(false);
  }

  async function createAccount() {
    if (
      !form.username.trim() ||
      !form.displayName.trim() ||
      !form.password.trim()
    ) {
      setErr("All fields required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setErr(data.error || "Failed to create account.");
      } else {
        setForm({ username: "", displayName: "", password: "", role: "staff" });
        setShowForm(false);
        fetchAccounts();
      }
    } catch {
      setErr("Network error.");
    }
    setSaving(false);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/accounts/${confirmDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok)
        setAccounts((p) => p.filter((a) => a._id !== confirmDelete.id));
    } catch {}
    setConfirmDelete(null);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: T.cream,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    color: T.muted,
    fontSize: 10,
    letterSpacing: ".1em",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {confirmDelete && (
        <ConfirmModal
          message={`Delete account "${confirmDelete.name}"?\nThis cannot be undone.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <p style={{ color: T.muted, fontSize: 12 }}>
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={fetchAccounts}
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "8px 16px",
              background: T.gold,
              border: "none",
              borderRadius: 8,
              color: "#0a0f0a",
              fontFamily: "'Cinzel',serif",
              fontSize: 11,
              letterSpacing: ".1em",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <UserPlus size={13} /> NEW ACCOUNT
          </button>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${T.borderH}`,
            borderRadius: 16,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                fontFamily: "'Cinzel',serif",
                color: T.cream,
                fontSize: 14,
                letterSpacing: ".1em",
              }}
            >
              CREATE ACCOUNT
            </h3>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: "none",
                border: "none",
                color: T.muted,
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <label style={labelStyle}>USERNAME</label>
              <input
                value={form.username}
                onChange={(e) =>
                  setForm((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="e.g. maria"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>DISPLAY NAME</label>
              <input
                value={form.displayName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, displayName: e.target.value }))
                }
                placeholder="e.g. Maria Santos"
                style={inputStyle}
              />
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            <div style={{ position: "relative" }}>
              <label style={labelStyle}>PASSWORD</label>
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="Set password"
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  bottom: 10,
                  background: "none",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                {showPw ? "HIDE" : "SHOW"}
              </button>
            </div>
            <div>
              <label style={labelStyle}>ROLE</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["staff", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm((p) => ({ ...p, role: r }))}
                    style={{
                      flex: 1,
                      padding: "9px 8px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background:
                        form.role === r
                          ? r === "admin"
                            ? T.goldDim
                            : "rgba(91,155,213,0.15)"
                          : "rgba(255,255,255,0.03)",
                      border: `1px solid ${form.role === r ? (r === "admin" ? T.gold : T.blue) : T.border}`,
                      color:
                        form.role === r
                          ? r === "admin"
                            ? T.gold
                            : T.blue
                          : T.muted,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'Cinzel',serif",
                      letterSpacing: ".06em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    {r === "admin" ? <Shield size={12} /> : <Users size={12} />}
                    {r === "admin" ? "ADMIN" : "CREW"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {err && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "rgba(239,68,68,0.8)",
                fontSize: 12,
              }}
            >
              <AlertCircle size={13} /> {err}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={createAccount}
              disabled={saving}
              style={{
                flex: 1,
                padding: "11px",
                background: T.gold,
                color: "#0a0f0a",
                border: "none",
                borderRadius: 10,
                fontFamily: "'Cinzel',serif",
                fontSize: 12,
                letterSpacing: ".1em",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {saving ? "CREATING…" : "CREATE ACCOUNT"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: "11px 18px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                color: T.muted,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: T.muted,
            fontSize: 12,
          }}
        >
          Loading…
        </div>
      ) : accounts.length === 0 ? (
        <div
          style={{ textAlign: "center", padding: "60px 20px", color: T.faint }}
        >
          <Users size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>
            No accounts yet — create your first one above
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {accounts.map((acc) => (
            <div
              key={acc._id}
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                transition: "border-color .2s",
                flexWrap: "wrap",
              }}
              className="account-row"
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background:
                    acc.role === "admin" ? T.goldDim : "rgba(91,155,213,0.15)",
                  border: `1px solid ${acc.role === "admin" ? T.gold : T.blue}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {acc.role === "admin" ? (
                  <Shield size={16} color={T.gold} />
                ) : (
                  <Users size={16} color={T.blue} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: T.cream, fontSize: 14, fontWeight: 600 }}>
                  {acc.displayName}
                </p>
                <p style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                  @{acc.username}
                  <span
                    style={{
                      marginLeft: 8,
                      background:
                        acc.role === "admin"
                          ? T.goldDim
                          : "rgba(91,155,213,0.12)",
                      color: acc.role === "admin" ? T.gold : T.blue,
                      border: `1px solid ${acc.role === "admin" ? "rgba(212,168,67,0.3)" : "rgba(91,155,213,0.25)"}`,
                      padding: "1px 8px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                    }}
                  >
                    {acc.role.toUpperCase()}
                  </span>
                  {acc.createdAt && (
                    <span
                      style={{ marginLeft: 8, color: T.faint, fontSize: 11 }}
                    >
                      · {ago(acc.createdAt)}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() =>
                  setConfirmDelete({ id: acc._id, name: acc.displayName })
                }
                style={{
                  padding: "7px 10px",
                  background: "rgba(239,68,68,0.07)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  color: T.red,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GenericOptionsSheet({
  item,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  onAdd: (
    extraPrice: number,
    customizations: { type: string; label: string; price: number }[],
  ) => void;
  onClose: () => void;
}) {
  const groups = item.options || [];
  const [selections, setSelections] = useState<Record<string, Set<string>>>(
    () => {
      const init: Record<string, Set<string>> = {};
      groups.forEach((g) => {
        init[g.name] =
          g.type === "single" && g.required && g.choices[0]
            ? new Set([g.choices[0].label])
            : new Set();
      });
      return init;
    },
  );

  const extraTotal = groups.reduce((sum, g) => {
    const sel = selections[g.name] || new Set();
    return (
      sum +
      g.choices.filter((c) => sel.has(c.label)).reduce((s, c) => s + c.price, 0)
    );
  }, 0);

  const toggle = (group: OptionGroup, label: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (group.type === "single") {
        next[group.name] = new Set([label]);
        return next;
      }
      const cur = new Set(prev[group.name] || []);
      if (cur.has(label)) cur.delete(label);
      else if (!group.max || cur.size < group.max) cur.add(label);
      next[group.name] = cur;
      return next;
    });
  };

  const canAdd = groups
    .filter((g) => g.required)
    .every((g) => (selections[g.name]?.size || 0) > 0);

  const handleAdd = () => {
    const customizations: { type: string; label: string; price: number }[] = [];
    groups.forEach((g) => {
      const sel = selections[g.name] || new Set();
      g.choices.forEach((c) => {
        if (sel.has(c.label))
          customizations.push({ type: g.name, label: c.label, price: c.price });
      });
    });
    onAdd(extraTotal, customizations);
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 16,
                fontWeight: 700,
                color: T.cream,
                letterSpacing: ".02em",
                lineHeight: 1.3,
              }}
            >
              {item.name}
            </p>
            <p style={{ color: T.gold, fontSize: 13, marginTop: 4 }}>
              ₱{item.price}
              {extraTotal > 0 && (
                <span style={{ color: T.muted, fontSize: 12 }}>
                  {" "}
                  + ₱{extraTotal}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${T.border}`,
              borderRadius: 999,
              width: 30,
              height: 30,
              minWidth: 30,
              color: T.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.name}>
            <p
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".14em",
                fontFamily: "'Cinzel',serif",
                marginBottom: 8,
              }}
            >
              {g.name.toUpperCase()}
              {g.required ? " · REQUIRED" : ""}
              {g.type === "multi" && g.max ? ` · MAX ${g.max}` : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {g.choices.map((c) => {
                const sel = (selections[g.name] || new Set()).has(c.label);
                return (
                  <button
                    key={c.label}
                    onClick={() => toggle(g, c.label)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 14px",
                      borderRadius: 10,
                      border: `1.5px solid ${sel ? T.gold : T.border}`,
                      background: sel ? T.goldDim : "rgba(255,255,255,0.02)",
                      color: sel ? T.cream : T.muted,
                      cursor: "pointer",
                      fontSize: 13,
                      textAlign: "left",
                      transition: "all .15s",
                    }}
                  >
                    <span>{c.label}</span>
                    <span
                      style={{
                        color: c.price > 0 ? T.gold : T.faint,
                        fontFamily: "'Cinzel',serif",
                        fontSize: 12,
                      }}
                    >
                      {c.price > 0 ? `+₱${c.price}` : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button
          onClick={handleAdd}
          disabled={!canAdd}
          style={{
            width: "100%",
            background: canAdd ? T.gold : "rgba(212,168,67,0.25)",
            color: canAdd ? "#0a0f0a" : T.muted,
            border: "none",
            borderRadius: 10,
            fontFamily: "'Cinzel',serif",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: ".1em",
            cursor: canAdd ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 18px",
          }}
        >
          <span>ADD TO ORDER</span>
          <span>₱{item.price + extraTotal}</span>
        </button>
      </div>
    </div>
  );
}

function CrewCustomizationSheet({
  item,
  config,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  config: CrewCustomizationConfig;
  onAdd: (
    extraPrice: number,
    customizations: { type: string; label: string; price: number }[],
  ) => void;
  onClose: () => void;
}) {
  const [selectedSub, setSelectedSub] = useState(
    config.substitutions?.[0]?.label || "",
  );
  const [selectedBase, setSelectedBase] = useState(
    config.baseSubs?.[0]?.label || "",
  );
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [selectedSauces, setSelectedSauces] = useState<Set<string>>(new Set());
  const [selectedEggStyle, setSelectedEggStyle] = useState<string>(
    config.eggStyles?.[0]?.name || "",
  );

  const subPrice =
    config.substitutions?.find((s) => s.label === selectedSub)?.price || 0;
  const basePrice =
    config.baseSubs?.find((s) => s.label === selectedBase)?.price || 0;
  const addonsPrice = Array.from(selectedAddons).reduce(
    (sum, lbl) =>
      sum + (config.addons?.find((a) => a.label === lbl)?.price || 0),
    0,
  );
  const extraTotal = subPrice + basePrice + addonsPrice;

  const toggleAddon = (lbl: string) =>
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      next.has(lbl) ? next.delete(lbl) : next.add(lbl);
      return next;
    });

  const handleAdd = () => {
    const customizations: { type: string; label: string; price: number }[] = [];
    if (config.substitutions && selectedSub) {
      customizations.push({
        type: "Milk",
        label: selectedSub,
        price: subPrice,
      });
    }
    if (config.baseSubs && selectedBase) {
      customizations.push({
        type: "Base",
        label: selectedBase,
        price: basePrice,
      });
    }
    if (config.eggStyles && selectedEggStyle) {
      customizations.push({
        type: "Egg Style",
        label: selectedEggStyle,
        price: 0,
      });
    }
    Array.from(selectedSauces).forEach((lbl) => {
      customizations.push({ type: "Sauce", label: lbl, price: 0 });
    });
    Array.from(selectedAddons).forEach((lbl) => {
      const p = config.addons?.find((a) => a.label === lbl)?.price || 0;
      customizations.push({ type: "Add-On", label: lbl, price: p });
    });
    onAdd(extraTotal, customizations);
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const OptionRow = ({
    label,
    price,
    sel,
    onClick,
  }: {
    label: string;
    price: number;
    sel: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "11px 14px",
        borderRadius: 10,
        border: `1.5px solid ${sel ? T.gold : T.border}`,
        background: sel ? T.goldDim : "rgba(255,255,255,0.02)",
        color: sel ? T.cream : T.muted,
        cursor: "pointer",
        fontSize: 13,
        textAlign: "left",
        transition: "all .15s",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          color: price > 0 ? T.gold : T.faint,
          fontFamily: "'Cinzel',serif",
          fontSize: 12,
        }}
      >
        {price > 0 ? `+₱${price}` : "Free"}
      </span>
    </button>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 16,
                fontWeight: 700,
                color: T.cream,
                letterSpacing: ".02em",
                lineHeight: 1.3,
              }}
            >
              {item.name}
            </p>
            <p style={{ color: T.gold, fontSize: 13, marginTop: 4 }}>
              ₱{item.price}
              {extraTotal > 0 && (
                <span style={{ color: T.muted, fontSize: 12 }}>
                  {" "}
                  + ₱{extraTotal}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${T.border}`,
              borderRadius: 999,
              width: 30,
              height: 30,
              minWidth: 30,
              color: T.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {config.substitutions && (
          <div>
            <p
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".14em",
                fontFamily: "'Cinzel',serif",
                marginBottom: 8,
              }}
            >
              MILK
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {config.substitutions.map((s) => (
                <OptionRow
                  key={s.label}
                  label={s.label}
                  price={s.price}
                  sel={selectedSub === s.label}
                  onClick={() => setSelectedSub(s.label)}
                />
              ))}
            </div>
          </div>
        )}

        {config.baseSubs && (
          <div>
            <p
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".14em",
                fontFamily: "'Cinzel',serif",
                marginBottom: 8,
              }}
            >
              BASE
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {config.baseSubs.map((s) => (
                <OptionRow
                  key={s.label}
                  label={s.label}
                  price={s.price}
                  sel={selectedBase === s.label}
                  onClick={() => setSelectedBase(s.label)}
                />
              ))}
            </div>
          </div>
        )}

        {config.eggStyles && (
          <div>
            <p
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".14em",
                fontFamily: "'Cinzel',serif",
                marginBottom: 8,
              }}
            >
              EGG STYLE
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {config.eggStyles.map((style) => (
                <OptionRow
                  key={style.name}
                  label={style.name}
                  price={0}
                  sel={selectedEggStyle === style.name}
                  onClick={() => setSelectedEggStyle(style.name)}
                />
              ))}
            </div>
          </div>
        )}

        {config.sauces && (
          <div>
            <p
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".14em",
                fontFamily: "'Cinzel',serif",
                marginBottom: 8,
              }}
            >
              SAUCE — MAX 2 (FREE)
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                gap: 8,
              }}
            >
              {config.sauces.map((sauce) => {
                const sel = selectedSauces.has(sauce.name);
                return (
                  <button
                    key={sauce.name}
                    onClick={() =>
                      setSelectedSauces((prev) => {
                        const n = new Set(prev);
                        if (n.has(sauce.name)) {
                          n.delete(sauce.name);
                        } else if (n.size < 2) {
                          n.add(sauce.name);
                        }
                        return n;
                      })
                    }
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 5,
                      padding: "9px 6px",
                      borderRadius: 10,
                      border: `1.5px solid ${sel ? T.gold : T.border}`,
                      background: sel ? T.goldDim : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {sauce.image && (
                      <img
                        src={sauce.image}
                        alt={sauce.name}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 6,
                          objectFit: "cover",
                          border: `1px solid ${sel ? T.gold : T.border}`,
                        }}
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    )}
                    <span
                      style={{
                        color: sel ? T.cream : T.muted,
                        fontSize: 10,
                        textAlign: "center",
                        lineHeight: 1.3,
                      }}
                    >
                      {sauce.name}
                    </span>
                    {sel && <Check size={10} color={T.gold} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {config.addons && (
          <div>
            <p
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".14em",
                fontFamily: "'Cinzel',serif",
                marginBottom: 8,
              }}
            >
              ADD-ONS
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {config.addons.map((a) => (
                <OptionRow
                  key={a.label}
                  label={a.label}
                  price={a.price}
                  sel={selectedAddons.has(a.label)}
                  onClick={() => toggleAddon(a.label)}
                />
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleAdd}
          style={{
            width: "100%",
            background: T.gold,
            color: "#0a0f0a",
            border: "none",
            borderRadius: 10,
            fontFamily: "'Cinzel',serif",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: ".1em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 18px",
          }}
        >
          <span>ADD TO ORDER</span>
          <span>₱{item.price + extraTotal}</span>
        </button>
      </div>
    </div>
  );
}

// ── CREW TAB ─────────────────────────────────────────────────────────────────
function CrewTab({
  menuItems,
  onOrderPlaced,
  staffName,
  discounts,
}: {
  menuItems: MenuItem[];
  onOrderPlaced: () => void;
  staffName: string;
  discounts: DiscountPreset[];
}) {
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const w = useWindowWidth();
  const isMobile = w < 768;

  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<
    {
      item: MenuItem;
      qty: number;
      extraPrice: number;
      customizations: { type: string; label: string; price: number }[];
      cartKey: string;
    }[]
  >([]);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customizingConfig, setCustomizingConfig] =
    useState<CrewCustomizationConfig | null>(null);
  const [variantItem, setVariantItem] = useState<MenuItem | null>(null);
  const [genericOptionsItem, setGenericOptionsItem] = useState<MenuItem | null>(
    null,
  );

  const liveSauces = menuItems
    .filter((i) => i.category.toLowerCase().includes("sauce") && i.available)
    .map((i) => ({ name: i.name, image: i.image }));

  const liveEggStyles = menuItems
    .filter(
      (i) => i.category.toLowerCase().includes("egg style") && i.available,
    )
    .map((i) => ({ name: i.name, image: i.image }));

  // "Substitutions" menu items (e.g. "Oatmilk Substitution", "Matcha
  // Substitution") drive the Milk/Base option pickers. Hiding one of these
  // items (✗ Hidden in Menu tab) removes it from every drink that offers
  // it — same live-sync pattern as sauces/egg styles above.
  const milkSubItemsExist = menuItems.some(
    (i) =>
      i.category.toLowerCase().includes("substitution") && /milk/i.test(i.name),
  );
  const baseSubItemsExist = menuItems.some(
    (i) =>
      i.category.toLowerCase().includes("substitution") &&
      /matcha|base/i.test(i.name),
  );
  const liveMilkSubs = menuItems
    .filter(
      (i) =>
        i.category.toLowerCase().includes("substitution") &&
        i.available &&
        /milk/i.test(i.name),
    )
    .map((i) => ({
      label: i.name.replace(/substitution/i, "").trim(),
      price: i.price,
    }));
  const liveBaseSubs = menuItems
    .filter(
      (i) =>
        i.category.toLowerCase().includes("substitution") &&
        i.available &&
        /matcha|base/i.test(i.name),
    )
    .map((i) => ({
      label: i.name.replace(/substitution/i, "").trim(),
      price: i.price,
    }));
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "gcash" | "cash" | "later"
  >("gcash");
  const [showQR, setShowQR] = useState<{
    total: number;
    orderNumber: string;
    orderId: string;
  } | null>(null);
  const [showCashNote, setShowCashNote] = useState<{
    total: number;
    orderNumber: string;
  } | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [receiptSrc, setReceiptSrc] = useState<string | null>(null);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [selectedDiscount, setSelectedDiscount] =
    useState<DiscountPreset | null>(null);
  const [orderType, setOrderType] = useState<"dine-in" | "delivery">("dine-in");
  const [customerContact, setCustomerContact] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");

  useEffect(() => {
    fetchMyOrders();
    const id = setInterval(fetchMyOrders, 45000);
    return () => clearInterval(id);
  }, [staffName]);

  async function fetchMyOrders() {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const all: Order[] = await res.json();
        setMyOrders(
          all.filter(
            (o) =>
              o.waiterName?.trim().toLowerCase() ===
              staffName.trim().toLowerCase(),
          ),
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function crewUpdateStatus(id: string, status: OrderStatus) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok)
      setMyOrders((p) => p.map((o) => (o._id === id ? { ...o, status } : o)));
  }

  async function crewConfirmPayment(id: string) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "confirmed" }),
    });
    if (res.ok)
      setMyOrders((p) =>
        p.map((o) => (o._id === id ? { ...o, paymentStatus: "confirmed" } : o)),
      );
  }

  const availItems = menuItems.filter((i) => i.available);
  const categories = Array.from(new Set(availItems.map((i) => i.category)));
  const activeCat = activeCategory || categories[0] || "";
  const filtered = availItems.filter((i) => i.category === activeCat);
  const cartSubtotal = cart.reduce(
    (s, c) => s + (c.item.price + c.extraPrice) * c.qty,
    0,
  );
  const discountAmount = selectedDiscount
    ? Math.round(cartSubtotal * selectedDiscount.percentage) / 100
    : 0;
  const cartTotal = cartSubtotal - discountAmount;
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  function addItem(item: MenuItem) {
    const hasAdminVariant = item.options?.some(
      (g) => g.name.toLowerCase() === "variant",
    );
    if (!hasAdminVariant) {
      const nameKey = item.name.toLowerCase();
      const nameVariants = Object.entries(ITEM_VARIANTS).find(([k]) =>
        nameKey.includes(k),
      )?.[1];
      const effectiveVariants =
        item.variants && item.variants.length > 0
          ? item.variants.map((v) => ({ label: v }))
          : nameVariants;
      if (effectiveVariants && effectiveVariants.length > 0) {
        setVariantItem({ ...item, variants: effectiveVariants as any });
        return;
      }
    }
    if (item.options && item.options.length > 0) {
      setGenericOptionsItem(item);
      return;
    }
    const config = getCrewCustomizations(
      item.category,
      item.name,
      liveSauces,
      liveEggStyles,
      milkSubItemsExist ? liveMilkSubs : undefined,
      baseSubItemsExist ? liveBaseSubs : undefined,
    );
    if (config) {
      setCustomizingItem(item);
      setCustomizingConfig(config);
    } else {
      addToCartFinal(item, 0, []);
    }
  }

  function addToCartFinal(
    item: MenuItem,
    extraPrice: number,
    customizations: { type: string; label: string; price: number }[],
  ) {
    const cartKey = item._id + JSON.stringify(customizations);
    setCart((p) => {
      const ex = p.find((c) => c.cartKey === cartKey);
      if (ex)
        return p.map((c) =>
          c.cartKey === cartKey ? { ...c, qty: c.qty + 1 } : c,
        );
      return [...p, { item, qty: 1, extraPrice, customizations, cartKey }];
    });
    setCustomizingItem(null);
    setCustomizingConfig(null);
  }

  function updateQty(cartKey: string, qty: number) {
    if (qty <= 0) setCart((p) => p.filter((c) => c.cartKey !== cartKey));
    else
      setCart((p) => p.map((c) => (c.cartKey === cartKey ? { ...c, qty } : c)));
  }

  async function placeOrder() {
    const deliveryFee = parseFloat(deliveryFeeInput) || 0;
    const grandTotal =
      orderType === "delivery" ? cartTotal + deliveryFee : cartTotal;

    if (orderType === "dine-in") {
      if ((!tableNumber.trim() && !customerName.trim()) || cart.length === 0)
        return;
    } else {
      if (!customerName.trim() || !deliveryAddress.trim() || cart.length === 0)
        return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          tableNumber:
            orderType === "dine-in"
              ? tableNumber.trim() || undefined
              : undefined,
          customerName: customerName.trim() || undefined,
          customerContact:
            orderType === "delivery"
              ? customerContact.trim() || undefined
              : undefined,
          deliveryAddress:
            orderType === "delivery" ? deliveryAddress.trim() : undefined,
          deliveryFee: orderType === "delivery" ? deliveryFee : undefined,
          items: cart.map((c) => {
            const custLabels = c.customizations.map((x) =>
              x.price > 0 ? `${x.label} (+₱${x.price})` : x.label,
            );
            return {
              menuItemId: c.item._id,
              name: custLabels.length
                ? `${c.item.name} (${custLabels.join(", ")})`
                : c.item.name,
              price: c.item.price + c.extraPrice,
              quantity: c.qty,
              customizations: c.customizations,
            };
          }),
          total: grandTotal,
          ...(selectedDiscount
            ? {
                discountName: selectedDiscount.name,
                discountPct: selectedDiscount.percentage,
                discountAmount,
                originalTotal: cartSubtotal,
              }
            : {}),
          paymentMethod: paymentMethod === "later" ? "pending" : paymentMethod,
          paymentStatus: paymentMethod === "cash" ? "confirmed" : "pending",
          source: "crew",
          waiterName: staffName.trim(),
          isTab: paymentMethod === "later",
          shiftLabel: (window as any).__3s_shiftLabel || undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Order failed (${res.status})`);
      }
      const data = await res.json();
      if (paymentMethod === "gcash") {
        setShowQR({
          total: grandTotal,
          orderNumber: data.orderNumber,
          orderId: data._id,
        });
      } else if (paymentMethod === "cash") {
        setShowCashNote({ total: grandTotal, orderNumber: data.orderNumber });
      } else {
        setCart([]);
        setTableNumber("");
        setCustomerName("");
        setCustomerContact("");
        setDeliveryAddress("");
        setDeliveryFeeInput("");
        onOrderPlaced();
        fetchMyOrders();
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to place order. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQRDone() {
    if (showQR?.orderId) await crewConfirmPayment(showQR.orderId);
    setShowQR(null);
    setCart([]);
    setTableNumber("");
    setCustomerName("");
    onOrderPlaced();
    fetchMyOrders();
  }

  function handleCashNoteDone() {
    setShowCashNote(null);
    setCart([]);
    setTableNumber("");
    setCustomerName("");
    onOrderPlaced();
    fetchMyOrders();
  }

  if (showQR)
    return (
      <GCashPaymentScreen
        total={showQR.total}
        orderNumber={showQR.orderNumber}
        onDone={handleQRDone}
      />
    );

  if (showCashNote)
    return (
      <CashOrderPlacedScreen
        total={showCashNote.total}
        orderNumber={showCashNote.orderNumber}
        onDone={handleCashNoteDone}
      />
    );

  const OrderSummaryPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {(["dine-in", "delivery"] as const).map((t) => {
            const a = orderType === t;
            return (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                style={{
                  flex: 1,
                  padding: "9px 8px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: a ? T.goldDim : "rgba(255,255,255,0.03)",
                  border: `1px solid ${a ? T.borderH : T.border}`,
                  color: a ? T.gold : T.muted,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: ".06em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {t === "dine-in" ? <Armchair size={13} /> : <Bike size={13} />}
                {t === "dine-in" ? "DINE-IN" : "DELIVERY"}
              </button>
            );
          })}
        </div>
        {orderType === "dine-in" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 8,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                TABLE NUMBER
              </label>
              <input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 5 (optional if name given)"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: T.cream,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: ".04em",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 8,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                CUSTOMER / FRIEND NAME
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Kuya Jun (no table needed)"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: T.cream,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 8,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                CUSTOMER NAME *
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Maya (France's friend)"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: T.cream,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 8,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                PHONE (OPTIONAL)
              </label>
              <input
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="09XX XXX XXXX"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: T.cream,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 8,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                DELIVERY ADDRESS *
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Full address as told by customer"
                rows={2}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: T.cream,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 8,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                DELIVERY FEE (₱)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={deliveryFeeInput}
                onChange={(e) => setDeliveryFeeInput(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: T.cream,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 16,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <p
          style={{
            color: T.muted,
            fontSize: 10,
            letterSpacing: ".12em",
            fontFamily: "'Cinzel',serif",
            marginBottom: 4,
          }}
        >
          ORDER SUMMARY
        </p>
        {cart.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.faint,
              fontSize: 13,
              textAlign: "center",
              padding: 20,
            }}
          >
            <div>
              <UtensilsCrossed
                size={28}
                style={{ margin: "0 auto 8px", opacity: 0.3 }}
              />
              <p>Tap items to add them</p>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                overflowY: "auto",
                maxHeight: isMobile ? 220 : 300,
              }}
            >
              {cart.map(
                ({ item, qty, extraPrice, customizations, cartKey }) => (
                  <div
                    key={cartKey}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          color: T.cream,
                          fontSize: 12,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </p>
                      {customizations.length > 0 && (
                        <p
                          style={{ color: T.faint, fontSize: 10, marginTop: 1 }}
                        >
                          {customizations.map((x) => x.label).join(", ")}
                        </p>
                      )}
                      <p
                        style={{
                          color: T.gold,
                          fontSize: 12,
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        {fmt((item.price + extraPrice) * qty)}
                      </p>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <button
                        onClick={() => updateQty(cartKey, qty - 1)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          border: `1px solid ${T.border}`,
                          background: "none",
                          color: T.muted,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          width: 22,
                          textAlign: "center",
                          color: T.cream,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQty(cartKey, qty + 1)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          background: T.gold,
                          border: "none",
                          color: "#0a0f0a",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
            <div
              style={{
                borderTop: `1px solid ${T.border}`,
                paddingTop: 12,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <span style={{ color: T.muted, fontSize: 12 }}>
                  Total ({cartCount} items)
                </span>
                <span
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: T.gold,
                  }}
                >
                  {discountAmount > 0 ? (
                    <>
                      <span
                        style={{
                          fontSize: 12,
                          color: T.muted,
                          textDecoration: "line-through",
                          marginRight: 6,
                        }}
                      >
                        {fmt(cartSubtotal)}
                      </span>
                      {fmt(cartTotal)}
                    </>
                  ) : (
                    fmt(cartTotal)
                  )}
                </span>
              </div>
              {discounts.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Discount
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {discounts.map((d) => {
                      const active = selectedDiscount?._id === d._id;
                      return (
                        <button
                          key={d._id}
                          onClick={() => setSelectedDiscount(active ? null : d)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            background: active
                              ? T.goldDim
                              : "rgba(255,255,255,0.04)",
                            border: `1px solid ${active ? T.borderH : T.border}`,
                            color: active ? T.gold : T.muted,
                            transition: "all 0.15s",
                          }}
                        >
                          {d.name} · {d.percentage}% off
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {(["cash", "gcash", "later"] as const).map((m) => {
                  const a = paymentMethod === m;
                  const activeColor =
                    m === "cash" ? T.green : m === "gcash" ? T.gold : T.blue;
                  return (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      style={{
                        flex: 1,
                        padding: "9px 8px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: a
                          ? m === "cash"
                            ? "rgba(34,197,94,0.15)"
                            : m === "gcash"
                              ? T.goldDim
                              : "rgba(91,155,213,0.15)"
                          : "rgba(255,255,255,0.03)",
                        border: `1px solid ${a ? activeColor : T.border}`,
                        color: a ? activeColor : T.muted,
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "'Cinzel',serif",
                        letterSpacing: ".06em",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {m === "cash" ? (
                        <>
                          <Banknote size={15} />
                          CASH
                        </>
                      ) : m === "gcash" ? (
                        <>
                          <img
                            src="/images/gcash.png"
                            alt="GCash"
                            style={{
                              width: 15,
                              height: 15,
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                          GCASH
                        </>
                      ) : (
                        <>
                          <Clock size={15} />
                          PAY LATER
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={placeOrder}
                disabled={
                  (orderType === "dine-in"
                    ? !tableNumber.trim() && !customerName.trim()
                    : !customerName.trim() || !deliveryAddress.trim()) ||
                  cart.length === 0 ||
                  submitting
                }
                style={{
                  width: "100%",
                  padding: "13px",
                  background:
                    (orderType === "dine-in"
                      ? tableNumber.trim() || customerName.trim()
                      : customerName.trim() && deliveryAddress.trim()) &&
                    cart.length > 0
                      ? T.gold
                      : "rgba(212,168,67,0.25)",
                  color:
                    (orderType === "dine-in"
                      ? tableNumber.trim() || customerName.trim()
                      : customerName.trim() && deliveryAddress.trim()) &&
                    cart.length > 0
                      ? "#0a0f0a"
                      : T.muted,
                  border: "none",
                  borderRadius: 12,
                  fontFamily: "'Cinzel',serif",
                  fontSize: 12,
                  letterSpacing: ".12em",
                  fontWeight: 700,
                  cursor:
                    (tableNumber.trim() || customerName.trim()) &&
                    cart.length > 0
                      ? "pointer"
                      : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {submitting ? (
                  "PLACING…"
                ) : paymentMethod === "cash" ? (
                  <>
                    <Banknote size={14} /> PLACE CASH ORDER
                  </>
                ) : paymentMethod === "later" ? (
                  <>
                    <Clock size={14} /> PLACE ORDER — PAY LATER
                  </>
                ) : (
                  <>
                    <QrCode size={14} /> PLACE ORDER & SHOW QR
                  </>
                )}
              </button>
              {orderType === "dine-in" &&
                !tableNumber.trim() &&
                !customerName.trim() && (
                  <p
                    style={{
                      color: "rgba(245,158,11,0.7)",
                      fontSize: 11,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    Enter a table number or a name to proceed
                  </p>
                )}
              {orderType === "delivery" &&
                (!customerName.trim() || !deliveryAddress.trim()) && (
                  <p
                    style={{
                      color: "rgba(245,158,11,0.7)",
                      fontSize: 11,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    Enter customer name and delivery address
                  </p>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {variantItem && (
        <div
          onClick={() => setVariantItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-inner"
            style={{
              background: "#13180f",
              border: `1px solid ${T.borderH}`,
              borderRadius: 18,
              padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
              width: "100%",
              maxWidth: 420,
              maxHeight: "90svh",
              overflowY: "auto",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "'Cinzel',serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: T.cream,
                    letterSpacing: ".02em",
                    lineHeight: 1.3,
                  }}
                >
                  {variantItem.name}
                </p>
                <p style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                  Choose your variant
                </p>
              </div>
              <button
                onClick={() => setVariantItem(null)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 999,
                  width: 30,
                  height: 30,
                  minWidth: 30,
                  color: T.muted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(variantItem.variants || []).map((v: any) => {
                const label = typeof v === "string" ? v : v.label;
                const price =
                  typeof v === "object" && v.price != null ? v.price : null;
                return (
                  <button
                    key={label}
                    onClick={() => {
                      const resolved = {
                        ...variantItem,
                        name: `${variantItem.name} (${label})`,
                        ...(price != null ? { price } : {}),
                      };
                      setVariantItem(null);
                      if (resolved.options && resolved.options.length > 0) {
                        const nonVariantOptions = resolved.options.filter(
                          (g: any) => g.name.toLowerCase() !== "variant",
                        );
                        if (nonVariantOptions.length > 0) {
                          setGenericOptionsItem({
                            ...resolved,
                            options: nonVariantOptions,
                          });
                          return;
                        }
                      }
                      const config = getCrewCustomizations(
                        resolved.category,
                        resolved.name,
                        liveSauces,
                        liveEggStyles,
                        milkSubItemsExist ? liveMilkSubs : undefined,
                        baseSubItemsExist ? liveBaseSubs : undefined,
                      );
                      if (config) {
                        setCustomizingItem(resolved);
                        setCustomizingConfig(config);
                      } else {
                        addToCartFinal(resolved, 0, []);
                      }
                    }}
                    style={{
                      padding: "13px 16px",
                      borderRadius: 10,
                      border: `1.5px solid ${T.border}`,
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: T.cream,
                      fontSize: 14,
                      fontFamily: "'Cinzel',serif",
                      letterSpacing: ".04em",
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.gold;
                      e.currentTarget.style.background = T.goldDim;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span>{label}</span>
                    {price != null && (
                      <span
                        style={{
                          color: T.gold,
                          fontFamily: "'Cinzel',serif",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        ₱{price}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {genericOptionsItem && (
        <GenericOptionsSheet
          item={genericOptionsItem}
          onClose={() => setGenericOptionsItem(null)}
          onAdd={(extraPrice, customizations) => {
            addToCartFinal(genericOptionsItem, extraPrice, customizations);
            setGenericOptionsItem(null);
          }}
        />
      )}
      {customizingItem && customizingConfig && (
        <CrewCustomizationSheet
          item={customizingItem}
          config={customizingConfig}
          onClose={() => {
            setCustomizingItem(null);
            setCustomizingConfig(null);
          }}
          onAdd={(extraPrice, customizations) =>
            addToCartFinal(customizingItem, extraPrice, customizations)
          }
        />
      )}
      {cancelTarget && (
        <CancelReasonModal
          onConfirm={async (reason) => {
            const id = cancelTarget;
            setCancelTarget(null);
            const res = await fetch(`/api/orders/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "cancelled",
                cancelReason: reason,
              }),
            });
            if (res.ok)
              setMyOrders((p) =>
                p.map((o) =>
                  o._id === id
                    ? { ...o, status: "cancelled", cancelReason: reason }
                    : o,
                ),
              );
          }}
          onCancel={() => setCancelTarget(null)}
        />
      )}
      {receiptSrc && (
        <ImageLightbox src={receiptSrc} onClose={() => setReceiptSrc(null)} />
      )}

      {isMobile && showCartMobile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowCartMobile(false)}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "#0f1a0f",
              border: `1px solid ${T.border}`,
              borderRadius: "20px 20px 0 0",
              padding: "20px 16px 32px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: T.border,
                borderRadius: 999,
                margin: "0 auto 20px",
              }}
            />
            {OrderSummaryPanel}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: isMobile ? "block" : "grid",
            gridTemplateColumns: "1fr 300px",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              {categories.map((cat) => {
                const a = activeCat === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      whiteSpace: "nowrap",
                      padding: "5px 12px",
                      borderRadius: 999,
                      cursor: "pointer",
                      flexShrink: 0, // ← I added this
                      border: `1px solid ${a ? T.gold : T.border}`,
                      background: a ? T.gold : "transparent",
                      color: a ? "#0a0f0a" : T.muted,
                      fontFamily: "'Cinzel',serif",
                      fontSize: 11,
                      letterSpacing: ".08em",
                      fontWeight: a ? 700 : 400,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? "140px" : "155px"},1fr))`,
                gap: 10,
              }}
            >
              {filtered.map((item) => {
                const inCart = cart.find((c) => c.item._id === item._id);
                return (
                  <div
                    key={item._id}
                    onClick={() => addItem(item)}
                    className="crew-item-card"
                    data-incart={inCart ? "1" : "0"}
                    style={{
                      background: inCart ? T.goldDim : T.bgCard,
                      border: `1px solid ${inCart ? T.gold : T.border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    {item.image && (
                      <div style={{ height: 70, overflow: "hidden" }}>
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                      </div>
                    )}
                    <div style={{ padding: "10px 12px" }}>
                      <p
                        style={{
                          color: T.cream,
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        {item.name}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Cinzel',serif",
                            color: T.gold,
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {fmt(item.price)}
                        </span>
                        {inCart && (
                          <span
                            style={{
                              background: T.gold,
                              color: "#0a0f0a",
                              borderRadius: 999,
                              width: 20,
                              height: 20,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {inCart.qty}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {availItems.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: T.faint,
                }}
              >
                <p>No available items. Ask admin to add some.</p>
              </div>
            )}
          </div>

          {!isMobile && <div>{OrderSummaryPanel}</div>}
        </div>

        {isMobile && (
          <div style={{ position: "sticky", bottom: 16, zIndex: 100 }}>
            <button
              onClick={() => setShowCartMobile(true)}
              style={{
                width: "100%",
                padding: "14px 20px",
                background: cartCount > 0 ? T.gold : "rgba(212,168,67,0.3)",
                border: "none",
                borderRadius: 14,
                color: cartCount > 0 ? "#0a0f0a" : T.muted,
                fontFamily: "'Cinzel',serif",
                fontSize: 13,
                letterSpacing: ".1em",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow:
                  cartCount > 0 ? "0 4px 20px rgba(212,168,67,0.4)" : "none",
                transition: "all .2s",
              }}
            >
              <UtensilsCrossed size={16} />
              {cartCount > 0
                ? `VIEW ORDER · ${fmt(cartTotal)} (${cartCount} items)`
                : "Cart is empty"}
            </button>
          </div>
        )}

        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <p
              style={{
                color: T.gold,
                fontSize: 11,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                fontFamily: "'Cinzel',serif",
              }}
            >
              ◆My Orders ({staffName}) — {myOrders.length}
            </p>
            <button
              onClick={fetchMyOrders}
              style={{
                padding: "5px 12px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.muted,
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {loadingOrders ? (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: T.muted,
                fontSize: 12,
              }}
            >
              Loading…
            </div>
          ) : myOrders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 20px",
                color: T.faint,
                fontSize: 13,
              }}
            >
              No orders yet — place your first one above
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myOrders.map((o) => {
                const nextStatus = STATUS_CFG[o.status].next;
                return (
                  <div
                    key={o._id}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: STATUS_CFG[o.status].color,
                            boxShadow: `0 0 6px ${STATUS_CFG[o.status].color}88`,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "'Cinzel',serif",
                            fontSize: 13,
                            color: T.cream,
                            fontWeight: 700,
                            letterSpacing: ".04em",
                          }}
                        >
                          #{o.orderNumber}
                        </span>
                        <span style={{ fontSize: 11, color: T.muted }}>
                          {o.tableNumber
                            ? `Table ${o.tableNumber}`
                            : o.customerName || "Walk-in"}
                        </span>
                        <Badge status={o.status} />
                        <span style={{ fontSize: 11, color: T.muted }}>
                          {ago(o.createdAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Cinzel',serif",
                            color: T.gold,
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {fmt(o.total)}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color:
                              o.paymentStatus === "confirmed"
                                ? T.green
                                : "#f59e0b",
                            background:
                              o.paymentStatus === "confirmed"
                                ? "rgba(34,197,94,0.1)"
                                : "rgba(245,158,11,0.1)",
                            border: `1px solid ${o.paymentStatus === "confirmed" ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {o.paymentStatus === "confirmed" ? (
                            <>
                              <Check
                                size={10}
                                style={{
                                  display: "inline",
                                  verticalAlign: "middle",
                                  marginRight: 3,
                                }}
                              />
                              Paid
                            </>
                          ) : (
                            <>
                              <Clock
                                size={10}
                                style={{
                                  display: "inline",
                                  verticalAlign: "middle",
                                  marginRight: 3,
                                }}
                              />
                              Unpaid
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <p style={{ color: T.muted, fontSize: 11 }}>
                      {o.items
                        .map((it) => `${it.quantity}× ${it.name}`)
                        .join(", ")}
                    </p>
                    {o.status !== "completed" && o.status !== "cancelled" && (
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {nextStatus && (
                          <button
                            onClick={() => crewUpdateStatus(o._id, nextStatus)}
                            style={{
                              flex: 1,
                              minWidth: 110,
                              padding: "7px 12px",
                              background: STATUS_CFG[nextStatus].color + "18",
                              border: `1px solid ${STATUS_CFG[nextStatus].color}44`,
                              color: STATUS_CFG[nextStatus].color,
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            → {STATUS_CFG[nextStatus].label}
                          </button>
                        )}
                        {o.paymentStatus === "pending" && (
                          <button
                            onClick={() => crewConfirmPayment(o._id)}
                            style={{
                              padding: "7px 12px",
                              background: "rgba(34,197,94,0.1)",
                              border: "1px solid rgba(34,197,94,0.3)",
                              color: T.green,
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Confirm Payment
                          </button>
                        )}
                        {o.receiptUrl && (
                          <button
                            onClick={() => setReceiptSrc(o.receiptUrl!)}
                            style={{
                              padding: "7px 12px",
                              background: "rgba(91,155,213,0.08)",
                              border: "1px solid rgba(91,155,213,0.2)",
                              color: T.blue,
                              borderRadius: 8,
                              fontSize: 11,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <ImageIcon size={11} /> Receipt
                          </button>
                        )}
                        <button
                          onClick={() => setCancelTarget(o._id)}
                          style={{
                            padding: "7px 12px",
                            background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            color: T.red,
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── VOUCHERS ADMIN TAB ────────────────────────────────────────────────────────
function DiscountsAdminTab({
  discounts,
  setDiscounts,
}: {
  discounts: DiscountPreset[];
  setDiscounts: React.Dispatch<React.SetStateAction<DiscountPreset[]>>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", percentage: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  async function addDiscount() {
    const pct = parseFloat(form.percentage);
    if (!form.name.trim() || isNaN(pct) || pct <= 0 || pct > 100) return;
    setSaving(true);
    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), percentage: pct }),
      });
      if (res.ok) {
        const d = await res.json();
        setDiscounts((p) => [...p, d]);
        setForm({ name: "", percentage: "" });
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateDiscount(id: string) {
    const pct = parseFloat(form.percentage);
    if (!form.name.trim() || isNaN(pct) || pct <= 0 || pct > 100) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), percentage: pct }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDiscounts((p) => p.map((d) => (d._id === id ? updated : d)));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteDiscount(id: string) {
    const res = await fetch(`/api/discounts/${id}`, { method: "DELETE" });
    if (res.ok) setDiscounts((p) => p.filter((d) => d._id !== id));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <p
          style={{
            color: T.gold,
            fontSize: 11,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            fontFamily: "'Cinzel',serif",
            margin: 0,
          }}
        >
          ◆ Discount Presets
        </p>
        <button
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
            setForm({ name: "", percentage: "" });
          }}
          style={{
            background: T.goldDim,
            border: `1px solid ${T.borderH}`,
            color: T.gold,
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Plus size={13} /> Add Discount
        </button>
      </div>

      {showAdd && (
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.borderH}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              color: T.gold,
              fontSize: 11,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            New Discount
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Name (e.g. Senior Citizen)"
              style={{
                flex: 2,
                minWidth: 160,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: T.cream,
                fontSize: 13,
                outline: "none",
              }}
            />
            <div style={{ position: "relative", flex: 1, minWidth: 90 }}>
              <input
                value={form.percentage}
                onChange={(e) =>
                  setForm((p) => ({ ...p, percentage: e.target.value }))
                }
                placeholder="0"
                type="number"
                min="1"
                max="100"
                onWheel={(e) => e.currentTarget.blur()}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "9px 28px 9px 12px",
                  color: T.cream,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: T.muted,
                  fontSize: 13,
                }}
              >
                %
              </span>
            </div>
            <button
              onClick={addDiscount}
              disabled={saving}
              style={{
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.35)",
                color: T.green,
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {saving ? "..." : "Save"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              style={{
                background: "transparent",
                border: `1px solid ${T.border}`,
                color: T.muted,
                borderRadius: 8,
                padding: "9px 12px",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {discounts.length === 0 && !showAdd ? (
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
            color: T.faint,
          }}
        >
          <DollarSign
            size={28}
            style={{ margin: "0 auto 8px", opacity: 0.3 }}
          />
          <p style={{ fontSize: 13 }}>No discounts yet. Add one above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {discounts.map((d) => (
            <div
              key={d._id}
              style={{
                background: T.bgCard,
                border: `1px solid ${editingId === d._id ? T.borderH : T.border}`,
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {editingId === d._id ? (
                <>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    style={{
                      flex: 2,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: "7px 10px",
                      color: T.cream,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <div style={{ position: "relative", flex: 1, minWidth: 80 }}>
                    <input
                      value={form.percentage}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, percentage: e.target.value }))
                      }
                      type="number"
                      min="1"
                      max="100"
                      onWheel={(e) => e.currentTarget.blur()}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        padding: "7px 24px 7px 10px",
                        color: T.cream,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: T.muted,
                        fontSize: 12,
                      }}
                    >
                      %
                    </span>
                  </div>
                  <button
                    onClick={() => updateDiscount(d._id)}
                    disabled={saving}
                    style={{
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.35)",
                      color: T.green,
                      borderRadius: 8,
                      padding: "7px 12px",
                      cursor: "pointer",
                    }}
                  >
                    {saving ? "..." : <Check size={13} />}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      color: T.muted,
                      borderRadius: 8,
                      padding: "7px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                <>
                  <p
                    style={{
                      flex: 1,
                      color: T.cream,
                      fontSize: 14,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {d.name}
                  </p>
                  <span
                    style={{
                      background: T.goldDim,
                      border: `1px solid ${T.borderH}`,
                      color: T.gold,
                      borderRadius: 20,
                      padding: "3px 12px",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'Cinzel',serif",
                      flexShrink: 0,
                    }}
                  >
                    {d.percentage}% off
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(d._id);
                      setForm({
                        name: d.name,
                        percentage: String(d.percentage),
                      });
                      setShowAdd(false);
                    }}
                    style={{
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      color: T.muted,
                      borderRadius: 8,
                      padding: "7px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deleteDiscount(d._id)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: T.red,
                      borderRadius: 8,
                      padding: "7px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VouchersAdminTab() {
  const [data, setData] = useState<{
    drinkRemaining: number;
    foodRemaining: number;
    todayRedemptions: {
      _id: string;
      type: string;
      customerName: string;
      redeemedAt: string;
      code?: string;
      used?: boolean;
    }[];
    allCodes: {
      _id: string;
      type: string;
      customerName: string;
      redeemedAt: string;
      code?: string;
      used?: boolean;
    }[];
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchVouchers();
  }, []);

  async function fetchVouchers() {
    fetch("/api/vouchers")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }

  async function handleVerify() {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/vouchers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim().toUpperCase() }),
      });
      const result = await res.json();
      if (res.ok) {
        setVerifyResult({
          ok: true,
          msg: `✓ Valid! ${result.type === "drink" ? "Drink" : "Food"} voucher for ${result.customerName}. Marked as used.`,
        });
        setVerifyCode("");
        fetchVouchers();
      } else {
        setVerifyResult({ ok: false, msg: result.error });
      }
    } catch {
      setVerifyResult({ ok: false, msg: "Network error." });
    }
    setVerifying(false);
  }

  if (!data)
    return (
      <div style={{ color: T.muted, fontSize: 13, padding: 20 }}>Loading…</div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* VERIFY BLOCK */}
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.borderH}`,
          borderRadius: 14,
          padding: 20,
        }}
      >
        <p
          style={{
            color: T.gold,
            fontSize: 11,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            fontFamily: "'Cinzel',serif",
            marginBottom: 12,
          }}
        >
          ──Verify Voucher Code
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="e.g. DRK-4X9K"
            style={{
              flex: "1 1 160px",
              minWidth: 0,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.borderH}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: T.cream,
              fontSize: 16,
              fontFamily: "'Cinzel',serif",
              letterSpacing: "0.1em",
              outline: "none",
            }}
          />
          <button
            onClick={handleVerify}
            disabled={verifying || !verifyCode.trim()}
            style={{
              padding: "10px 20px",
              background: verifyCode.trim() ? T.gold : "rgba(212,168,67,0.2)",
              border: "none",
              borderRadius: 8,
              color: verifyCode.trim() ? "#0a0f0a" : T.muted,
              fontFamily: "'Cinzel',serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".1em",
              cursor: verifyCode.trim() ? "pointer" : "not-allowed",
            }}
          >
            {verifying ? "CHECKING…" : "VERIFY"}
          </button>
        </div>
        {verifyResult && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 8,
              background: verifyResult.ok
                ? "rgba(34,197,94,0.08)"
                : "rgba(239,68,68,0.08)",
              border: `1px solid ${verifyResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: verifyResult.ok ? T.green : T.red,
              fontSize: 13,
            }}
          >
            {verifyResult.msg}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {[
          {
            label: "Drink Vouchers Left",
            value: data.drinkRemaining,
            color: T.gold,
          },
          {
            label: "Food Vouchers Left",
            value: data.foodRemaining,
            color: T.green,
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <p
              style={{
                color: T.muted,
                fontSize: 10,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontFamily: "'Cinzel',serif",
                marginBottom: 8,
              }}
            >
              {s.label}
            </p>
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 28,
                fontWeight: 700,
                color: s.color,
              }}
            >
              {s.value}
              <span style={{ fontSize: 14, color: T.muted }}>/5</span>
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 20,
        }}
      >
        <p
          style={{
            color: T.gold,
            fontSize: 11,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            fontFamily: "'Cinzel',serif",
            marginBottom: 16,
          }}
        >
          ◆All Codes Today — {data.allCodes?.length || 0}
        </p>
        {!data.allCodes || data.allCodes.length === 0 ? (
          <p style={{ color: T.faint, fontSize: 13 }}>
            No codes claimed today.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {data.allCodes.map((r) => (
              <div
                key={r._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${r.used ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                  borderRadius: 8,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: r.type === "drink" ? T.gold : T.green,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {r.type === "drink" ? (
                      <Coffee size={12} />
                    ) : (
                      <UtensilsCrossed size={12} />
                    )}
                    {r.type === "drink" ? "Drink" : "Food"}
                  </span>
                  <span
                    style={{ fontSize: 13, color: T.cream, fontWeight: 600 }}
                  >
                    {r.customerName || "—"}
                  </span>
                  {r.code && (
                    <span
                      style={{
                        fontFamily: "'Cinzel',serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.gold,
                        background: "rgba(212,168,67,0.1)",
                        border: "1px solid rgba(212,168,67,0.3)",
                        padding: "2px 10px",
                        borderRadius: 4,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {r.code}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 4,
                      color: r.used ? T.red : T.green,
                      background: r.used
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(34,197,94,0.08)",
                      border: `1px solid ${r.used ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
                    }}
                  >
                    {r.used ? "✗ Used" : "✓ Active"}
                  </span>
                  <span style={{ fontSize: 11, color: T.muted }}>
                    {ago(r.redeemedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p
          style={{
            color: T.gold,
            fontSize: 11,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            fontFamily: "'Cinzel',serif",
            marginBottom: 16,
          }}
        >
          ◆Today&apos;s Claims — {data.todayRedemptions.length}
        </p>
        {data.todayRedemptions.length === 0 ? (
          <p style={{ color: T.faint, fontSize: 13 }}>No claims today yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.todayRedemptions.map((r) => (
              <div
                key={r._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: r.type === "drink" ? T.gold : T.green,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {r.type === "drink" ? (
                      <Coffee size={12} />
                    ) : (
                      <UtensilsCrossed size={12} />
                    )}
                    {r.type === "drink" ? "Drink" : "Food"} Voucher
                  </span>
                  <span
                    style={{ fontSize: 13, color: T.cream, fontWeight: 600 }}
                  >
                    {r.customerName || "—"}
                  </span>
                  {r.code && (
                    <span
                      style={{
                        fontFamily: "'Cinzel',serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.gold,
                        background: "rgba(212,168,67,0.1)",
                        border: "1px solid rgba(212,168,67,0.3)",
                        padding: "2px 10px",
                        borderRadius: 4,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {r.code}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: T.muted }}>
                  {ago(r.redeemedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── OPEN SHIFT MODAL ─────────────────────────────────────────────────────────
function OpenShiftModal({
  defaultLabel = "Shift 1",
  onConfirm,
  onCancel,
}: {
  defaultLabel?: string;
  onConfirm: (startingCash: number, label: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState("");
  const [label, setLabel] = useState(defaultLabel);
  const amount = parseFloat(val) || 0;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Power size={32} color={T.green} style={{ margin: "0 auto 8px" }} />
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.cream,
              fontSize: 14,
              letterSpacing: ".1em",
              marginBottom: 2,
            }}
          >
            OPEN SHIFT
          </p>
          <p style={{ color: T.muted, fontSize: 12 }}>
            Count the drawer float before opening
          </p>
        </div>

        <div>
          <label
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              display: "block",
              marginBottom: 6,
            }}
          >
            SHIFT NAME
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Shift 1"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.borderH}`,
              borderRadius: 10,
              padding: "11px 14px",
              color: T.cream,
              fontSize: 16,
              fontFamily: "'Cinzel',serif",
              outline: "none",
              boxSizing: "border-box" as const,
              marginBottom: 12,
            }}
          />
        </div>
        <div>
          <label
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              display: "block",
              marginBottom: 6,
            }}
          >
            STARTING CASH (FLOAT)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="0.00"
            autoFocus
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.borderH}`,
              borderRadius: 10,
              padding: "12px 14px",
              color: T.cream,
              fontSize: 22,
              fontFamily: "'Cinzel',serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => onConfirm(amount, label.trim() || "Shift 1")}
            style={{
              flex: 1,
              padding: "12px",
              background: T.green,
              border: `1px solid ${T.green}`,
              borderRadius: 10,
              color: "#0a0f0a",
              fontFamily: "'Cinzel',serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              cursor: "pointer",
            }}
          >
            OPEN STORE
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "12px 18px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CASH LOG MODAL (Paid In / Paid Out) ──────────────────────────────────────
function CashLogModal({
  onClose,
  staffName,
  onLogged,
}: {
  onClose: () => void;
  staffName: string;
  onLogged?: (type: "in" | "out", amount: number) => void;
}) {
  const [paidIn, setPaidIn] = useState<
    { amount: number; note: string; at: string }[]
  >([]);
  const [paidOut, setPaidOut] = useState<
    { amount: number; note: string; at: string }[]
  >([]);
  const [type, setType] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shop-status/cash-log")
      .then((r) => r.json())
      .then((d) => {
        setPaidIn(d.paidIn || []);
        setPaidOut(d.paidOut || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/shop-status/cash-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: amt, note, loggedBy: staffName }),
      });
      if (res.ok) {
        const d = await res.json();
        const newIn = d.paidIn || [];
        const newOut = d.paidOut || [];
        setPaidIn(newIn);
        setPaidOut(newOut);
        // Single combined rawbt: URL — slip text + drawer kick in one
        // buffer, so RawBT can't drop either half.
        try {
          const bytes = buildCashLogReceiptBytes({
            type,
            amount: amt,
            note,
            staffName,
            at: new Date().toISOString(),
            totalIn: newIn.reduce((s: number, e: any) => s + e.amount, 0),
            totalOut: newOut.reduce((s: number, e: any) => s + e.amount, 0),
          });
          openRawBtUrl(escPosToRawBtUrl(bytes));
        } catch {
          // no-op if RawBT isn't reachable — never block the actual log entry
        }
        onLogged?.(type, amt);
        setAmount("");
        setNote("");
      }
    } catch {}
    setSaving(false);
  }

  const inTotal = paidIn.reduce((s, e) => s + e.amount, 0);
  const outTotal = paidOut.reduce((s, e) => s + e.amount, 0);

  const allEntries = [
    ...paidIn.map((e) => ({ ...e, type: "in" as const })),
    ...paidOut.map((e) => ({ ...e, type: "out" as const })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.cream,
              fontSize: 14,
              letterSpacing: ".1em",
            }}
          >
            CASH IN / OUT
          </p>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: T.muted,
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {(["out", "in"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1,
                padding: "9px 8px",
                borderRadius: 8,
                cursor: "pointer",
                background:
                  type === t
                    ? t === "out"
                      ? "rgba(239,68,68,0.12)"
                      : "rgba(34,197,94,0.12)"
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${
                  type === t
                    ? t === "out"
                      ? "rgba(239,68,68,0.4)"
                      : "rgba(34,197,94,0.4)"
                    : T.border
                }`,
                color: type === t ? (t === "out" ? T.red : T.green) : T.muted,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Cinzel',serif",
                letterSpacing: ".06em",
              }}
            >
              {t === "out" ? "PAID OUT" : "PAID IN"}
            </button>
          ))}
        </div>

        <div>
          <label
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              display: "block",
              marginBottom: 6,
            }}
          >
            AMOUNT
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.borderH}`,
              borderRadius: 10,
              padding: "11px 14px",
              color: T.cream,
              fontSize: 18,
              fontFamily: "'Cinzel',serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              display: "block",
              marginBottom: 6,
            }}
          >
            NOTE — REQUIRED (e.g. "bought ice", "owner remittance")
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's this for? (required)"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${
                !note.trim() ? "rgba(239,68,68,0.35)" : T.border
              }`,
              borderRadius: 8,
              padding: "9px 12px",
              color: T.cream,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={submit}
          disabled={
            !amount || parseFloat(amount) <= 0 || !note.trim() || saving
          }
          style={{
            width: "100%",
            padding: "11px",
            background:
              amount && parseFloat(amount) > 0 && note.trim()
                ? type === "out"
                  ? "rgba(239,68,68,0.6)"
                  : T.green
                : "rgba(255,255,255,0.05)",
            border: "none",
            borderRadius: 10,
            color:
              amount && parseFloat(amount) > 0 && note.trim()
                ? "#0a0f0a"
                : T.muted,
            fontFamily: "'Cinzel',serif",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".08em",
            cursor:
              amount && parseFloat(amount) > 0 && note.trim()
                ? "pointer"
                : "not-allowed",
          }}
        >
          {saving
            ? "SAVING…"
            : !note.trim()
              ? "NOTE REQUIRED"
              : `LOG ${type === "out" ? "PAID OUT" : "PAID IN"}`}
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `1px solid ${T.border}`,
            paddingTop: 10,
          }}
        >
          <span style={{ color: T.green, fontSize: 12 }}>
            Total In: {fmt(inTotal)}
          </span>
          <span style={{ color: T.red, fontSize: 12 }}>
            Total Out: {fmt(outTotal)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {loading ? (
            <p style={{ color: T.muted, fontSize: 12, textAlign: "center" }}>
              Loading…
            </p>
          ) : allEntries.length === 0 ? (
            <p style={{ color: T.faint, fontSize: 12, textAlign: "center" }}>
              No entries yet this shift
            </p>
          ) : (
            allEntries.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 10px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: T.muted,
                    fontSize: 11,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.note || (e.type === "out" ? "Paid out" : "Paid in")}
                  {(e as any).loggedBy && (
                    <span style={{ color: T.faint, marginLeft: 6 }}>
                      — {(e as any).loggedBy}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    color: e.type === "out" ? T.red : T.green,
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {e.type === "out" ? "−" : "+"}
                  {fmt(e.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CloseShiftModal({
  cashRevToday,
  onConfirm,
  onCancel,
}: {
  cashRevToday: number;
  onConfirm: (countedCash: number) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [startingCash, setStartingCash] = useState(0);
  const [paidIn, setPaidIn] = useState(0);
  const [paidOut, setPaidOut] = useState(0);
  const [countedInput, setCountedInput] = useState("");

  useEffect(() => {
    fetch("/api/shop-status")
      .then((r) => r.json())
      .then((d) => {
        setStartingCash(d.startingCash || 0);
      })
      .catch(() => {});
    fetch("/api/shop-status/cash-log")
      .then((r) => r.json())
      .then((d) => {
        setPaidIn(
          (d.paidIn || []).reduce((s: number, e: any) => s + e.amount, 0),
        );
        setPaidOut(
          (d.paidOut || []).reduce((s: number, e: any) => s + e.amount, 0),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  const expected = startingCash + cashRevToday + paidIn - paidOut;
  const counted = parseFloat(countedInput);
  const hasCounted = countedInput !== "" && !isNaN(counted);
  const diff = hasCounted ? counted - expected : 0;

  const row = (label: string, value: string, color?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: T.muted, fontSize: 12 }}>{label}</span>
      <span style={{ color: color || T.cream, fontSize: 12, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <PowerOff size={32} color={T.red} style={{ margin: "0 auto 8px" }} />
          <p
            style={{
              fontFamily: "'Cinzel',serif",
              color: T.cream,
              fontSize: 14,
              letterSpacing: ".1em",
              marginBottom: 2,
            }}
          >
            CLOSE SHIFT
          </p>
          <p style={{ color: T.muted, fontSize: 12 }}>
            Count the drawer before closing
          </p>
        </div>

        {loading ? (
          <p style={{ color: T.muted, fontSize: 12, textAlign: "center" }}>
            Loading shift data…
          </p>
        ) : (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {row("Starting cash", fmt(startingCash))}
            {row("Cash sales today", fmt(cashRevToday), T.green)}
            {paidIn > 0 && row("Paid in", fmt(paidIn), T.green)}
            {paidOut > 0 && row("Paid out", `-${fmt(paidOut)}`, T.red)}
            <div
              style={{
                borderTop: `1px solid ${T.border}`,
                paddingTop: 6,
                marginTop: 2,
              }}
            >
              {row("Expected cash", fmt(expected), T.gold)}
            </div>
          </div>
        )}

        <div>
          <label
            style={{
              color: T.muted,
              fontSize: 10,
              letterSpacing: ".1em",
              display: "block",
              marginBottom: 6,
            }}
          >
            COUNTED CASH (ACTUAL DRAWER)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={countedInput}
            onChange={(e) => setCountedInput(e.target.value)}
            placeholder="0.00"
            autoFocus
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.borderH}`,
              borderRadius: 10,
              padding: "12px 14px",
              color: T.cream,
              fontSize: 22,
              fontFamily: "'Cinzel',serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {hasCounted && (
          <div
            style={{
              background:
                diff === 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${diff === 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: T.muted, fontSize: 12 }}>
              {diff === 0
                ? "Drawer matches ✓"
                : diff > 0
                  ? "Over by"
                  : "Short by"}
            </span>
            <span
              style={{
                fontFamily: "'Cinzel',serif",
                color: diff === 0 ? T.green : T.red,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {fmt(Math.abs(diff))}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => hasCounted && onConfirm(counted)}
            disabled={!hasCounted}
            style={{
              flex: 1,
              padding: "12px",
              background: hasCounted ? T.red : "rgba(239,68,68,0.15)",
              border: `1px solid ${hasCounted ? T.red : T.border}`,
              borderRadius: 10,
              color: hasCounted ? "#0a0f0a" : T.muted,
              fontFamily: "'Cinzel',serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              cursor: hasCounted ? "pointer" : "not-allowed",
            }}
          >
            CLOSE STORE
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "12px 18px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SHIFT HANDOVER MODAL ──────────────────────────────────────────────────────
function ShiftHandoverModal({
  currentShiftLabel,
  nextShiftLabel,
  cashRevThisShift,
  startingCash,
  onConfirm,
  onCancel,
}: {
  currentShiftLabel: string;
  nextShiftLabel: string;
  cashRevThisShift: number;
  startingCash: number;
  onConfirm: (
    countedCash: number,
    nextLabel: string,
    nextStartingCash: number,
  ) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"count" | "next">("count");
  const [countedInput, setCountedInput] = useState("");
  const [nextLabel, setNextLabel] = useState(nextShiftLabel);
  const [nextCash, setNextCash] = useState("");
  const [paidIn, setPaidIn] = useState(0);
  const [paidOut, setPaidOut] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/shop-status/cash-log")
      .then((r) => r.json())
      .then((d) => {
        setPaidIn(
          (d.paidIn || []).reduce((s: number, e: any) => s + e.amount, 0),
        );
        setPaidOut(
          (d.paidOut || []).reduce((s: number, e: any) => s + e.amount, 0),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel]);

  const counted = parseFloat(countedInput);
  const hasCounted = countedInput !== "" && !isNaN(counted);
  const expectedCash = startingCash + cashRevThisShift + paidIn - paidOut;
  const diff = hasCounted ? counted - expectedCash : 0;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-inner"
        style={{
          background: "#13180f",
          border: `1px solid ${T.borderH}`,
          borderRadius: 18,
          padding: "clamp(20px,5vw,28px) clamp(16px,4vw,24px)",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        {step === "count" ? (
          <>
            <div style={{ textAlign: "center" }}>
              <RefreshCw
                size={32}
                color={T.gold}
                style={{ margin: "0 auto 8px" }}
              />
              <p
                style={{
                  fontFamily: "'Cinzel',serif",
                  color: T.cream,
                  fontSize: 14,
                  letterSpacing: ".1em",
                  marginBottom: 2,
                }}
              >
                CLOSE {currentShiftLabel.toUpperCase()}
              </p>
              <p style={{ color: T.muted, fontSize: 12 }}>
                Count the drawer before handing over
              </p>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted, fontSize: 12 }}>
                  Starting cash
                </span>
                <span style={{ color: T.cream, fontSize: 12, fontWeight: 600 }}>
                  {fmt(startingCash)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted, fontSize: 12 }}>
                  Cash sales this shift
                </span>
                <span style={{ color: T.green, fontSize: 12, fontWeight: 600 }}>
                  {fmt(cashRevThisShift)}
                </span>
              </div>
              {paidIn > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: T.muted, fontSize: 12 }}>Paid in</span>
                  <span
                    style={{ color: T.green, fontSize: 12, fontWeight: 600 }}
                  >
                    {fmt(paidIn)}
                  </span>
                </div>
              )}
              {paidOut > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: T.muted, fontSize: 12 }}>Paid out</span>
                  <span style={{ color: T.red, fontSize: 12, fontWeight: 600 }}>
                    -{fmt(paidOut)}
                  </span>
                </div>
              )}
              <div
                style={{
                  borderTop: `1px solid ${T.border}`,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: T.muted, fontSize: 12 }}>
                  Expected cash
                </span>
                <span style={{ color: T.gold, fontSize: 12, fontWeight: 700 }}>
                  {fmt(expectedCash)}
                </span>
              </div>
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                COUNTED CASH
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={countedInput}
                onChange={(e) => setCountedInput(e.target.value)}
                placeholder="0.00"
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.borderH}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  color: T.cream,
                  fontSize: 22,
                  fontFamily: "'Cinzel',serif",
                  outline: "none",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>
            {hasCounted && (
              <div
                style={{
                  background:
                    diff === 0
                      ? "rgba(34,197,94,0.08)"
                      : "rgba(239,68,68,0.08)",
                  border: `1px solid ${diff === 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: T.muted, fontSize: 12 }}>
                  {diff === 0
                    ? "Drawer matches ✓"
                    : diff > 0
                      ? "Over by"
                      : "Short by"}
                </span>
                <span
                  style={{
                    fontFamily: "'Cinzel',serif",
                    color: diff === 0 ? T.green : T.red,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {fmt(Math.abs(diff))}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => hasCounted && setStep("next")}
                disabled={!hasCounted}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: hasCounted ? T.gold : "rgba(212,168,67,0.15)",
                  border: "none",
                  borderRadius: 10,
                  color: hasCounted ? "#0a0f0a" : T.muted,
                  fontFamily: "'Cinzel',serif",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: hasCounted ? "pointer" : "not-allowed",
                }}
              >
                NEXT →
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: "12px 18px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  color: T.muted,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <Power
                size={32}
                color={T.green}
                style={{ margin: "0 auto 8px" }}
              />
              <p
                style={{
                  fontFamily: "'Cinzel',serif",
                  color: T.cream,
                  fontSize: 14,
                  letterSpacing: ".1em",
                  marginBottom: 2,
                }}
              >
                OPEN NEXT SHIFT
              </p>
              <p style={{ color: T.muted, fontSize: 12 }}>
                Set up the incoming crew
              </p>
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                SHIFT NAME
              </label>
              <input
                value={nextLabel}
                onChange={(e) => setNextLabel(e.target.value)}
                placeholder="e.g. Shift 2"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.borderH}`,
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: T.cream,
                  fontSize: 16,
                  fontFamily: "'Cinzel',serif",
                  outline: "none",
                  boxSizing: "border-box" as const,
                  marginBottom: 12,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                STARTING CASH (FLOAT)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={nextCash}
                onChange={(e) => setNextCash(e.target.value)}
                placeholder="0.00"
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.borderH}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  color: T.cream,
                  fontSize: 22,
                  fontFamily: "'Cinzel',serif",
                  outline: "none",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={submitting}
                onClick={() => {
                  if (submitting) return;
                  setSubmitting(true);
                  onConfirm(
                    counted,
                    nextLabel.trim() || nextShiftLabel,
                    parseFloat(nextCash) || 0,
                  );
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: T.green,
                  border: "none",
                  borderRadius: 10,
                  color: "#0a0f0a",
                  fontFamily: "'Cinzel',serif",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting
                  ? "SAVING…"
                  : `HAND OVER & OPEN ${(nextLabel || nextShiftLabel).toUpperCase()}`}
              </button>
              <button
                onClick={() => setStep("count")}
                style={{
                  padding: "12px 18px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  color: T.muted,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const w = useWindowWidth();
  const isMobile = w < 640;
  const isSmall = w < 400;

  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [staffName, setStaffName] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [shopOpen, setShopOpen] = useState(true);
  const [confirmClose, setConfirmClose] = useState(false);
  const [shiftDate, setShiftDate] = useState<string | null>(null);
  const [shopToggling, setShopToggling] = useState(false);
  const [confirmPauseShop, setConfirmPauseShop] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [discounts, setDiscounts] = useState<DiscountPreset[]>([]);
  const [shopOpenedAt, setShopOpenedAt] = useState<string | null>(null);
  const [shiftLabel, setShiftLabel] = useState("Shift 1");
  useEffect(() => {
    (window as any).__3s_shiftLabel = shiftLabel;
  }, [shiftLabel]);
  const [shiftStartingCash, setShiftStartingCash] = useState(0);
  // Tracks whether the shop-status + cash-log fetches have actually
  // resolved at least once. Without this, the Cash Management card shows
  // ₱0.00 for Starting Cash/Paid In/Paid Out from the moment the page
  // mounts — indistinguishable from a real zero — until the async fetches
  // finish. On a slow/flaky Mongo connection that gap can be many seconds,
  // making the panel look broken when it's just not loaded yet.
  const [cashDataLoaded, setCashDataLoaded] = useState(false);
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [liveCashLog, setLiveCashLog] = useState<{
    paidInTotal: number;
    paidOutTotal: number;
  }>({ paidInTotal: 0, paidOutTotal: 0 });
  const [showShiftOptions, setShowShiftOptions] = useState(false);
  const [showHandoverFlow, setShowHandoverFlow] = useState(false);
  const [showCashLog, setShowCashLog] = useState(false);
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeConfirm, setActiveConfirm] = useState<{
    id: string;
    type: "order";
  } | null>(null);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const discountBusyRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      if (audioCtxRef.current.state === "suspended")
        audioCtxRef.current.resume();
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });
  }, []);

  const playNotification = useRef<() => void>(() => {});

  useEffect(() => {
    playNotification.current = () => {
      try {
        const ctx = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const beep = (freq: number, start: number, duration: number) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = freq;
          o.type = "sine";
          g.gain.setValueAtTime(0.4, ctx.currentTime + start);
          g.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + start + duration,
          );
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + duration);
        };
        beep(880, 0, 0.15);
        beep(1100, 0.18, 0.15);
        beep(1320, 0.36, 0.25);
      } catch {}
    };
  }, []);

  async function toggleShop(
    next: boolean,
    extra?: {
      startingCash?: number;
      countedCash?: number;
      shiftLabel?: string;
    },
  ) {
    setShopToggling(true);
    try {
      // Opening a shift ALWAYS mints a brand-new timestamp — never reuse
      // whatever shopOpenedAt happens to be in client state, since that can
      // be stale from a shift that wasn't cleanly closed (page refresh,
      // race condition, etc). This is what was causing last night's shift
      // to merge into "today's" numbers even after clicking Open Store.
      let newOpenedAt = shopOpenedAt;
      if (next) {
        newOpenedAt = new Date().toISOString();
      }
      const res = await fetch("/api/shop-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open: next,
          openedAt: newOpenedAt,
          startingCash: extra?.startingCash,
          shiftLabel: extra?.shiftLabel,
        }),
      });
      if (res.ok) {
        setShopOpen(next);
        // Always sync local state to the fresh timestamp we just sent —
        // don't gate on the old shopOpenedAt value, since that's exactly
        // the stale value we're trying to overwrite.
        if (next && newOpenedAt) setShopOpenedAt(newOpenedAt);
        if (next && extra?.shiftLabel) {
          setShiftLabel(extra.shiftLabel);
        }
        if (next && extra?.startingCash != null)
          setShiftStartingCash(extra.startingCash);
        if (next) {
          const statusRes = await fetch("/api/shop-status");
          const statusData = await statusRes.json();
          if (statusData.shiftDate) setShiftDate(statusData.shiftDate);
        }

        if (!next) {
          // pass the shiftDate from state into daily-close
          console.log("[toggleShop] closing with shiftDate:", shiftDate);
        }

        // When pausing, automatically save the daily report
        if (!next) {
          // Same race guard as handoverShift — re-fetch the true openedAt
          // right before closing instead of trusting local state.
          const freshStatus = await fetch("/api/shop-status").then((r) =>
            r.json(),
          );
          const trueOpenedAt = freshStatus.openedAt || shopOpenedAt;
          const closeRes = await fetch("/api/daily-close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              openedAt: trueOpenedAt,
              countedCash: extra?.countedCash,
            }),
          });
          if (closeRes.ok) {
            const closeData = await closeRes.json().catch(() => null);
            if (closeData?.shiftReport) {
              setShiftReports((p) => [...p, closeData.shiftReport]);
            }
            setShiftDate(null);
            setShopOpenedAt(null);
            await fetchData();
            fetch("/api/daily-close", { method: "GET" })
              .then((r) => (r.ok ? r.json() : []))
              .then((data) => {
                if (Array.isArray(data)) setDailyReports(data);
              })
              .catch(() => {});
            showToast("Store closed — today's report saved");
          } else {
            showToast("Store paused — report save failed", false);
          }
        } else {
          showToast(next ? "✓ Store is now open" : "🚫 Store is now closed");
        }
      }
    } catch {
      showToast("Failed to toggle shop status", false);
    }
    setShopToggling(false);
  }

  async function applyItemDiscount(
    orderId: string,
    itemIndex: number,
    discountName: string,
    discountPct: number,
  ) {
    const busyKey = `${orderId}:${itemIndex}`;
    if (discountBusyRef.current.has(busyKey)) return;
    discountBusyRef.current.add(busyKey);

    const target = orders.find((o) => o._id === orderId);
    if (!target) {
      discountBusyRef.current.delete(busyKey);
      return;
    }
    const prevOrders = orders;
    const item = target.items[itemIndex];
    const lineTotal = item.price * item.quantity;
    const discountAmount = Math.round(lineTotal * discountPct) / 100;

    setOrders((p) =>
      p.map((o) => {
        if (o._id !== orderId) return o;
        const items = o.items.map((it, i) =>
          i === itemIndex
            ? { ...it, discountName, discountPct, discountAmount }
            : it,
        );
        const newTotal =
          items.reduce(
            (s, it: any) =>
              s + it.price * it.quantity - (it.discountAmount || 0),
            0,
          ) + ((o as any).deliveryFee || 0);
        return { ...o, items, total: newTotal };
      }),
    );
    showToast(`✓ ${discountPct}% discount applied to item`);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemDiscount: { itemIndex, discountName, discountPct },
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setOrders((p) => p.map((o) => (o._id === orderId ? updated : o)));
    } catch {
      setOrders(prevOrders);
      showToast("Failed to apply discount", false);
    } finally {
      discountBusyRef.current.delete(busyKey);
    }
  }

  async function removeItemDiscount(orderId: string, itemIndex: number) {
    const busyKey = `${orderId}:${itemIndex}`;
    if (discountBusyRef.current.has(busyKey)) return;
    discountBusyRef.current.add(busyKey);

    const prevOrders = orders;
    setOrders((p) =>
      p.map((o) => {
        if (o._id !== orderId) return o;
        const items = o.items.map((it, i) =>
          i === itemIndex
            ? {
                ...it,
                discountName: undefined,
                discountPct: undefined,
                discountAmount: undefined,
              }
            : it,
        );
        const newTotal =
          items.reduce(
            (s, it: any) =>
              s + it.price * it.quantity - (it.discountAmount || 0),
            0,
          ) + ((o as any).deliveryFee || 0);
        return { ...o, items, total: newTotal };
      }),
    );
    showToast("Discount removed");
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemDiscount: { itemIndex, remove: true } }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setOrders((p) => p.map((o) => (o._id === orderId ? updated : o)));
    } catch {
      setOrders(prevOrders);
      showToast("Failed to remove discount", false);
    } finally {
      discountBusyRef.current.delete(busyKey);
    }
  }

  async function handoverShift(
    countedCash: number,
    nextLabel: string,
    nextStartingCash: number,
  ) {
    setShopToggling(true);
    try {
      // Never trust client-side shopOpenedAt here — the 15s background
      // poll can race and stomp it with a stale value between when the
      // last shift opened and now. Always pull the true current openedAt
      // fresh from the server right before filing the report.
      const freshStatus = await fetch("/api/shop-status").then((r) => r.json());
      const trueOpenedAt = freshStatus.openedAt || shopOpenedAt;
      const trueShiftLabel = freshStatus.shiftLabel || shiftLabel;
      const trueStartingCash =
        typeof freshStatus.startingCash === "number"
          ? freshStatus.startingCash
          : shiftStartingCash;

      console.log(
        "[handoverShift] trueOpenedAt:",
        trueOpenedAt,
        "shiftLabel:",
        trueShiftLabel,
      );
      const reportRes = await fetch("/api/shift-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openedAt: trueOpenedAt,
          closedAt: new Date().toISOString(),
          countedCash,
          shiftLabel: trueShiftLabel,
          startingCash: trueStartingCash,
          openedBy: staffName,
        }),
      });
      console.log("[handoverShift] status:", reportRes.status);
      if (reportRes.ok) {
        const saved = await reportRes.json();
        console.log("[handoverShift] saved:", saved);
        setShiftReports((p) => [...p, saved]);
      } else {
        const errText = await reportRes.text().catch(() => "");
        console.error("[handoverShift] FAILED", reportRes.status, errText);
        alert(`Shift report save FAILED (${reportRes.status}): ${errText}`);
      }
      const nextOpenedAt = new Date().toISOString();
      const res = await fetch("/api/shop-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open: true,
          openedAt: nextOpenedAt,
          startingCash: nextStartingCash,
          shiftLabel: nextLabel,
        }),
      });
      if (res.ok) {
        setShiftLabel(nextLabel);
        setShiftStartingCash(nextStartingCash);
        setShopOpenedAt(nextOpenedAt);
        showToast(`✓ ${shiftLabel} closed — ${nextLabel} started`);
      }
    } catch {
      showToast("Handover failed", false);
    }
    setShopToggling(false);
    setShowHandoverFlow(false);
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function fetchLiveCashLog() {
    fetch("/api/shop-status/cash-log")
      .then((r) => r.json())
      .then((d) => {
        const paidInTotal = (d.paidIn || []).reduce(
          (s: number, e: any) => s + (e.amount || 0),
          0,
        );
        const paidOutTotal = (d.paidOut || []).reduce(
          (s: number, e: any) => s + (e.amount || 0),
          0,
        );
        setLiveCashLog({ paidInTotal, paidOutTotal });
      })
      .catch((e) => console.error("[cash-log fetch]", e));
  }

  const isAdmin = role === "admin";

  useEffect(() => {
    fetch("/api/shop-status")
      .then((r) => r.json())
      .then((d) => {
        setShopOpen(d.open);
        if (d.openedAt) setShopOpenedAt(d.openedAt);
        if (d.shiftDate) setShiftDate(d.shiftDate);
        if (d.shiftLabel) setShiftLabel(d.shiftLabel);
        if (d.startingCash) setShiftStartingCash(d.startingCash);
      })
      .catch((e) => console.error("[shop-status GET]", e))
      .finally(() => setCashDataLoaded(true));
    fetch("/api/shift-reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setShiftReports(data);
      })
      .catch(() => {});
    fetch("/api/daily-close", { method: "GET" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setDailyReports(data);
      })
      .catch(() => {});
    fetch("/api/discounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setDiscounts(data);
      })
      .catch(() => {});
    fetchLiveCashLog();
    const savedRole = localStorage.getItem("3s_role") as Role;
    const savedName = localStorage.getItem("3s_name") || "";
    if (savedRole && savedName && !savedName.includes("@")) {
      // Verify the real server-side session before trusting localStorage —
      // avoids a stale "logged in" UI when the cookie is missing/expired/
      // scoped to a different host (e.g. www vs bare domain).
      fetch("/api/accounts/session")
        .then((r) => {
          if (!r.ok) throw new Error("no session");
          return r.json();
        })
        .then((d) => {
          setRole(d.role);
          setStaffName(d.displayName);
          if (d.role === "staff") setTab("crew");
          fetchData();
        })
        .catch(() => {
          localStorage.removeItem("3s_role");
          localStorage.removeItem("3s_name");
          setLoading(false);
        });
    } else {
      localStorage.removeItem("3s_role");
      localStorage.removeItem("3s_name");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "analytics") fetchLiveCashLog();
  }, [tab]);

  useEffect(() => {
    if (!role) return;

    const poll = () => {
      fetchData(true);
      fetchLiveCashLog();
    };

    poll(); // fetch immediately so it doesn't wait 8s on first load

    const id = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, 8000);

    const visHandler = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", visHandler);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visHandler);
    };
  }, [role]);

  async function login() {
    if (!username.trim() || !password.trim()) {
      setLoginErr("Enter username and password.");
      return;
    }
    setLoginLoading(true);
    setLoginErr("");
    try {
      const res = await fetch("/api/accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        if (res.status === 404) {
          await legacyLogin();
          return;
        }
        setLoginErr("Invalid username or password.");
        return;
      }
      const data = await res.json();
      const r: Role = data.role;
      const name: string = data.displayName || username.trim();
      setRole(r);
      setStaffName(name);
      localStorage.setItem("3s_role", r!);
      localStorage.setItem("3s_name", name);
      if (r === "staff") setTab("crew");
      fetchData();
    } catch {
      await legacyLogin();
    } finally {
      setLoginLoading(false);
    }
  }

  async function legacyLogin() {
    setLoginErr(
      "Legacy password login is disabled — please use your account username and password.",
    );
    setPassword("");
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setRole(null);
    setStaffName("");
    setUsername("");
    localStorage.removeItem("3s_role");
    localStorage.removeItem("3s_name");
    setOrders([]);
    setMenuItems([]);
  }

  async function fetchData(silent = false): Promise<void> {
    try {
      if (!silent) setLoading(true);
      const [oRes, sRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/shop-status"),
      ]);
      if (!silent) {
        const [mRes, srRes] = await Promise.all([
          fetch("/api/menu"),
          fetch("/api/shift-reports"),
        ]);
        if (srRes.ok) {
          const srData = await srRes.json();
          if (Array.isArray(srData)) setShiftReports(srData);
        }
        if (mRes.ok) setMenuItems(await mRes.json());
        fetchLiveCashLog();
      }
      if (sRes.ok) {
        const s = await sRes.json();
        setShopOpen(s.open);
        setShopOpenedAt(s.openedAt ?? null);
        setShiftDate(s.shiftDate ?? null);
        if (s.shiftLabel) setShiftLabel(s.shiftLabel);
        if (typeof s.startingCash === "number")
          setShiftStartingCash(s.startingCash);
      }
      if (oRes.ok) {
        const fetched: Order[] = await oRes.json();
        const newOrders = fetched.filter(
          (o) =>
            !prevOrderIdsRef.current.has(o._id) &&
            o.status !== "completed" &&
            o.status !== "cancelled",
        );
        if (prevOrderIdsRef.current.size > 0 && newOrders.length > 0) {
          try {
            const ctx =
              audioCtxRef.current ||
              new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = ctx;
            if (ctx.state === "suspended") await ctx.resume();
            const beep = (freq: number, start: number, dur: number) => {
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.connect(g);
              g.connect(ctx.destination);
              o.frequency.value = freq;
              o.type = "sine";
              g.gain.setValueAtTime(1.0, ctx.currentTime + start);
              g.gain.exponentialRampToValueAtTime(
                0.001,
                ctx.currentTime + start + dur,
              );
              o.start(ctx.currentTime + start);
              o.stop(ctx.currentTime + start + dur + 0.05);
            };
            beep(880, 0, 0.2);
            beep(1100, 0.25, 0.2);
            beep(1320, 0.5, 0.4);
          } catch (e) {
            console.error("sound error", e);
          }
          showToast(
            `${newOrders.length} new order${newOrders.length > 1 ? "s" : ""}!`,
          );
        }
        prevOrderIdsRef.current = new Set(fetched.map((o) => o._id));
        setOrders(fetched);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function updateStatus(
    id: string,
    status: OrderStatus,
    reason?: string,
  ) {
    const prevOrders = orders;
    setOrders((p) =>
      p.map((o) =>
        o._id === id
          ? { ...o, status, ...(reason ? { cancelReason: reason } : {}) }
          : o,
      ),
    );
    showToast(`→ ${STATUS_CFG[status].label}`);
    try {
      const body: any = { status };
      if (reason) body.cancelReason = reason;
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setOrders(prevOrders);
      showToast("Failed to update order status", false);
      console.error(e);
    }
  }

  async function updateItems(id: string, items: OrderItem[], total: number) {
    const prevOrders = orders;
    setOrders((p) => p.map((o) => (o._id === id ? { ...o, items, total } : o)));
    showToast("Order items updated ✓");
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, total }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setOrders(prevOrders);
      showToast("Failed to update items", false);
      console.error(e);
    }
  }

  async function confirmPayment(id: string) {
    const prevOrders = orders;
    setOrders((p) =>
      p.map((o) => (o._id === id ? { ...o, paymentStatus: "confirmed" } : o)),
    );
    showToast("Payment confirmed ✓");
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "confirmed" }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setOrders(prevOrders);
      showToast("Failed to confirm payment", false);
    }
  }

  async function confirmCashPayment(
    id: string,
    cashReceived: number,
    change: number,
  ) {
    const prevOrders = orders;
    const target = orders.find((o) => o._id === id);
    const keepMethod = target?.paymentMethod === "split" ? "split" : "cash";
    setOrders((p) =>
      p.map((o) =>
        o._id === id
          ? {
              ...o,
              paymentStatus: "confirmed",
              paymentMethod: keepMethod,
              cashReceived,
              changeGiven: change,
            }
          : o,
      ),
    );
    showToast(`✓ Paid — Change: ${fmt(change)}`);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: "confirmed",
          paymentMethod: keepMethod,
          cashReceived,
          changeGiven: change,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setOrders(prevOrders);
      showToast("Failed to confirm cash payment", false);
    }
  }

  // NEW: only updates the method, does NOT mark as paid
  async function setPaymentMethod(id: string, method: "cash" | "gcash") {
    const prevOrders = orders;
    setOrders((p) =>
      p.map((o) => (o._id === id ? { ...o, paymentMethod: method } : o)),
    );
    showToast(`Payment method set to ${method}`);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setOrders(prevOrders);
      showToast("Failed to set payment method", false);
    }
  }

  // Lets an admin manually split a payment after the fact — e.g. the
  // customer said "cash" but actually paid part by GCash and it was missed.
  async function adjustSplitPayment(
    id: string,
    cashAmount: number,
    gcashAmount: number,
  ) {
    const prevOrders = orders;
    setOrders((p) =>
      p.map((o) =>
        o._id === id
          ? { ...o, paymentMethod: "split", cashAmount, gcashAmount }
          : o,
      ),
    );
    showToast(
      `Payment split: ${fmt(cashAmount)} cash + ${fmt(gcashAmount)} GCash`,
    );
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "split",
          cashAmount,
          gcashAmount,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setOrders(prevOrders);
      showToast("Failed to update payment split", false);
    }
  }

  function deleteOrder(id: string) {
    setActiveConfirm({ id, type: "order" });
  }

  if (!role) {
    return (
      <div
        style={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background:
            "radial-gradient(ellipse at 50% 20%,rgba(212,168,67,0.1) 0%,transparent 60%), #0a0f0a",
        }}
      >
        <style>{` *{box-sizing:border-box;margin:0;padding:0;}body{background:#0a0f0a;} input:focus{outline:none;border-color:${T.gold}!important;}`}</style>
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 24,
            padding: "40px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 28,
                fontWeight: 700,
                color: T.cream,
                letterSpacing: ".2em",
                marginBottom: 6,
              }}
            >
              3RD SPACE
            </div>
            <div
              style={{
                width: 40,
                height: 1,
                background: `linear-gradient(90deg,transparent,${T.gold},transparent)`,
                margin: "0 auto 8px",
              }}
            />
            <p style={{ color: T.muted, fontSize: 11, letterSpacing: ".15em" }}>
              STAFF & ADMIN PORTAL
            </p>
          </div>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                USERNAME
              </label>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setLoginErr("");
                }}
                onKeyDown={(e) => e.key === "Enter" && login()}
                placeholder="e.g. maria"
                autoComplete="username"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${loginErr ? "rgba(239,68,68,0.5)" : T.border}`,
                  borderRadius: 12,
                  padding: "13px 16px",
                  color: T.cream,
                  fontSize: 14,
                  fontFamily: "inherit",
                  transition: "border-color .2s",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  color: T.muted,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLoginErr("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${loginErr ? "rgba(239,68,68,0.5)" : T.border}`,
                    borderRadius: 12,
                    padding: "13px 44px 13px 16px",
                    color: T.cream,
                    fontSize: 14,
                    fontFamily: "inherit",
                    transition: "border-color .2s",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setShowPass((p) => !p)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: "4px 6px",
                    color: T.cream,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {loginErr && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "rgba(239,68,68,0.8)",
                  fontSize: 12,
                }}
              >
                <AlertCircle size={13} /> {loginErr}
              </div>
            )}
            <button
              onClick={login}
              disabled={loginLoading}
              style={{
                width: "100%",
                padding: "13px",
                background: T.gold,
                border: "none",
                borderRadius: 12,
                color: "#0a0f0a",
                fontFamily: "'Cinzel',serif",
                fontSize: 13,
                letterSpacing: ".15em",
                fontWeight: 700,
                cursor: loginLoading ? "wait" : "pointer",
                opacity: loginLoading ? 0.8 : 1,
              }}
            >
              {loginLoading ? "LOGGING IN…" : "LOGIN"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Guard against a stale/never-reset shopOpenedAt leaking a prior day's
  // orders into "today's" header stats — always require same calendar day
  // as right now, in addition to being after openedAt.
  function isTodayAndAfterOpen(createdAt: string, openedAt: string) {
    // A shift's real boundary is when it opened, not the calendar date —
    // shifts routinely close 30–60min past midnight, and a same-day check
    // would wrongly drop pre-midnight orders from the live view the moment
    // the clock ticks over, right when staff are trying to count the
    // drawer. Real filtering by calendar day only matters for the
    // *saved* ShiftReport's dayKey, which is handled server-side.
    return new Date(createdAt) >= new Date(openedAt);
  }

  const activeOrders = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  );
  const doneOrders = !shopOpenedAt
    ? []
    : orders.filter(
        (o) =>
          (o.status === "completed" || o.status === "cancelled") &&
          isTodayAndAfterOpen(o.createdAt, shopOpenedAt),
      );

  // If we're closed and already filed today's report, show that —
  // don't let the header drop to 0 just because orders got archived.
  const todayCalKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todaysClosedReport = !shiftDate
    ? dailyReports.find((r) => r.dayKey === todayCalKey)
    : null;

  const liveRevenue =
    !shiftDate || !shopOpenedAt
      ? 0
      : orders
          .filter(
            (o) =>
              o.status === "completed" &&
              isTodayAndAfterOpen(o.createdAt, shopOpenedAt),
          )
          .reduce((s, o) => s + o.total, 0);
  const revenue = todaysClosedReport ? todaysClosedReport.revenue : liveRevenue;
  const totalOrdersCount = todaysClosedReport
    ? todaysClosedReport.totalOrders
    : !shiftDate || !shopOpenedAt
      ? 0
      : orders.filter((o) => isTodayAndAfterOpen(o.createdAt, shopOpenedAt))
          .length;

  const completedToday = !shopOpenedAt
    ? []
    : orders.filter(
        (o) =>
          o.status === "completed" &&
          isTodayAndAfterOpen(o.createdAt, shopOpenedAt),
      );
  const todayCost = completedToday.reduce((s, o) => {
    return (
      s +
      o.items.reduce((is, it) => {
        const mi = menuItems.find(
          (m) =>
            it.name === m.name ||
            it.name.toLowerCase().startsWith(m.name.toLowerCase()),
        );
        return is + (mi?.cost || 0) * it.quantity;
      }, 0)
    );
  }, 0);
  const todayProfit = revenue - todayCost;
  const todayMargin = revenue > 0 ? (todayProfit / revenue) * 100 : 0;
  const hasCosts = menuItems.some((m) => (m.cost || 0) > 0);

  const ALL_TABS: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    {
      id: "orders",
      label: "Orders",
      icon: <Package size={15} />,
    },
    { id: "crew", label: "Crew", icon: <Zap size={15} /> },
    {
      id: "discounts",
      label: "Discounts",
      icon: <DollarSign size={15} />,
      adminOnly: true,
    },
    {
      id: "menu",
      label: "Menu",
      icon: <UtensilsCrossed size={15} />,
      adminOnly: true,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <BarChart3 size={15} />,
      adminOnly: true,
    },
    {
      id: "board",
      label: "Board",
      icon: <Newspaper size={15} />,
      adminOnly: true,
    },
    {
      id: "vouchers",
      label: "Vouchers",
      icon: <QrCode size={15} />,
      adminOnly: true,
    },
    {
      id: "accounts",
      label: "Accounts",
      icon: <Users size={15} />,
      adminOnly: true,
    },
  ];
  const TABS = isAdmin ? ALL_TABS : ALL_TABS.filter((t) => !t.adminOnly);

  return (
    <div style={{ minHeight: "100svh", background: "#0a0f0a", color: T.cream }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}body{background:#0a0f0a;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:99px;}
        input,textarea{color:${T.cream}!important;}
        input::placeholder,textarea::placeholder{color:${T.faint}!important;}
        input:focus,textarea:focus{outline:none;border-color:${T.gold}!important;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number]{-moz-appearance:textfield;}
        .crew-item-card{transition:border-color .15s;}
        .crew-item-card:hover{border-color:${T.borderH} !important;}
        .stat-card{transition:border-color .2s;}
        .stat-card:hover{border-color:${T.borderH} !important;}
        .order-card{transition:border-color .2s;}
        .order-card:hover{border-color:${T.borderH} !important;}
       .account-row{transition:border-color .2s;}
        .account-row:hover{border-color:${T.borderH} !important;}
        @keyframes spin{to{transform:rotate(360deg);}}

        /* ── RESPONSIVE ─────────────────────────── */
        /* tiny phones ≤ 380px */
        @media(max-width:380px){
          .modal-inner{padding:16px 14px!important;}
          .modal-inner h2{font-size:1.05rem!important;}
        }
        /* landscape phones — modals overflow the short viewport */
        @media(orientation:landscape)and(max-height:520px){
          .modal-inner{
            padding:12px 18px!important;
            max-height:94svh!important;
            overflow-y:auto!important;
            border-radius:12px!important;
          }
          .dash-map{height:150px!important;}
          .dash-content{padding:10px 12px!important;}
        }
        /* tablet portrait 641 – 1024px */
        @media(min-width:641px)and(max-width:1024px){
          .dash-content{padding:18px 14px!important;}
        }`}</style>

      <header
        style={{
          borderBottom: `1px solid ${T.border}`,
          padding: isMobile ? "0 14px" : "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(10,15,10,0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 200,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 8 : 14,
          }}
        >
          <span
            style={{
              fontFamily: "'Cinzel',serif",
              fontSize: isMobile ? 14 : 16,
              fontWeight: 700,
              color: T.cream,
              letterSpacing: ".15em",
            }}
          >
            3RD SPACE
          </span>
          <div
            style={{
              background: isAdmin
                ? "rgba(212,168,67,0.12)"
                : "rgba(91,155,213,0.12)",
              border: `1px solid ${isAdmin ? "rgba(212,168,67,0.3)" : "rgba(91,155,213,0.3)"}`,
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: 10,
              fontWeight: 700,
              color: isAdmin ? T.gold : T.blue,
              letterSpacing: ".08em",
              fontFamily: "'Cinzel',serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {isAdmin ? (
              <>
                <Shield size={10} /> ADMIN
              </>
            ) : (
              <>
                <Users size={10} />{" "}
                {isMobile ? staffName.split(" ")[0] : staffName}
              </>
            )}
          </div>
          {activeOrders.length > 0 && (
            <div
              style={{
                background: T.gold,
                color: "#0a0f0a",
                borderRadius: 999,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'Cinzel',serif",
              }}
            >
              {activeOrders.length}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Status pill — shows current state, not clickable */}
              <span
                style={{
                  display: isMobile ? "none" : "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: ".08em",
                  background: shopOpen
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(248,113,113,0.12)",
                  border: `1px solid ${shopOpen ? "rgba(34,197,94,0.35)" : "rgba(248,113,113,0.35)"}`,
                  color: shopOpen ? T.green : "#f87171",
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: shopOpen ? T.green : "#f87171",
                    boxShadow: shopOpen
                      ? "0 0 6px rgba(34,197,94,0.8)"
                      : "0 0 6px rgba(248,113,113,0.8)",
                    flexShrink: 0,
                  }}
                />
                {shopOpen ? `${shiftLabel} · OPEN` : "STORE CLOSED"}
              </span>

              {/* Action button — always shows what clicking will DO */}
              <button
                onClick={() => {
                  if (shopToggling) return;
                  const next = !shopOpen;
                  if (shopOpen) {
                    fetchLiveCashLog();
                    setShowShiftOptions(true);
                  } else {
                    setShowOpenShiftModal(true);
                  }
                }}
                style={{
                  padding: "7px 13px",
                  background: shopOpen
                    ? "rgba(245,158,11,0.12)"
                    : "rgba(34,197,94,0.12)",
                  border: `1px solid ${shopOpen ? "rgba(245,158,11,0.45)" : "rgba(34,197,94,0.45)"}`,
                  borderRadius: 8,
                  color: shopOpen ? "#f59e0b" : T.green,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: ".06em",
                  cursor: shopToggling ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {shopToggling ? (
                  "…"
                ) : shopOpen ? (
                  <>
                    {isMobile ? (
                      <PowerOff size={14} />
                    ) : (
                      <>
                        <PowerOff size={12} /> CLOSE STORE
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {isMobile ? (
                      <Power size={14} />
                    ) : (
                      <>
                        <Power size={12} /> OPEN STORE
                      </>
                    )}
                  </>
                )}
              </button>
              {shopOpen && (
                <button
                  onClick={() => {
                    fetchLiveCashLog();
                    setShowCashLog(true);
                  }}
                  style={{
                    padding: "7px 13px",
                    background: "rgba(91,155,213,0.1)",
                    border: "1px solid rgba(91,155,213,0.35)",
                    borderRadius: 8,
                    color: T.blue,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "'Cinzel',serif",
                    letterSpacing: ".06em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Banknote size={12} />
                  {!isMobile && " CASH MGMT"}
                </button>
              )}
              {/* {isAdmin && (
                <button
                  onClick={async () => {
                    await fetch("/api/debug/reset-shift", { method: "POST" });
                    setShopOpen(false);
                    setShiftDate(null);
                    setShopOpenedAt(null);
                    showToast("Shift reset — ready to test again");
                  }}
                  style={{
                    padding: "7px 13px",
                    background: "rgba(168,85,247,0.12)",
                    border: "1px solid rgba(168,85,247,0.45)",
                    borderRadius: 8,
                    color: T.purple,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "'Cinzel',serif",
                    letterSpacing: ".06em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  🧪 RESET SHIFT
                </button>
              )} */}
            </div>
          )}
          {!isMobile && (
            <button
              onClick={() => fetchData()}
              style={{
                padding: "7px 14px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.muted,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          )}
          {isAdmin && !isMobile && (
            <button
              onClick={async () => {
                if (
                  !confirm(
                    "Wipe ALL orders and reports? This cannot be undone.",
                  )
                )
                  return;
                await fetch("/api/debug/wipe-data", { method: "POST" });
                setOrders([]);
                setDailyReports([]);
                setShiftReports([]);
                setShiftDate(null);
                setShopOpenedAt(null);
                setShopOpen(false);
                showToast("All data wiped ✓ — please reopen the store");
              }}
              style={{
                padding: "7px 13px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                color: T.red,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'Cinzel',serif",
                letterSpacing: ".06em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Trash2 size={12} /> WIPE DATA
            </button>
          )}
          <button
            onClick={logout}
            style={{
              padding: "7px 12px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.muted,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <LogOut size={13} />
            {!isMobile && " Logout"}
          </button>
        </div>
      </header>

      <div
        className="dash-content"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: isSmall ? "12px 10px" : isMobile ? "16px 12px" : "24px 20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill,minmax(${isSmall ? "120px" : isMobile ? "140px" : "180px"},1fr))`,
            gap: isMobile ? 8 : 12,
            marginBottom: isMobile ? 16 : 24,
          }}
        >
          <StatCard
            label="Active Orders"
            value={String(activeOrders.length)}
            icon={<Package size={20} />}
          />
          <StatCard
            label="Total Orders"
            value={String(totalOrdersCount)}
            icon={<Clock size={20} />}
          />
          {isAdmin && (
            <StatCard
              label="Revenue"
              value={fmt(revenue)}
              icon={<DollarSign size={20} />}
            />
          )}

          {isAdmin && (
            <StatCard
              label="Menu Items"
              value={String(menuItems.length)}
              icon={<UtensilsCrossed size={20} />}
            />
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: isMobile ? 4 : 6,
            marginBottom: isMobile ? 16 : 22,
            borderBottom: `1px solid ${T.border}`,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {TABS.map((t) => {
            const a = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 5 : 7,
                  padding: isMobile ? "9px 12px" : "10px 18px",
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  background: a ? "rgba(212,168,67,0.1)" : "transparent",
                  borderTop: a
                    ? `1px solid ${T.borderH}`
                    : "1px solid transparent",
                  borderLeft: a
                    ? `1px solid ${T.borderH}`
                    : "1px solid transparent",
                  borderRight: a
                    ? `1px solid ${T.borderH}`
                    : "1px solid transparent",
                  borderBottom: "none",
                  color: a ? T.gold : T.muted,
                  fontFamily: "'Cinzel',serif",
                  fontSize: isMobile ? 10 : 11,
                  letterSpacing: ".1em",
                  fontWeight: a ? 700 : 400,
                  transition: "all .15s",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.icon}
                {!isSmall && (
                  <span style={{ marginLeft: isSmall ? 0 : 5 }}>
                    {t.label.toUpperCase()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: T.muted,
            }}
          >
            <RefreshCw
              size={24}
              style={{ margin: "0 auto 12px", opacity: 0.5 }}
            />
            <p>Loading...</p>
          </div>
        ) : tab === "orders" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p
                style={{
                  color: T.gold,
                  fontSize: 11,
                  letterSpacing: ".15em",
                  textTransform: "uppercase",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 12,
                }}
              >
                ◆Active — {activeOrders.length}
              </p>
              {/* Table grouping indicator */}
              {(() => {
                const tableMap: Record<string, number> = {};
                activeOrders.forEach((o) => {
                  if (o.tableNumber)
                    tableMap[o.tableNumber] =
                      (tableMap[o.tableNumber] || 0) + 1;
                });
                const sharedTables = Object.entries(tableMap).filter(
                  ([, count]) => count > 1,
                );
                if (sharedTables.length === 0) return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    {sharedTables.map(([table, count]) => (
                      <div
                        key={table}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 12px",
                          background: "rgba(248,113,113,0.08)",
                          border: "1px solid rgba(248,113,113,0.3)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#f87171",
                          fontWeight: 600,
                        }}
                      >
                        <Users size={13} /> Table {table} — {count} groups
                      </div>
                    ))}
                  </div>
                );
              })()}
              {activeOrders.length === 0 ? (
                <div
                  style={{
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    padding: "32px 20px",
                    textAlign: "center",
                    color: T.faint,
                  }}
                >
                  <Package
                    size={28}
                    style={{ margin: "0 auto 8px", opacity: 0.3 }}
                  />
                  <p style={{ fontSize: 13 }}>No active orders right now</p>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {activeOrders.map((o) => (
                    <OrderCard
                      key={o._id}
                      order={o}
                      menuItems={menuItems}
                      onStatusChange={updateStatus}
                      onPaymentConfirm={confirmPayment}
                      onCashConfirm={confirmCashPayment}
                      onSetPaymentMethod={setPaymentMethod}
                      onAdjustSplit={adjustSplitPayment}
                      onDelete={deleteOrder}
                      onItemsUpdate={updateItems}
                      onApplyItemDiscount={applyItemDiscount}
                      onRemoveItemDiscount={removeItemDiscount}
                      discounts={discounts}
                      staffName={staffName}
                    />
                  ))}
                </div>
              )}
            </div>
            {doneOrders.length > 0 && (
              <div>
                <p
                  style={{
                    color: T.muted,
                    fontSize: 11,
                    letterSpacing: ".15em",
                    textTransform: "uppercase",
                    fontFamily: "'Cinzel',serif",
                    marginBottom: 12,
                    marginTop: 8,
                  }}
                >
                  ◆Completed & Cancelled — {doneOrders.length}
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {doneOrders.map((o) => (
                    <OrderCard
                      key={o._id}
                      order={o}
                      menuItems={menuItems}
                      onStatusChange={updateStatus}
                      onPaymentConfirm={confirmPayment}
                      onCashConfirm={confirmCashPayment}
                      onSetPaymentMethod={setPaymentMethod}
                      onAdjustSplit={adjustSplitPayment}
                      onDelete={deleteOrder}
                      onItemsUpdate={updateItems}
                      onApplyItemDiscount={applyItemDiscount}
                      onRemoveItemDiscount={removeItemDiscount}
                      discounts={discounts}
                      staffName={staffName}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : tab === "crew" ? (
          <CrewTab
            menuItems={menuItems}
            onOrderPlaced={fetchData}
            staffName={staffName}
            discounts={discounts}
          />
        ) : tab === "menu" ? (
          <MenuTab items={menuItems} onRefresh={() => fetchData(true)} />
        ) : tab === "analytics" ? (
          <AnalyticsTab
            orders={orders}
            dailyReports={dailyReports}
            activeShiftDate={shiftDate}
            menuItems={menuItems}
            shiftReports={shiftReports}
            currentShiftLabel={shiftLabel}
            activeShiftOpenedAt={shopOpenedAt}
            shiftStartingCash={shiftStartingCash}
            liveCashLog={liveCashLog}
            cashDataLoaded={cashDataLoaded}
          />
        ) : tab === "board" ? (
          <BoardTab posts={posts} setPosts={setPosts} />
        ) : tab === "vouchers" ? (
          <VouchersAdminTab />
        ) : tab === "discounts" ? (
          <DiscountsAdminTab
            discounts={discounts}
            setDiscounts={setDiscounts}
          />
        ) : (
          <AccountsTab />
        )}
      </div>

      {showShiftOptions && (
        <div
          onClick={() => setShowShiftOptions(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-inner"
            style={{
              background: "#13180f",
              border: `1px solid ${T.borderH}`,
              borderRadius: 18,
              padding: "28px 24px",
              maxWidth: 360,
              width: "100%",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <PowerOff
                size={32}
                color={T.gold}
                style={{ margin: "0 auto 8px" }}
              />
              <p
                style={{
                  fontFamily: "'Cinzel',serif",
                  color: T.cream,
                  fontSize: 14,
                  letterSpacing: ".1em",
                  marginBottom: 2,
                }}
              >
                CLOSE SHIFT
              </p>
              <p style={{ color: T.muted, fontSize: 12 }}>
                Current: <strong style={{ color: T.gold }}>{shiftLabel}</strong>
              </p>
            </div>
            <button
              onClick={() => {
                setShowShiftOptions(false);
                setShowHandoverFlow(true);
              }}
              style={{
                width: "100%",
                padding: "14px",
                background: "rgba(212,168,67,0.12)",
                border: `1px solid ${T.borderH}`,
                borderRadius: 10,
                color: T.gold,
                fontFamily: "'Cinzel',serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: ".08em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <RefreshCw size={14} /> HAND OVER TO NEXT SHIFT
            </button>
            <button
              onClick={() => {
                setShowShiftOptions(false);
                setShowCloseShiftModal(true);
              }}
              style={{
                width: "100%",
                padding: "14px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 10,
                color: T.red,
                fontFamily: "'Cinzel',serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: ".08em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <PowerOff size={14} /> END OF DAY
            </button>
            <button
              onClick={() => setShowShiftOptions(false)}
              style={{
                padding: "10px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                color: T.muted,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {showHandoverFlow && (
        <ShiftHandoverModal
          currentShiftLabel={shiftLabel}
          nextShiftLabel={`Shift ${parseInt(shiftLabel.replace(/\D/g, "") || "1") + 1}`}
          cashRevThisShift={orders
            .filter(
              (o) =>
                o.paymentStatus === "confirmed" &&
                o.status !== "cancelled" &&
                shopOpenedAt &&
                isTodayAndAfterOpen(o.createdAt, shopOpenedAt),
            )
            .reduce((s, o) => {
              if (o.paymentMethod === "cash") return s + o.total;
              if (o.paymentMethod === "split") return s + (o.cashAmount ?? 0);
              return s;
            }, 0)}
          startingCash={shiftStartingCash}
          onConfirm={(countedCash, nextLabel, nextCash) =>
            handoverShift(countedCash, nextLabel, nextCash)
          }
          onCancel={() => setShowHandoverFlow(false)}
        />
      )}
      {showCashLog && (
        <CashLogModal
          onClose={() => setShowCashLog(false)}
          staffName={staffName}
          onLogged={(type, amount) => {
            showToast(
              type === "in"
                ? `✓ Paid In logged: ${fmt(amount)}`
                : `✓ Paid Out logged: ${fmt(amount)}`,
            );
            fetchLiveCashLog();
          }}
        />
      )}
      {showOpenShiftModal && (
        <OpenShiftModal
          defaultLabel={shiftLabel}
          onConfirm={(startingCash, label) => {
            setShowOpenShiftModal(false);
            toggleShop(true, { startingCash, shiftLabel: label });
          }}
          onCancel={() => setShowOpenShiftModal(false)}
        />
      )}
      {showCloseShiftModal && (
        <CloseShiftModal
          cashRevToday={orders
            .filter(
              (o) =>
                o.status === "completed" &&
                shopOpenedAt &&
                isTodayAndAfterOpen(o.createdAt, shopOpenedAt),
            )
            .reduce((s, o) => {
              if (o.paymentMethod === "cash") return s + o.total;
              if (o.paymentMethod === "split") return s + (o.cashAmount ?? 0);
              return s;
            }, 0)}
          onConfirm={(countedCash) => {
            setShowCloseShiftModal(false);
            toggleShop(false, { countedCash });
          }}
          onCancel={() => setShowCloseShiftModal(false)}
        />
      )}
      {confirmPauseShop && (
        <ConfirmModal
          danger={false}
          message={`Close the store for ${shiftDate ?? "today"}? This will save today's report and archive all orders.`}
          onConfirm={() => {
            setConfirmPauseShop(false);
            toggleShop(false);
          }}
          onCancel={() => setConfirmPauseShop(false)}
        />
      )}
      {confirmClose && (
        <ConfirmModal
          danger={false}
          message={`Close the day for ${shiftDate}? This will archive all orders and save the daily report. This cannot be undone.`}
          onConfirm={async () => {
            setConfirmClose(false);
            try {
              const res = await fetch("/api/daily-close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ openedAt: shopOpenedAt }),
              });
              if (res.ok) {
                showToast("Day closed and report saved ✓");
                setShiftDate(null);
                fetchData();
              } else {
                const data = await res.json();
                showToast(data.error || "Failed to close day", false);
              }
            } catch {
              showToast("Failed to close day", false);
            }
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      {activeConfirm?.type === "order" && (
        <ConfirmModal
          message="Delete this order? This cannot be undone."
          onConfirm={async () => {
            const id = activeConfirm.id;
            setActiveConfirm(null);
            try {
              const res = await fetch(`/api/orders/${id}`, {
                method: "DELETE",
              });
              if (!res.ok) throw new Error();
              setOrders((p) => p.filter((o) => o._id !== id));
              showToast("Order deleted");
            } catch {
              showToast("Failed to delete order", false);
            }
          }}
          onCancel={() => setActiveConfirm(null)}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: toast.ok
              ? "rgba(34,197,94,0.12)"
              : "rgba(239,68,68,0.12)",
            border: `1px solid ${toast.ok ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.ok ? T.green : T.red,
            borderRadius: 12,
            padding: "12px 28px",
            fontSize: 13,
            fontWeight: 600,
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}