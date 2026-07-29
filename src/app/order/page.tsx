"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { compressImage } from "@/lib/compressImage";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronLeft,
  Upload,
  Check,
  X,
  Smartphone,
  Banknote,
  MapPin,
  Clock,
  ArrowRight,
  Receipt,
  Search,
  Navigation,
  Edit3,
  AlertCircle,
  HelpCircle,
  Armchair,
  Users,
  CheckCircle2,
  Bike,
  Radio,
  Leaf,
  Coffee,
} from "lucide-react";

/* ─── TOKENS ──────────────────────────────────────────────────────────────── */
const G = "#d4a843";
const GD = "rgba(212,168,67,0.13)";
const C = "#e8d5a3";
const CM = "rgba(232,213,163,0.5)";
const CF = "rgba(232,213,163,0.2)";
const BG = "#0e190e";
const CARD = "rgba(255,255,255,0.04)";
const BR = "rgba(232,213,163,0.11)";
const BRH = "rgba(212,168,67,0.45)";
const ERR = "rgba(248,113,113,0.8)";

function getDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 1) return 30;
  if (distanceKm <= 3) return 50;
  if (distanceKm <= 10) return 100;
  return 150;
}

/* ─── CUSTOMIZATION CONFIG ────────────────────────────────────────────────── */
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
type CustomizationConfig = {
  substitutions?: { label: string; price: number }[];
  baseSubs?: { label: string; price: number }[];
  addons?: { label: string; price: number }[];
  sauces?: { name: string; image: string }[];
  eggStyles?: { name: string; image: string }[];
};
function getCategoryCustomizations(
  category: string,
  liveSauces?: { name: string; image: string }[],
  liveEggStyles?: { name: string; image: string }[],
  itemName?: string,
  liveMilkSubs?: { label: string; price: number }[],
  liveBaseSubs?: { label: string; price: number }[],
): CustomizationConfig | null {
  const c = category.toLowerCase().trim();
  const n = (itemName || "").toLowerCase();

  // "Substitutions" menu items (e.g. "Oatmilk Substitution", "Matcha
  // Substitution") are the source of truth when they exist — hiding one
  // in the admin Menu tab hides it here too. undefined (no such items
  // created yet) falls back to the old hardcoded lists.
  const effMilk: { label: string; price: number }[] =
    liveMilkSubs !== undefined
      ? [{ label: "Regular Milk", price: 0 }, ...liveMilkSubs]
      : MILK_SUBS;
  const effBase: { label: string; price: number }[] =
    liveBaseSubs !== undefined
      ? [{ label: "Coffee", price: 0 }, ...liveBaseSubs]
      : BASE_SUBS;

  // Americano: no milk sub, just drink add-ons
  if (n.includes("americano")) return { addons: DRINK_ADDONS };
  // Orange drinks: no milk sub
  if (n.includes("orange")) return { addons: DRINK_ADDONS };

  if (c.includes("3rd space"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  if (c.includes("appetizer") || c.includes("snack"))
    return {
      sauces:
        liveSauces !== undefined
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
  if (c.includes("brain fuel")) return { addons: DRINK_ADDONS };
  if (c.includes("oat")) return { addons: DRINK_ADDONS };
  if (c.includes("coffee"))
    return {
      substitutions: effMilk,
      baseSubs: effBase,
      addons: DRINK_ADDONS,
    };
  if (c.includes("flavored soda")) return { addons: DRINK_ADDONS };
  if (c.includes("house plate"))
    return {
      addons: [
        { label: "Add Rice", price: 25 },
        { label: "Add Egg", price: 15 },
      ],
    };
  if (c.includes("matcha"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  if (c.includes("non"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  if (c.includes("noodle") || c.includes("soup"))
    return {
      addons: [
        { label: "Add Egg", price: 15 },
        { label: "Add Extra Toppings", price: 25 },
      ],
    };
  if (c.includes("pasta"))
    return { addons: [{ label: "Add Rice", price: 25 }] };
  if (c.includes("savory"))
    return {
      eggStyles:
        liveEggStyles !== undefined
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
  if (c.includes("tea"))
    return { substitutions: effMilk, addons: DRINK_ADDONS };
  return null;
}

/* ─── TYPES ───────────────────────────────────────────────────────────────── */
interface OptionChoice {
  label: string;
  price: number;
}
interface OptionGroup {
  name: string;
  type: "single" | "multi";
  required?: boolean;
  max?: number;
  choices: OptionChoice[];
}
interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
  variants?: string[];
  options?: OptionGroup[];
}
interface SelectedCustomization {
  type: string;
  label: string;
  price: number;
}
interface CartItem extends MenuItem {
  quantity: number;
  cartKey: string;
  customizations: SelectedCustomization[];
}
type OrderType = "dine-in" | "delivery" | "takeout";
interface Order {
  orderNumber: string;
  type: OrderType;
}
type PayMethod = "cash" | "gcash" | "split";
type Step = "mode-select" | "menu" | "checkout" | "payment" | "confirmed";

/* ─── PH PHONE HELPERS ────────────────────────────────────────────────────── */
function normalizePHPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("63") && d.length > 10) d = d.slice(2); // strip +63
  if (d.startsWith("0")) d = d.slice(1); // strip leading 0
  return d.slice(0, 10); // cap at 10
}

function isValidPHPhone(v: string) {
  return /^9\d{9}$/.test(v); // exactly 10 digits starting with 9
}

function formatPHPhoneDisplay(stored: string): string {
  // stored is always 9XXXXXXXXX (10 digits)
  if (stored.length <= 3) return stored;
  if (stored.length <= 6) return `${stored.slice(0, 3)} ${stored.slice(3)}`;
  return `${stored.slice(0, 3)} ${stored.slice(3, 6)} ${stored.slice(6)}`;
}

/* ─── TOP NAV ─────────────────────────────────────────────────────────────── */
function TopNav({
  cartCount,
  cartTotal,
  onCartOpen,
}: {
  cartCount: number;
  cartTotal: number;
  onCartOpen: () => void;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: `${BG}ee`,
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${BR}`,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(12px,4vw,20px)",
      }}
    >
      <a href="/" style={{ display: "flex", alignItems: "center" }}>
        <img
          src="/logo.png"
          alt="3rd Space"
          style={{ height: 34, width: "auto", objectFit: "contain" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </a>
      <button
        onClick={onCartOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: cartCount > 0 ? G : CARD,
          border: `1px solid ${cartCount > 0 ? G : BR}`,
          borderRadius: 999,
          padding: "7px 14px",
          cursor: "pointer",
          transition: "all .2s",
          color: cartCount > 0 ? BG : C,
          minHeight: 40,
          touchAction: "manipulation",
        }}
      >
        <ShoppingCart size={15} />
        {cartCount > 0 ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{cartCount}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              · ₱{cartTotal.toFixed(0)}
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: 12,
              letterSpacing: ".06em",
              fontFamily: "'Cinzel',serif",
            }}
          >
            CART
          </span>
        )}
      </button>
    </header>
  );
}

function PlainHeader({ label }: { label: string }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: `${BG}ee`,
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${BR}`,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(12px,4vw,20px)",
      }}
    >
      <img
        src="/logo.png"
        alt="3rd Space"
        style={{ height: 34, objectFit: "contain" }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <span
        style={{
          fontFamily: "'Cinzel',serif",
          fontSize: 12,
          letterSpacing: ".18em",
          color: CM,
        }}
      >
        {label}
      </span>
    </header>
  );
}

function SubBar({
  onClick,
  label = "Back",
}: {
  onClick: () => void;
  label?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px clamp(12px,4vw,20px) 6px",
      }}
    >
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          color: hov ? G : CM,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 11,
          letterSpacing: ".1em",
          fontFamily: "'Cinzel',serif",
          padding: 0,
          transition: "color .18s",
          minHeight: 36,
          touchAction: "manipulation",
        }}
      >
        <ChevronLeft size={13} />
        {label.toUpperCase()}
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: CM,
        fontSize: 10,
        letterSpacing: ".14em",
        marginBottom: 10,
        fontFamily: "'Cinzel',serif",
      }}
    >
      {children as string}
    </p>
  );
}

/* ─── CUSTOMIZATION SHEET ─────────────────────────────────────────────────── */
function CustomizationSheet({
  item,
  config,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  config: CustomizationConfig;
  onAdd: (customizations: SelectedCustomization[]) => void;
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

  const extraCost =
    (config.substitutions?.find((s) => s.label === selectedSub)?.price || 0) +
    (config.baseSubs?.find((s) => s.label === selectedBase)?.price || 0) +
    Array.from(selectedAddons).reduce((sum, lbl) => {
      return sum + (config.addons?.find((a) => a.label === lbl)?.price || 0);
    }, 0);

  const handleAdd = () => {
    const result: SelectedCustomization[] = [];
    if (config.substitutions) {
      const sub = config.substitutions.find((s) => s.label === selectedSub);
      if (sub) result.push({ type: "Milk", ...sub });
    }
    if (config.baseSubs) {
      const base = config.baseSubs.find((s) => s.label === selectedBase);
      if (base) result.push({ type: "Base", ...base });
    }
    if (config.eggStyles && selectedEggStyle) {
      result.push({ type: "Egg Style", label: selectedEggStyle, price: 0 });
    }
    selectedSauces.forEach((lbl) => {
      result.push({ type: "Sauce", label: lbl, price: 0 });
    });
    selectedAddons.forEach((lbl) => {
      const a = config.addons?.find((x) => x.label === lbl);
      if (a) result.push({ type: "Add-On", ...a });
    });
    onAdd(result);
  };

  const toggleAddon = (lbl: string) =>
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      next.has(lbl) ? next.delete(lbl) : next.add(lbl);
      return next;
    });

  // Sauce is required whenever this item offers a sauce choice — mirrors
  // the "single = required" rule GenericOptionsSheet already uses for
  // items with their own saved options, so behavior is consistent whether
  // or not the item has custom options saved.
  const canAdd = !config.sauces || selectedSauces.size > 0;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.6)",
          backdropFilter: "blur(4px)",
          zIndex: 60,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#111e11",
          borderTop: `1px solid ${BR}`,
          borderRadius: "20px 20px 0 0",
          zIndex: 61,
          padding: "0 0 env(safe-area-inset-bottom,0)",
          maxHeight: "85svh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0 4px",
          }}
        >
          <div
            style={{ width: 36, height: 4, borderRadius: 999, background: BR }}
          />
        </div>
        {/* Header */}
        <div
          style={{
            padding: "0 clamp(16px,4vw,20px) 14px",
            borderBottom: `1px solid ${BR}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 15,
                fontWeight: 700,
                color: C,
                letterSpacing: ".04em",
              }}
            >
              {item.name}
            </p>
            <p
              style={{
                color: G,
                fontFamily: "'Cinzel',serif",
                fontSize: 14,
                marginTop: 2,
              }}
            >
              ₱{item.price}
              {extraCost > 0 && (
                <span style={{ color: CM, fontSize: 12 }}> + ₱{extraCost}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: CARD,
              border: `1px solid ${BR}`,
              borderRadius: 999,
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: CM,
              flexShrink: 0,
              marginLeft: 12,
              touchAction: "manipulation",
            }}
          >
            <X size={13} />
          </button>
        </div>
        {/* Options */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px clamp(16px,4vw,20px)",
          }}
        >
          {config.substitutions && (
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  color: CM,
                  fontSize: 10,
                  letterSpacing: ".14em",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 10,
                }}
              >
                MILK
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {config.substitutions.map((s) => {
                  const sel = selectedSub === s.label;
                  return (
                    <button
                      key={s.label}
                      onClick={() => setSelectedSub(s.label)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${sel ? G : BR}`,
                        background: sel ? GD : "transparent",
                        cursor: "pointer",
                        touchAction: "manipulation",
                        transition: "all .15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            border: `2px solid ${sel ? G : CM}`,
                            background: sel ? G : "transparent",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {sel && (
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: BG,
                              }}
                            />
                          )}
                        </div>
                        <span style={{ color: sel ? C : CM, fontSize: 13 }}>
                          {s.label}
                        </span>
                      </div>
                      <span
                        style={{
                          color: s.price > 0 ? G : CF,
                          fontSize: 12,
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        {s.price > 0 ? `+₱${s.price}` : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {config.baseSubs && (
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  color: CM,
                  fontSize: 10,
                  letterSpacing: ".14em",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 10,
                }}
              >
                BASE
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {config.baseSubs.map((s) => {
                  const sel = selectedBase === s.label;
                  return (
                    <button
                      key={s.label}
                      onClick={() => setSelectedBase(s.label)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${sel ? G : BR}`,
                        background: sel ? GD : "transparent",
                        cursor: "pointer",
                        touchAction: "manipulation",
                        transition: "all .15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            border: `2px solid ${sel ? G : CM}`,
                            background: sel ? G : "transparent",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {sel && (
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: BG,
                              }}
                            />
                          )}
                        </div>
                        <span style={{ color: sel ? C : CM, fontSize: 13 }}>
                          {s.label}
                        </span>
                      </div>
                      <span
                        style={{
                          color: s.price > 0 ? G : CF,
                          fontSize: 12,
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        {s.price > 0 ? `+₱${s.price}` : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {config.eggStyles && (
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  color: CM,
                  fontSize: 10,
                  letterSpacing: ".14em",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 10,
                }}
              >
                EGG STYLE
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {config.eggStyles.map((style) => {
                  const sel = selectedEggStyle === style.name;
                  return (
                    <button
                      key={style.name}
                      onClick={() => setSelectedEggStyle(style.name)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${sel ? G : BR}`,
                        background: sel ? GD : "transparent",
                        cursor: "pointer",
                        touchAction: "manipulation",
                        transition: "all .15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            border: `2px solid ${sel ? G : CM}`,
                            background: sel ? G : "transparent",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {sel && (
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: BG,
                              }}
                            />
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {style.image && (
                            <img
                              src={style.image}
                              alt={style.name}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                objectFit: "cover",
                                border: `1px solid ${sel ? G : BR}`,
                              }}
                            />
                          )}
                          <span style={{ color: sel ? C : CM, fontSize: 13 }}>
                            {style.name}
                          </span>
                        </div>
                      </div>
                      <span
                        style={{
                          color: CF,
                          fontSize: 12,
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        Free
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {config.sauces && (
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  color: CM,
                  fontSize: 10,
                  letterSpacing: ".14em",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 10,
                }}
              >
                CHOOSE YOUR SAUCE — REQUIRED · MAX 1 (FREE)
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: 8,
                }}
              >
                {config.sauces.map((sauce) => {
                  const sauceName = sauce.name;
                  const sel = selectedSauces.has(sauceName);
                  return (
                    <button
                      key={sauceName}
                      onClick={() =>
                        setSelectedSauces((prev) =>
                          prev.has(sauceName)
                            ? new Set()
                            : new Set([sauceName]),
                        )
                      }
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        padding: "10px 6px",
                        borderRadius: 12,
                        border: `1.5px solid ${sel ? G : BR}`,
                        background: sel ? GD : "transparent",
                        cursor: "pointer",
                        touchAction: "manipulation",
                        transition: "all .15s",
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 10,
                          overflow: "hidden",
                          border: `1px solid ${sel ? G : BR}`,
                          background: "rgba(212,168,67,.05)",
                        }}
                      >
                        <img
                          src={
                            sauce.image ||
                            `/menu/sauces/${encodeURIComponent(sauceName)}.png`
                          }
                          alt={sauceName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                      <span
                        style={{
                          color: sel ? C : CM,
                          fontSize: 10,
                          textAlign: "center",
                          lineHeight: 1.3,
                          letterSpacing: ".02em",
                        }}
                      >
                        {sauceName}
                      </span>
                      {sel && <Check size={11} color={G} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {config.addons && (
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  color: CM,
                  fontSize: 10,
                  letterSpacing: ".14em",
                  fontFamily: "'Cinzel',serif",
                  marginBottom: 10,
                }}
              >
                ADD-ONS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {config.addons.map((a) => {
                  const sel = selectedAddons.has(a.label);
                  return (
                    <button
                      key={a.label}
                      onClick={() => toggleAddon(a.label)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${sel ? G : BR}`,
                        background: sel ? GD : "transparent",
                        cursor: "pointer",
                        touchAction: "manipulation",
                        transition: "all .15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: `2px solid ${sel ? G : CM}`,
                            background: sel ? G : "transparent",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all .15s",
                          }}
                        >
                          {sel && <Check size={10} color={BG} />}
                        </div>
                        <span style={{ color: sel ? C : CM, fontSize: 13 }}>
                          {a.label}
                        </span>
                      </div>
                      <span
                        style={{
                          color: G,
                          fontSize: 12,
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        +₱{a.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* CTA */}
        <div
          style={{
            padding: "12px clamp(16px,4vw,20px) 16px",
            borderTop: `1px solid ${BR}`,
          }}
        >
          <button
            onClick={() => canAdd && handleAdd()}
            disabled={!canAdd}
            style={{
              width: "100%",
              background: canAdd ? G : "rgba(212,168,67,0.25)",
              color: canAdd ? BG : CM,
              border: "none",
              borderRadius: 12,
              padding: "15px 16px",
              fontFamily: "'Cinzel',serif",
              fontSize: 13,
              letterSpacing: ".12em",
              fontWeight: 700,
              cursor: canAdd ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              touchAction: "manipulation",
            }}
          >
            <span>ADD TO CART</span>
            <span>₱{item.price + extraCost}</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── MODE SELECT ─────────────────────────────────────────────────────────── */
function ModeCard({ emoji, title, sub, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="mode-card"
      style={{
        background: CARD,
        border: `1.5px solid ${BR}`,
        borderRadius: 20,
        padding: "clamp(24px,5vw,38px) 20px",
        cursor: "pointer",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        outline: "none",
        touchAction: "manipulation",
        width: "100%",
      }}
    >
      <div
        style={{
          fontSize: "clamp(36px,8vw,46px)",
          marginBottom: 14,
          lineHeight: 1,
        }}
      >
        {emoji}
      </div>
      <div
        className="mode-card-title"
        style={{
          fontFamily: "'Cinzel',serif",
          fontSize: "clamp(16px,4vw,19px)",
          fontWeight: 700,
          letterSpacing: ".15em",
          color: C,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ color: CM, fontSize: "clamp(11px,2.5vw,13px)" }}>{sub}</div>
    </button>
  );
}

function ModeSelectScreen({
  onSelect,
  shopOpen,
}: {
  onSelect: (m: OrderType) => void;
  shopOpen: boolean;
}) {
  return (
    <div
      style={{
        height: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflowY: "auto",
        padding: "clamp(20px,5vw,40px) clamp(14px,4vw,24px)",
        background: `radial-gradient(ellipse at 55% 20%, rgba(212,168,67,.08) 0%, transparent 60%), ${BG}`,
      }}
    >
      <a href="/" style={{ display: "block", marginBottom: 20 }}>
        <img
          src="/logo.png"
          alt="3rd Space"
          style={{
            height: "clamp(48px,12vw,72px)",
            maxHeight: 72,
            objectFit: "contain",
            display: "block",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </a>
      {!shopOpen && (
        <div
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.4)",
            borderRadius: 12,
            padding: "12px 20px",
            marginBottom: 16,
            textAlign: "center",
            maxWidth: 520,
            width: "100%",
          }}
        >
          <p
            style={{
              color: "#f87171",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Cinzel',serif",
              letterSpacing: ".08em",
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <AlertCircle size={14} /> ORDERING IS CURRENTLY PAUSED
          </p>
          <p
            style={{
              color: "rgba(248,113,113,0.7)",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            We'll be back soon. Check back in a bit!
          </p>
        </div>
      )}
      <div
        style={{
          width: 50,
          height: 1,
          background: `linear-gradient(90deg,transparent,${G},transparent)`,
          margin: "0 auto 14px",
        }}
      />
      <p
        style={{
          color: CM,
          fontSize: "clamp(11px,2.8vw,13px)",
          letterSpacing: ".1em",
          marginBottom: 28,
          fontFamily: "'Cinzel',serif",
          textAlign: "center",
        }}
      >
        HOW WOULD YOU LIKE TO ORDER?
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
          width: "100%",
          maxWidth: 520,
          marginBottom: 28,
        }}
      >
        {[
          {
            mode: "dine-in" as OrderType,
            icon: <Armchair size={46} color={G} />,
            title: "DINE IN",
            sub: "Order at your table — pay cash or GCash",
            span: false,
          },
          {
            mode: "takeout" as OrderType,
            icon: <Coffee size={46} color={G} />,
            title: "TAKE OUT",
            sub: "Pick up at the counter — cash or GCash",
            span: false,
          },
          {
            mode: "delivery" as OrderType,
            icon: <Bike size={46} color={G} />,
            title: "DELIVERY",
            sub: "Delivered to your door — GCash only",
            span: true,
          },
        ].map(({ mode, icon, title, sub, span }) => (
          <div key={mode} style={{ gridColumn: span ? "1 / -1" : undefined }}>
            <ModeCard
              emoji={icon}
              title={title}
              sub={sub}
              onClick={() => shopOpen && onSelect(mode)}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          maxWidth: 520,
        }}
      >
        <div style={{ flex: 1, height: 1, background: BR }} />
        <a
          href="/track"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 20px",
            borderRadius: 999,
            border: `1px solid ${BR}`,
            background: CARD,
            color: CM,
            fontFamily: "'Cinzel',serif",
            fontSize: "clamp(10px,2.5vw,11px)",
            letterSpacing: ".12em",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <Radio size={12} /> TRACK AN EXISTING ORDER
        </a>
        <div style={{ flex: 1, height: 1, background: BR }} />
      </div>
    </div>
  );
}

/* ─── SMALL HELPERS ───────────────────────────────────────────────────────── */
function Btn32({ children, onClick, gold }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "none",
        background: gold ? G : "transparent",
        color: gold ? BG : C,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
      }}
    >
      {children}
    </button>
  );
}

/* ─── MENU CARD ───────────────────────────────────────────────────────────── */
function MenuCard({
  item,
  cartCount,
  onAdd,
}: {
  item: MenuItem;
  cartCount: number;
  onAdd: () => void;
}) {
  return (
    <div
      className="menu-card"
      style={{
        background: CARD,
        border: `1px solid ${BR}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "clamp(160px,28vw,200px)",
          background: "rgba(212,168,67,.07)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={item.image || undefined}
          alt={item.name}
          loading="lazy"
          className="menu-card-img"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div
        style={{
          padding:
            "clamp(8px,2.5vw,13px) clamp(10px,2.5vw,15px) clamp(10px,2.5vw,15px)",
        }}
      >
        <p
          style={{
            fontFamily: "'Cinzel',serif",
            fontSize: "clamp(12px,2.8vw,13px)",
            fontWeight: 700,
            letterSpacing: ".04em",
            color: C,
            marginBottom: 4,
          }}
        >
          {item.name}
        </p>
        <p
          style={{
            color: CM,
            fontSize: "clamp(10px,2.4vw,11px)",
            lineHeight: 1.5,
            marginBottom: 13,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.description}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "'Cinzel',serif",
              fontSize: "clamp(15px,3.5vw,17px)",
              fontWeight: 700,
              color: G,
            }}
          >
            ₱{item.price}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {cartCount > 0 && (
              <span
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 11,
                  color: G,
                  background: "rgba(212,168,67,.12)",
                  border: `1px solid rgba(212,168,67,.3)`,
                  borderRadius: 999,
                  padding: "2px 9px",
                  letterSpacing: ".04em",
                }}
              >
                {cartCount} in cart
              </span>
            )}
            <button
              onClick={onAdd}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "none",
                background: G,
                color: BG,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                touchAction: "manipulation",
                flexShrink: 0,
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CART DRAWER ─────────────────────────────────────────────────────────── */
function CartDrawer({
  cart,
  open,
  onClose,
  onUpdate,
  onRemove,
  onCheckout,
  cartTotal,
}: any) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .25s",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(100vw,400px)",
          background: "#111e11",
          borderLeft: `1px solid ${BR}`,
          zIndex: 51,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform .3s cubic-bezier(.4,0,.2,1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px clamp(14px,4vw,18px) 14px",
            borderBottom: `1px solid ${BR}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShoppingCart size={18} color={G} />
            <span
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 16,
                letterSpacing: ".15em",
                color: C,
              }}
            >
              YOUR CART
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: CARD,
              border: `1px solid ${BR}`,
              borderRadius: 999,
              width: 36,
              height: 36,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: CM,
              touchAction: "manipulation",
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "clamp(12px,3vw,16px)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 60, color: CF }}>
              <ShoppingCart
                size={34}
                style={{ margin: "0 auto 12px", opacity: 0.4 }}
              />
              <p style={{ fontSize: 13 }}>Empty cart</p>
            </div>
          ) : (
            cart.map((item: CartItem) => (
              <div
                key={item.cartKey}
                style={{
                  background: CARD,
                  border: `1px solid ${BR}`,
                  borderRadius: 12,
                  padding: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      color: C,
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </p>
                  {item.customizations && item.customizations.length > 0 && (
                    <p
                      style={{
                        color: CF,
                        fontSize: 10,
                        marginBottom: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.customizations.map((c) => c.label).join(" · ")}
                    </p>
                  )}
                  <p
                    style={{
                      color: G,
                      fontSize: 13,
                      fontFamily: "'Cinzel',serif",
                    }}
                  >
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Btn32
                    onClick={() => onUpdate(item.cartKey, item.quantity - 1)}
                  >
                    <Minus size={11} />
                  </Btn32>
                  <span
                    style={{
                      width: 20,
                      textAlign: "center",
                      color: C,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {item.quantity}
                  </span>
                  <Btn32
                    gold
                    onClick={() => onUpdate(item.cartKey, item.quantity + 1)}
                  >
                    <Plus size={11} />
                  </Btn32>
                  <button
                    onClick={() => onRemove(item.cartKey)}
                    style={{
                      marginLeft: 4,
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: "none",
                      background: "rgba(248,113,113,.1)",
                      color: "#f87171",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      touchAction: "manipulation",
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div
            style={{
              padding: "clamp(12px,3vw,16px)",
              borderTop: `1px solid ${BR}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span style={{ color: CM, fontSize: 13 }}>Total</span>
              <span
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 20,
                  color: G,
                  fontWeight: 700,
                }}
              >
                ₱{cartTotal.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              style={{
                width: "100%",
                background: G,
                color: BG,
                border: "none",
                borderRadius: 12,
                padding: "15px",
                fontFamily: "'Cinzel',serif",
                fontSize: 13,
                letterSpacing: ".15em",
                fontWeight: 700,
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              PROCEED TO CHECKOUT
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── VARIANT SHEET ───────────────────────────────────────────────────────── */
function VariantSheet({
  item,
  onSelect,
  onClose,
}: {
  item: MenuItem;
  onSelect: (variant: string, price?: number | null) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.6)",
          backdropFilter: "blur(4px)",
          zIndex: 60,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#111e11",
          borderTop: `1px solid ${BR}`,
          borderRadius: "20px 20px 0 0",
          zIndex: 61,
          padding: "0 0 env(safe-area-inset-bottom,0)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0 4px",
          }}
        >
          <div
            style={{ width: 36, height: 4, borderRadius: 999, background: BR }}
          />
        </div>
        <div
          style={{
            padding: "0 clamp(16px,4vw,20px) 14px",
            borderBottom: `1px solid ${BR}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {item.image && (
              <img
                src={item.image}
                alt={item.name}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  objectFit: "cover",
                  border: `1px solid ${BR}`,
                  flexShrink: 0,
                }}
              />
            )}
            <div>
              <p
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: C,
                }}
              >
                {item.name}
              </p>
              <p style={{ color: CM, fontSize: 12, marginTop: 2 }}>
                Choose your variant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: CARD,
              border: `1px solid ${BR}`,
              borderRadius: 999,
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: CM,
            }}
          >
            <X size={13} />
          </button>
        </div>
        <div
          style={{
            padding: "14px clamp(16px,4vw,20px) 24px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {((item.variants || []) as any[]).map((v) => {
            const label = typeof v === "string" ? v : v.label;
            const price =
              typeof v === "object" && v.price != null ? v.price : null;
            return (
              <button
                key={label}
                onClick={() => onSelect(label, price)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `1.5px solid ${BR}`,
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: C,
                  fontSize: 14,
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: ".04em",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = G;
                  e.currentTarget.style.background = GD;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BR;
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{label}</span>
                {price != null && (
                  <span
                    style={{
                      color: G,
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
    </>
  );
}

/* ─── MENU SCREEN ─────────────────────────────────────────────────────────── */
/* ─── GENERIC OPTIONS SHEET (admin-defined per-product options) ────────────── */
function GenericOptionsSheet({
  item,
  onAdd,
  onClose,
  hiddenSubLabels,
  livePriceByLabel,
}: {
  item: MenuItem;
  onAdd: (customizations: SelectedCustomization[]) => void;
  onClose: () => void;
  hiddenSubLabels?: Set<string>;
  livePriceByLabel?: Map<string, number>;
}) {
  // Saved per-item option groups (from the admin "Edit Item" form) are a
  // frozen snapshot taken at save time — they don't auto-update when a
  // "Substitutions" menu item gets hidden OR repriced later. Strip out any
  // choice whose label matches a currently-hidden substitution item (as
  // before), and override any remaining choice's price with the live
  // Substitution item's current price when the labels match, so editing
  // e.g. "Oatmilk Substitution" from ₱30 to ₱35 applies to every drink
  // that offers "Oat Milk" as a choice, not just the legacy fallback path.
  //
  // Sauce groups get the same live override for their rules, not just
  // their choices: items saved before Sauce became required/max-1 are
  // still frozen at type:"multi", max:2, required:undefined from whenever
  // they were last saved in admin. Forcing it here means every item with
  // a Sauce group behaves correctly immediately, without needing staff to
  // reopen and resave each item one at a time.
  const groups = (item.options || [])
    .map((g) => ({
      ...g,
      ...(g.name.toLowerCase() === "sauce"
        ? { type: "single" as const, required: true, max: undefined }
        : {}),
      choices: g.choices
        .filter(
          (c) =>
            !hiddenSubLabels?.has(
              c.label.trim().toLowerCase().replace(/\s+/g, ""),
            ),
        )
        .map((c) => {
          const key = c.label.trim().toLowerCase().replace(/\s+/g, "");
          const livePrice = livePriceByLabel?.get(key);
          return livePrice !== undefined ? { ...c, price: livePrice } : c;
        }),
    }))
    .filter((g) => g.choices.length > 0);
  const [selections, setSelections] = useState<Record<string, Set<string>>>(
    () => {
      const init: Record<string, Set<string>> = {};
      groups.forEach((g) => {
        init[g.name] = new Set();
      });
      return init;
    },
  );

  const extraCost = groups.reduce((sum, g) => {
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
    .filter((g) => g.required || g.type === "single")
    .every((g) => (selections[g.name]?.size || 0) > 0);

  const handleAdd = () => {
    const result: SelectedCustomization[] = [];
    groups.forEach((g) => {
      const sel = selections[g.name] || new Set();
      g.choices.forEach((c) => {
        if (sel.has(c.label))
          result.push({ type: g.name, label: c.label, price: c.price });
      });
    });
    onAdd(result);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.6)",
          backdropFilter: "blur(4px)",
          zIndex: 60,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#111e11",
          borderTop: `1px solid ${BR}`,
          borderRadius: "20px 20px 0 0",
          zIndex: 61,
          padding: "0 0 env(safe-area-inset-bottom,0)",
          maxHeight: "85svh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "20px 20px 14px",
            borderBottom: `1px solid ${BR}`,
            flexShrink: 0,
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: "'Yanone Kaffeesatz',sans-serif",
                fontSize: 20,
                fontWeight: 700,
                color: C,
              }}
            >
              {item.name}
            </h3>
            <p style={{ color: CM, fontSize: 13, marginTop: 4 }}>
              ₱{item.price}
              {extraCost > 0 && <span> + ₱{extraCost}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: `1px solid ${BR}`,
              borderRadius: 999,
              width: 30,
              height: 30,
              color: CM,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          {groups.map((g) => (
            <div key={g.name} style={{ marginBottom: 18 }}>
              <p
                style={{
                  color: CM,
                  fontSize: 11,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {g.name}
                {g.required ? " · Required" : ""}
                {g.type === "multi" && g.max ? ` · Max ${g.max}` : ""}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${sel ? G : BR}`,
                        background: sel ? GD : "rgba(255,255,255,0.02)",
                        color: sel ? C : CM,
                        cursor: "pointer",
                        fontSize: 14,
                        textAlign: "left",
                      }}
                    >
                      <span>{c.label}</span>
                      <span
                        style={{ color: c.price > 0 ? G : CF, fontSize: 13 }}
                      >
                        {c.price > 0 ? `+₱${c.price}` : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BR}` }}>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            style={{
              width: "100%",
              background: canAdd ? G : "rgba(212,168,67,0.25)",
              color: canAdd ? "#0b150b" : CM,
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: canAdd ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
            }}
          >
            <span>ADD TO CART</span>
            <span>₱{item.price + extraCost}</span>
          </button>
        </div>
      </div>
    </>
  );
}

function MenuScreen({
  menuItems,
  cart,
  onAddToCart,
  onUpdateCart,
  onRemoveFromCart,
  onCheckout,
  onBack,
  shopOpen,
}: any) {
  const categories = Array.from(
    new Set(menuItems.map((i: MenuItem) => i.category)),
  ).filter((cat) => {
    const c = (cat as string).toLowerCase();
    return (
      !c.includes("add-on") &&
      !c.includes("substitut") &&
      !c.includes("sauce") &&
      !c.includes("egg style")
    );
  }) as string[];

  const visibleMenuItems = menuItems.filter((i: MenuItem) => {
    const c = i.category.toLowerCase();
    return (
      i.available &&
      !c.includes("add-on") &&
      !c.includes("substitut") &&
      !c.includes("sauce") &&
      !c.includes("egg style")
    );
  });

  const [active, setActive] = useState(categories[0] || "");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customizingConfig, setCustomizingConfig] =
    useState<CustomizationConfig | null>(null);
  const [variantItem, setVariantItem] = useState<MenuItem | null>(null);
  const [genericOptionsItem, setGenericOptionsItem] = useState<MenuItem | null>(
    null,
  );

  const liveSauces = menuItems
    .filter(
      (i: MenuItem) =>
        i.category.toLowerCase().includes("sauce") && i.available,
    )
    .map((i: MenuItem) => ({ name: i.name, image: i.image }));

  const liveEggStyles = menuItems
    .filter(
      (i: MenuItem) =>
        i.category.toLowerCase().includes("egg style") && i.available,
    )
    .map((i: MenuItem) => ({ name: i.name, image: i.image }));

  // Whether any sauce/egg-style menu items were ever created at all
  // (regardless of hidden/available). Without this, hiding every sauce
  // item one at a time used to fall back to the hardcoded list (incl.
  // "Honey Mustard") the moment the live list hit zero, undoing the hide
  // instead of showing an empty list — same fix as milkSubItemsExist below.
  const sauceItemsExist = menuItems.some((i: MenuItem) =>
    i.category.toLowerCase().includes("sauce"),
  );
  const eggStyleItemsExist = menuItems.some((i: MenuItem) =>
    i.category.toLowerCase().includes("egg style"),
  );

  const milkSubItemsExist = menuItems.some(
    (i: MenuItem) =>
      i.category.toLowerCase().includes("substitution") && /milk/i.test(i.name),
  );
  const baseSubItemsExist = menuItems.some(
    (i: MenuItem) =>
      i.category.toLowerCase().includes("substitution") &&
      /matcha|base/i.test(i.name),
  );
  const liveMilkSubs = menuItems
    .filter(
      (i: MenuItem) =>
        i.category.toLowerCase().includes("substitution") &&
        i.available &&
        /milk/i.test(i.name),
    )
    .map((i: MenuItem) => ({
      label: i.name.replace(/substitution/i, "").trim(),
      price: i.price,
    }));
  const liveBaseSubs = menuItems
    .filter(
      (i: MenuItem) =>
        i.category.toLowerCase().includes("substitution") &&
        i.available &&
        /matcha|base/i.test(i.name),
    )
    .map((i: MenuItem) => ({
      label: i.name.replace(/substitution/i, "").trim(),
      price: i.price,
    }));

  // hiddenSubLabels also covers hidden sauces and egg styles now — an
  // item's saved `options` (from the admin "Edit Item" form, e.g. Poppers
  // & Fries' own frozen Sauce list) is a snapshot taken at save time and
  // never re-reads the live Sauces/Egg Styles menu categories. Without
  // this, hiding "Honey Mustard" in the Sauces category correctly removed
  // it from the auto category-based sauce picker (getCategoryCustomizations)
  // but had no effect on any item with its own saved options, since that
  // list was frozen independently.
  const hiddenSubLabels = new Set<string>(
    menuItems
      .filter(
        (i: MenuItem) =>
          i.category.toLowerCase().includes("substitution") && !i.available,
      )
      .map((i: MenuItem) =>
        i.name
          .replace(/substitution/i, "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ""),
      )
      .concat(
        menuItems
          .filter(
            (i: MenuItem) =>
              (i.category.toLowerCase().includes("sauce") ||
                i.category.toLowerCase().includes("egg style")) &&
              !i.available,
          )
          .map((i: MenuItem) =>
            i.name.trim().toLowerCase().replace(/\s+/g, ""),
          ),
      ),
  );

  // Live price overrides — per-item `options.choices[].price` (set once in
  // the admin "Edit Item" form) is a frozen snapshot and does NOT update
  // when the "Substitutions" menu item's price is edited later. Build a
  // normalized-label -> current-price map from the live Substitution menu
  // items so GenericOptionsSheet can override the frozen price at render
  // time, the same way hiddenSubLabels already overrides visibility.
  const liveSubPriceByLabel = new Map<string, number>(
    menuItems
      .filter((i: MenuItem) =>
        i.category.toLowerCase().includes("substitution"),
      )
      .map((i: MenuItem) => [
        i.name
          .replace(/substitution/i, "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ""),
        i.price,
      ]),
  );

  const ITEM_VARIANTS: Record<string, { label: string; price?: number }[]> = {
    longganisa: [
      { label: "Garlic" },
      { label: "Hamonado" },
      { label: "Mixed" },
    ],
    tapa: [{ label: "Chicken" }, { label: "Beef" }],
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

  const handleAddToCartWithCustomization = (item: MenuItem) => {
    // Check variants FIRST — VariantSheet.onSelect already chains into
    // GenericOptionsSheet when the resolved item has options, so items
    // with BOTH variants + options (e.g. Ramen: Mild/Spicy + Add-Ons)
    // will show the variant picker then the options sheet in sequence.
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
    // No variants — go straight to options sheet if options exist
    if (item.options && item.options.length > 0) {
      setGenericOptionsItem(item);
      return;
    }
    // No variants or DB options — fall back to legacy category customizations
    const config = getCategoryCustomizations(
      item.category,
      sauceItemsExist ? liveSauces : undefined,
      eggStyleItemsExist ? liveEggStyles : undefined,
      item.name,
      milkSubItemsExist ? liveMilkSubs : undefined,
      baseSubItemsExist ? liveBaseSubs : undefined,
    );
    if (config) {
      setCustomizingItem(item);
      setCustomizingConfig(config);
    } else {
      onAddToCart(item, []);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isManualScroll = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width:640px)");
    setIsDesktop(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const searchResults =
    search.trim() !== ""
      ? visibleMenuItems.filter(
          (i: MenuItem) =>
            i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.description.toLowerCase().includes(search.toLowerCase()),
        )
      : null;

  const total = cart.reduce(
    (s: number, i: CartItem) => s + i.price * i.quantity,
    0,
  );
  const count = cart.reduce((s: number, i: CartItem) => s + i.quantity, 0);

  // Scroll spy — update active tab as user scrolls
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isManualScroll.current) return;
      let current = categories[0];
      for (const cat of categories) {
        const el = sectionRefs.current[cat];
        if (!el) continue;
        const top =
          el.getBoundingClientRect().top -
          container.getBoundingClientRect().top;
        if (top <= 120) current = cat;
      }
      setActive(current);
      // Scroll active tab into view
      const tabsContainer = tabsRef.current;
      if (tabsContainer) {
        const activeBtn = tabsContainer.querySelector(
          `[data-cat="${current}"]`,
        ) as HTMLElement;
        if (activeBtn) {
          activeBtn.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [categories]);

  const scrollToCategory = (cat: string) => {
    setActive(cat);
    isManualScroll.current = true;
    const el = sectionRefs.current[cat];
    const container = scrollRef.current;
    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const scrollTop = container.scrollTop + elTop - containerTop - 16;
      container.scrollTo({ top: scrollTop, behavior: "smooth" });
      setTimeout(() => {
        isManualScroll.current = false;
      }, 800);
    }
  };

  return (
    <div
      style={{
        height: "100svh",
        background: BG,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <TopNav
        cartCount={count}
        cartTotal={total}
        onCartOpen={() => setCartOpen(true)}
      />
      <SubBar onClick={onBack} label="Change Mode" />

      {/* Search */}
      <div style={{ padding: "4px clamp(12px,4vw,16px) 10px", flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: CARD,
            border: `1px solid ${searchFocused ? G : BR}`,
            borderRadius: 10,
            padding: "9px 12px",
            transition: "border-color .18s",
          }}
        >
          <Search
            size={14}
            color={searchFocused ? G : CM}
            style={{ flexShrink: 0 }}
          />
          <input
            type="text"
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: C,
              fontSize: 16,
              fontFamily: "inherit",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: CM,
                display: "flex",
                alignItems: "center",
                padding: 4,
                touchAction: "manipulation",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
      >
        {/* Desktop sidebar */}
        {isDesktop && !searchResults && (
          <aside
            style={{
              width: 160,
              flexShrink: 0,
              borderRight: `1px solid ${BR}`,
              overflowY: "auto",
              padding: "14px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              scrollbarWidth: "none",
            }}
          >
            <p
              style={{
                color: CF,
                fontSize: 9,
                letterSpacing: ".16em",
                fontFamily: "'Cinzel',serif",
                padding: "0 8px 10px",
              }}
            >
              CATEGORIES
            </p>
            {categories.map((cat) => {
              const a = active === cat;
              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${a ? G : "transparent"}`,
                    background: a ? GD : "transparent",
                    color: a ? G : CM,
                    fontFamily: "'Cinzel',serif",
                    fontSize: 11,
                    letterSpacing: ".08em",
                    cursor: "pointer",
                    transition: "all .18s",
                    fontWeight: a ? 700 : 400,
                    lineHeight: 1.4,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </aside>
        )}

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* Mobile sticky category tabs */}
          {!isDesktop && !searchResults && (
            <div
              ref={tabsRef}
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                padding: `0 clamp(12px,4vw,16px) 10px`,
                borderBottom: `1px solid ${BR}`,
                scrollbarWidth: "none",
                flexShrink: 0,
              }}
            >
              {categories.map((cat) => {
                const a = active === cat;
                return (
                  <button
                    key={cat}
                    data-cat={cat}
                    onClick={() => scrollToCategory(cat)}
                    style={{
                      whiteSpace: "nowrap",
                      padding: "8px 18px",
                      borderRadius: 999,
                      border: `1px solid ${a ? G : BR}`,
                      background: a ? G : "transparent",
                      color: a ? BG : CM,
                      fontFamily: "'Cinzel',serif",
                      fontSize: "clamp(10px,2.5vw,11px)",
                      letterSpacing: ".1em",
                      cursor: "pointer",
                      transition: "all .18s",
                      fontWeight: a ? 700 : 400,
                      minHeight: 38,
                      touchAction: "manipulation",
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isDesktop
                ? "18px 20px 100px"
                : `14px clamp(12px,4vw,16px) 100px`,
            }}
          >
            {/* Search results */}
            {searchResults && (
              <>
                <p style={{ color: CM, fontSize: 12, marginBottom: 14 }}>
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""} for "{search}"
                </p>
                {searchResults.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 300,
                      color: CF,
                      gap: 8,
                    }}
                  >
                    <Leaf size={40} style={{ opacity: 0.5, color: CM }} />
                    <p style={{ fontSize: 14 }}>No items match your search</p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(min(100%,clamp(140px,40vw,260px)),1fr))",
                      gap: "clamp(10px,2.5vw,14px)",
                    }}
                  >
                    {searchResults.map((item: MenuItem) => {
                      const count = cart
                        .filter((c: CartItem) => c._id === item._id)
                        .reduce((s: number, c: CartItem) => s + c.quantity, 0);
                      return (
                        <MenuCard
                          key={item._id}
                          item={item}
                          cartCount={count}
                          onAdd={() => handleAddToCartWithCustomization(item)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Continuous category sections */}
            {!searchResults &&
              categories.map((cat) => {
                const items = [
                  ...visibleMenuItems.filter(
                    (i: MenuItem) => i.category === cat,
                  ),
                ].sort((a: MenuItem, b: MenuItem) => {
                  const n = (s: string) => s.toLowerCase();
                  const aIced =
                    n(a.name).startsWith("ice") || n(a.name).includes("(iced)");
                  const bIced =
                    n(b.name).startsWith("ice") || n(b.name).includes("(iced)");
                  if (aIced && !bIced) return -1;
                  if (!aIced && bIced) return 1;
                  return n(a.name).localeCompare(n(b.name));
                });
                return (
                  <div
                    key={cat}
                    ref={(el) => {
                      sectionRefs.current[cat] = el;
                    }}
                    style={{ marginBottom: 32 }}
                  >
                    {/* Category header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "'Cinzel',serif",
                          fontSize: "clamp(12px,3vw,14px)",
                          fontWeight: 700,
                          letterSpacing: ".12em",
                          color: G,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cat.toUpperCase()}
                      </p>
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          background: `linear-gradient(90deg,${BR},transparent)`,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill,minmax(min(100%,clamp(140px,40vw,260px)),1fr))",
                        gap: "clamp(10px,2.5vw,14px)",
                      }}
                    >
                      {items.map((item: MenuItem) => {
                        const count = cart
                          .filter((c: CartItem) => c._id === item._id)
                          .reduce(
                            (s: number, c: CartItem) => s + c.quantity,
                            0,
                          );
                        return (
                          <MenuCard
                            key={item._id}
                            item={item}
                            cartCount={count}
                            onAdd={() => handleAddToCartWithCustomization(item)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Sticky checkout */}
      {count > 0 && (
        <div
          style={{
            flexShrink: 0,
            padding: `clamp(10px,3vw,12px) clamp(12px,4vw,16px)`,
            background: `${BG}f2`,
            backdropFilter: "blur(16px)",
            borderTop: `1px solid ${BR}`,
          }}
        >
          {!shopOpen && (
            <p
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                textAlign: "center",
                color: "#f87171",
                fontSize: 12,
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              <AlertCircle size={12} color="#f87171" /> Ordering is paused —
              checkout disabled
            </p>
          )}
          <button
            onClick={shopOpen ? onCheckout : undefined}
            disabled={!shopOpen}
            style={{
              width: "100%",
              background: shopOpen ? G : "rgba(212,168,67,0.25)",
              color: shopOpen ? BG : "rgba(232,213,163,0.4)",
              border: "none",
              borderRadius: 14,
              padding: "clamp(13px,3.5vw,15px) 16px",
              fontFamily: "'Cinzel',serif",
              fontSize: "clamp(13px,3vw,14px)",
              letterSpacing: ".15em",
              fontWeight: 700,
              cursor: shopOpen ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              touchAction: "manipulation",
            }}
          >
            <span
              style={{
                background: "rgba(0,0,0,.15)",
                borderRadius: 999,
                padding: "2px 10px",
                fontSize: 12,
              }}
            >
              {count} item{count !== 1 ? "s" : ""}
            </span>
            <span>{shopOpen ? "CHECKOUT" : "PAUSED"}</span>
            <span>₱{total.toFixed(2)}</span>
          </button>
        </div>
      )}

      <CartDrawer
        cart={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdate={onUpdateCart}
        onRemove={onRemoveFromCart}
        onCheckout={() => {
          setCartOpen(false);
          onCheckout();
        }}
        cartTotal={total}
      />

      {variantItem && (
        <VariantSheet
          item={variantItem}
          onClose={() => setVariantItem(null)}
          onSelect={(variant, price) => {
            const itemWithVariant = {
              ...variantItem,
              name: `${variantItem.name} (${variant})`,
              ...(price != null ? { price } : {}),
            };
            setVariantItem(null);
            if (itemWithVariant.options && itemWithVariant.options.length > 0) {
              const nonVariantOptions = itemWithVariant.options.filter(
                (g: any) => g.name.toLowerCase() !== "variant",
              );
              if (nonVariantOptions.length > 0) {
                setGenericOptionsItem({
                  ...itemWithVariant,
                  options: nonVariantOptions,
                });
              } else {
                const config = getCategoryCustomizations(
                  variantItem.category,
                  sauceItemsExist ? liveSauces : undefined,
                  eggStyleItemsExist ? liveEggStyles : undefined,
                  itemWithVariant.name,
                  milkSubItemsExist ? liveMilkSubs : undefined,
                  baseSubItemsExist ? liveBaseSubs : undefined,
                );
                if (config) {
                  setCustomizingItem(itemWithVariant);
                  setCustomizingConfig(config);
                } else {
                  onAddToCart(itemWithVariant, []);
                }
              }
              return;
            }
            const config = getCategoryCustomizations(
              variantItem.category,
              sauceItemsExist ? liveSauces : undefined,
              eggStyleItemsExist ? liveEggStyles : undefined,
              itemWithVariant.name,
              milkSubItemsExist ? liveMilkSubs : undefined,
              baseSubItemsExist ? liveBaseSubs : undefined,
            );
            if (config) {
              setCustomizingItem(itemWithVariant);
              setCustomizingConfig(config);
            } else {
              onAddToCart(itemWithVariant, []);
            }
          }}
        />
      )}

      {genericOptionsItem && (
        <GenericOptionsSheet
          item={genericOptionsItem}
          onClose={() => setGenericOptionsItem(null)}
          hiddenSubLabels={hiddenSubLabels}
          livePriceByLabel={liveSubPriceByLabel}
          onAdd={(customizations) => {
            onAddToCart(genericOptionsItem, customizations);
            setGenericOptionsItem(null);
          }}
        />
      )}

      {customizingItem && customizingConfig && (
        <CustomizationSheet
          item={customizingItem}
          config={customizingConfig}
          onClose={() => {
            setCustomizingItem(null);
            setCustomizingConfig(null);
          }}
          onAdd={(customizations) => {
            onAddToCart(customizingItem, customizations);
            setCustomizingItem(null);
            setCustomizingConfig(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── INPUT FIELD ─────────────────────────────────────────────────────────── */
function InputField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  inputMode,
}: any) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label
        style={{
          display: "block",
          color: CM,
          fontSize: 10,
          letterSpacing: ".1em",
          marginBottom: 6,
          fontFamily: "'Cinzel',serif",
        }}
      >
        {label.toUpperCase()}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "rgba(255,255,255,.03)",
          border: `1px solid ${focused ? G : BR}`,
          borderRadius: 8,
          padding: "12px 12px",
          color: C,
          fontSize: 16,
          outline: "none",
          transition: "border-color .18s",
          fontFamily: "inherit",
          boxSizing: "border-box",
          WebkitAppearance: "none" as any,
        }}
      />
    </div>
  );
}

/* ─── DELIVERY ADDRESS PICKER ─────────────────────────────────────────────── */
function DeliveryAddressPicker({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const mapObjRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locError, setLocError] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  const geocodeDebounce = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const isProgrammaticMove = useRef(false);
  const isDrawingRoute = useRef(false);
  const userIsTyping = useRef(false);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
    if (value?.fullAddress) setShowFields(true);
  }, [value]);

  const DEFAULT_LAT = 15.4817,
    DEFAULT_LNG = 120.966;

  const CAFE_LAT = 15.461629;
  const CAFE_LNG = 120.9492521;

  const drawRoute = useCallback(async (destLat: number, destLng: number) => {
    if (!mapObjRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    if (routeLayerRef.current) {
      mapObjRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    try {
      isDrawingRoute.current = true;
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${CAFE_LNG},${CAFE_LAT};${destLng},${destLat}?overview=full&geometries=geojson`,
      );
      const data = await res.json();
      if (data.routes?.[0]) {
        const route = data.routes[0];
        const kmRaw = route.distance / 1000;
        const km = kmRaw.toFixed(1);
        const fee = getDeliveryFee(kmRaw);
        setRouteDistance(`${km} km from 3rd Space · ₱${fee} delivery fee`);
        onChangeRef.current({
          ...(valueRef.current || {}),
          lat: destLat,
          lng: destLng,
          distanceKm: kmRaw,
          deliveryFee: fee,
        });
        const layer = L.geoJSON(route.geometry, {
          style: { color: "#4ade80", weight: 4, opacity: 0.8 },
        }).addTo(mapObjRef.current);
        routeLayerRef.current = layer;
      }
    } catch {
      /* silent */
    } finally {
      setTimeout(() => {
        isDrawingRoute.current = false;
      }, 800);
    }
  }, []);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      );
      const data = await res.json();
      const addr = data.address || {};
      const cur = valueRef.current || {};
      onChangeRef.current({
        ...cur,
        lat,
        lng,
        deliveryFee: cur.deliveryFee,
        distanceKm: cur.distanceKm,
        street: cur.street?.trim()
          ? cur.street
          : addr.road || addr.pedestrian || "",
        barangay: cur.barangay?.trim()
          ? cur.barangay
          : addr.suburb ||
            addr.village ||
            addr.neighbourhood ||
            addr.quarter ||
            "",
        city: cur.city?.trim()
          ? cur.city
          : addr.city || addr.town || addr.municipality || "",
        province: cur.province?.trim() ? cur.province : addr.state || "",
        fullAddress: data.display_name || "",
      });
      setShowFields(true);
    } catch {
      /* silent */
    }
    setGeocoding(false);
  }, []);

  const initMap = useCallback(
    (lat?: number, lng?: number) => {
      if (!mapRef.current || !leafletRef.current) return;
      if (mapObjRef.current) return;
      const L = leafletRef.current;
      const startLat = lat ?? (value?.lat || DEFAULT_LAT),
        startLng = lng ?? (value?.lng || DEFAULT_LNG);
      const map = L.map(mapRef.current, {
        center: [startLat, startLng],
        zoom: 17,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      map.on("moveend", () => {
        const c = map.getCenter();
        clearTimeout(geocodeDebounce.current);
        geocodeDebounce.current = setTimeout(() => {
          if (
            isProgrammaticMove.current ||
            isDrawingRoute.current ||
            userIsTyping.current
          )
            return;
          // Only reverse geocode, don't re-draw route
          setGeocoding(true);
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${c.lat}&lon=${c.lng}&addressdetails=1`,
          )
            .then((r) => r.json())
            .then((data) => {
              const addr = data.address || {};
              const cur = valueRef.current || {};
              onChange({
                ...cur,
                lat: c.lat,
                lng: c.lng,
                deliveryFee: cur.deliveryFee,
                distanceKm: cur.distanceKm,
                street: cur.street?.trim()
                  ? cur.street
                  : addr.road || addr.pedestrian || "",
                barangay: cur.barangay?.trim()
                  ? cur.barangay
                  : addr.suburb ||
                    addr.village ||
                    addr.neighbourhood ||
                    addr.quarter ||
                    "",
                city: cur.city?.trim()
                  ? cur.city
                  : addr.city || addr.town || addr.municipality || "",
                province: cur.province?.trim()
                  ? cur.province
                  : addr.state || "",
                fullAddress: data.display_name || "",
              });
              setShowFields(true);
              drawRoute(c.lat, c.lng);
            })
            .catch(() => {})
            .finally(() => setGeocoding(false));
        }, 600);
      });
      mapObjRef.current = map;
      setMapReady(true);
      // Don't auto-geocode on load — wait for user to pick a location
    },
    [value, reverseGeocode],
  );

  useEffect(() => {
    if ((window as any).L) {
      leafletRef.current = (window as any).L;
      initMap();
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      leafletRef.current = (window as any).L;
      initMap();
    };
    document.head.appendChild(script);
    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
    };
  }, []);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocating(false);
        if (mapObjRef.current) {
          isProgrammaticMove.current = true;
          mapObjRef.current.flyTo([lat, lng], 18, { duration: 1.2 });
          setTimeout(() => {
            reverseGeocode(lat, lng);
            drawRoute(lat, lng);
            setTimeout(() => {
              isProgrammaticMove.current = false;
            }, 800);
          }, 1400);
        } else if (leafletRef.current) initMap(lat, lng);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === 1
            ? "Location denied. Drag the map to your address."
            : "Could not get GPS. Drag the map to your address.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [initMap]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=ph`,
      );
      setSearchResults(await res.json());
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(v), 500);
  };

  const pickSearchResult = (r: any) => {
    const lat = parseFloat(r.lat),
      lng = parseFloat(r.lon);
    setSearchQuery(r.display_name.split(",").slice(0, 2).join(","));
    setSearchResults([]);
    if (mapObjRef.current) {
      isProgrammaticMove.current = true;
      mapObjRef.current.flyTo([lat, lng], 18, { duration: 1.2 });
      setTimeout(() => {
        isProgrammaticMove.current = false;
        reverseGeocode(lat, lng);
      }, 1500);
    } else if (leafletRef.current) initMap(lat, lng);
  };

  const sf = (field: string, val: string) => {
    userIsTyping.current = true;
    clearTimeout((userIsTyping as any)._t);
    (userIsTyping as any)._t = setTimeout(() => {
      userIsTyping.current = false;
    }, 3000);
    onChange({ ...(value || {}), [field]: val });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${searchFocused ? G : BR}`,
            borderRadius: 10,
            padding: "10px 12px",
            transition: "border-color .18s",
          }}
        >
          <Search
            size={14}
            color={searchFocused ? G : CM}
            style={{ flexShrink: 0 }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search for your address or landmark…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: C,
              fontSize: 16,
              fontFamily: "inherit",
            }}
          />
          {searching && (
            <div
              style={{
                width: 13,
                height: 13,
                border: `2px solid ${G}`,
                borderTopColor: "transparent",
                borderRadius: 999,
                animation: "spin .7s linear infinite",
                flexShrink: 0,
              }}
            />
          )}
          {searchQuery && !searching && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: CM,
                display: "flex",
                padding: 4,
                touchAction: "manipulation",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {searchResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#1a2a1a",
              border: `1px solid ${BR}`,
              borderRadius: 10,
              overflow: "hidden",
              zIndex: 999,
              boxShadow: "0 8px 32px rgba(0,0,0,.5)",
            }}
          >
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => pickSearchResult(r)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  background: "none",
                  border: "none",
                  borderBottom:
                    i < searchResults.length - 1 ? `1px solid ${BR}` : "none",
                  cursor: "pointer",
                  color: CM,
                  fontSize: 12,
                  lineHeight: 1.4,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  touchAction: "manipulation",
                }}
              >
                <MapPin
                  size={12}
                  color={G}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* GPS */}
      <button
        onClick={locateMe}
        disabled={locating}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: locating ? "rgba(212,168,67,.1)" : GD,
          border: `1.5px solid ${G}`,
          borderRadius: 10,
          color: G,
          cursor: locating ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily: "'Cinzel',serif",
          fontSize: 12,
          letterSpacing: ".08em",
          fontWeight: 700,
          transition: "all .2s",
          touchAction: "manipulation",
          minHeight: 48,
        }}
      >
        <Navigation
          size={14}
          style={{ animation: locating ? "spin 1s linear infinite" : "none" }}
        />
        {locating ? "GETTING LOCATION…" : "USE MY CURRENT LOCATION"}
      </button>

      {locError && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "rgba(248,113,113,.08)",
            border: "1px solid rgba(248,113,113,.2)",
            borderRadius: 10,
            padding: "9px 12px",
          }}
        >
          <AlertCircle
            size={13}
            color={ERR}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <span style={{ color: ERR, fontSize: 12, lineHeight: 1.5 }}>
            {locError}
          </span>
        </div>
      )}

      {/* Map */}
      <div
        style={{
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${BR}`,
          height: "clamp(180px,45vw,220px)",
        }}
      >
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {/* Fixed pin */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -100%)",
            zIndex: 999,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              background: G,
              borderRadius: "50% 50% 50% 0",
              transform: "rotate(-45deg)",
              boxShadow: "0 4px 16px rgba(212,168,67,.5)",
              border: "3px solid white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                transform: "rotate(45deg)",
                width: 8,
                height: 8,
                background: "white",
                borderRadius: 999,
              }}
            />
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              background: "rgba(212,168,67,.4)",
              borderRadius: 999,
              marginTop: 2,
            }}
          />
        </div>
        {geocoding && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(14,25,14,.85)",
              backdropFilter: "blur(6px)",
              borderRadius: 999,
              padding: "5px 14px",
              display: "flex",
              alignItems: "center",
              gap: 7,
              zIndex: 998,
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
                border: `2px solid ${G}`,
                borderTopColor: "transparent",
                borderRadius: 999,
                animation: "spin .7s linear infinite",
              }}
            />
            <span style={{ color: CM, fontSize: 11 }}>Finding address…</span>
          </div>
        )}
        {mapReady && !geocoding && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(14,25,14,.82)",
              backdropFilter: "blur(6px)",
              borderRadius: 999,
              padding: "4px 12px",
              zIndex: 998,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: CM, fontSize: 10, letterSpacing: ".05em" }}>
              Drag map · pin stays centered
            </span>
          </div>
        )}
      </div>

      {routeDistance && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(212,168,67,.08)",
              border: `1px solid rgba(212,168,67,.3)`,
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              color: "#d4a843",
              fontFamily: "'Cinzel',serif",
              fontWeight: 700,
              letterSpacing: ".06em",
            }}
          >
            📍 {routeDistance}
          </div>
          {value?.deliveryFee != null && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "4px 12px",
                background: "rgba(255,255,255,.03)",
                border: `1px solid ${BR}`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: CM,
              }}
            >
              <span>Zone</span>
              <span style={{ color: C, fontWeight: 600, textAlign: "right" }}>
                {(value.distanceKm ?? 0) <= 1
                  ? "Zone 1 (within 1 km)"
                  : (value.distanceKm ?? 0) <= 3
                    ? "Zone 2 (1–3 km)"
                    : (value.distanceKm ?? 0) <= 10
                      ? "Zone 3 (3–10 km)"
                      : "Zone 4 (10 km+)"}
              </span>
              <span>Delivery fee</span>
              <span
                style={{
                  color: "#d4a843",
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 700,
                  textAlign: "right",
                }}
              >
                ₱{value.deliveryFee}
              </span>
            </div>
          )}
        </div>
      )}
      {value?.fullAddress && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "rgba(212,168,67,.07)",
            border: `1px solid ${BR}`,
            borderRadius: 10,
            padding: "9px 12px",
          }}
        >
          <MapPin size={13} color={G} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ color: CM, fontSize: 12, lineHeight: 1.4, flex: 1 }}>
            {value.fullAddress}
          </span>
        </div>
      )}

      {(showFields || value?.fullAddress) && (
        <>
          <p
            style={{
              color: CM,
              fontSize: 10,
              letterSpacing: ".12em",
              fontFamily: "'Cinzel',serif",
              marginTop: 4,
            }}
          >
            CONFIRM / EDIT YOUR ADDRESS
          </p>
          <InputField
            label="House No. / Unit / Floor *"
            placeholder="e.g. Unit 3B, 123"
            value={value?.houseNo || ""}
            onChange={(v: string) => sf("houseNo", v)}
          />
          <InputField
            label="Street *"
            placeholder="e.g. Felipe Vergara Hi-Way"
            value={value?.street || ""}
            onChange={(v: string) => sf("street", v)}
          />
          <InputField
            label="Barangay *"
            placeholder="e.g. Brgy. Aduas Norte"
            value={value?.barangay || ""}
            onChange={(v: string) => sf("barangay", v)}
          />
          <InputField
            label="City / Municipality *"
            placeholder="e.g. Cabanatuan City"
            value={value?.city || ""}
            onChange={(v: string) => sf("city", v)}
          />
          <InputField
            label="Landmark / Note to rider (optional)"
            placeholder="e.g. Near Jollibee, green gate"
            value={value?.landmark || ""}
            onChange={(v: string) => sf("landmark", v)}
          />
        </>
      )}
    </div>
  );
}

// ── TABLE PICKER ───────────────────────────────────────────────────────────
const TOTAL_TABLES = 5; // change to however many tables you have

function TablePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [occupiedTables, setOccupiedTables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders?status=pending")
      .then((r) => r.json())
      .then(async (pending: any[]) => {
        const [confirmed, preparing, ready] = await Promise.all([
          fetch("/api/orders?status=confirmed").then((r) => r.json()),
          fetch("/api/orders?status=preparing").then((r) => r.json()),
          fetch("/api/orders?status=ready").then((r) => r.json()),
        ]);
        const active = [...pending, ...confirmed, ...preparing, ...ready];
        const tables = new Set(
          active.map((o) => String(o.tableNumber)).filter(Boolean),
        );
        setOccupiedTables(tables);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tables = Array.from({ length: TOTAL_TABLES }, (_, i) => String(i + 1));
  const selected = value ? value.replace(/\D/g, "") : "";

  return (
    <div>
      <label
        style={{
          display: "block",
          color: CM,
          fontSize: 10,
          letterSpacing: ".1em",
          marginBottom: 10,
          fontFamily: "'Cinzel',serif",
        }}
      >
        SELECT YOUR TABLE *
      </label>

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: CM,
            fontSize: 12,
            padding: "14px 0",
          }}
        >
          <div
            style={{
              width: 13,
              height: 13,
              border: `2px solid ${G}`,
              borderTopColor: "transparent",
              borderRadius: 999,
              animation: "spin .7s linear infinite",
            }}
          />
          Checking table availability…
        </div>
      ) : (
        <>
          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              { color: G, label: "Available" },
              {
                color: "rgba(248,113,113,.7)",
                label: "Occupied — tap to join",
              },
            ].map((l) => (
              <div
                key={l.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: CM,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: l.color,
                  }}
                />
                {l.label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
              gap: 8,
            }}
          >
            {tables.map((t) => {
              const occupied = occupiedTables.has(t);
              const isSelected = selected === t;
              return (
                <button
                  key={t}
                  onClick={() => onChange(t)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 12,
                    border: `2px solid ${
                      isSelected
                        ? G
                        : occupied
                          ? "rgba(248,113,113,.5)"
                          : "rgba(232,213,163,.15)"
                    }`,
                    background: isSelected
                      ? GD
                      : occupied
                        ? "rgba(248,113,113,.07)"
                        : "rgba(255,255,255,.03)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    transition: "all .18s",
                    touchAction: "manipulation",
                    padding: 8,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={18} color={G} />
                    ) : occupied ? (
                      <Users size={18} color="rgba(248,113,113,.8)" />
                    ) : (
                      <Armchair size={18} color={CM} />
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Cinzel',serif",
                      fontSize: 13,
                      fontWeight: 700,
                      color: isSelected
                        ? G
                        : occupied
                          ? "rgba(248,113,113,.8)"
                          : CM,
                      letterSpacing: ".04em",
                    }}
                  >
                    {t}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: occupied
                        ? "rgba(248,113,113,.6)"
                        : isSelected
                          ? G
                          : "rgba(232,213,163,.3)",
                      letterSpacing: ".06em",
                    }}
                  >
                    {occupied ? "JOIN" : isSelected ? "SELECTED" : "FREE"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected indicator */}
          {selected && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: occupiedTables.has(selected)
                  ? "rgba(248,113,113,.07)"
                  : GD,
                border: `1px solid ${occupiedTables.has(selected) ? "rgba(248,113,113,.4)" : G}`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: occupiedTables.has(selected)
                  ? "rgba(248,113,113,.9)"
                  : G,
                fontFamily: "'Cinzel',serif",
                letterSpacing: ".06em",
              }}
            >
              {occupiedTables.has(selected) ? (
                <>
                  <Users size={14} style={{ marginRight: 6, flexShrink: 0 }} />{" "}
                  Joining Table{" "}
                </>
              ) : (
                <>
                  <Armchair
                    size={14}
                    style={{ marginRight: 6, flexShrink: 0 }}
                  />{" "}
                  Table{" "}
                </>
              )}
              {selected}
              {occupiedTables.has(selected)
                ? " — staff will seat you"
                : " selected"}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── CHECKOUT SCREEN ─────────────────────────────────────────────────────── */
function CheckoutScreen({
  cart,
  orderType,
  form,
  onFormChange,
  onNext,
  onBack,
  vouchers,
  setVouchers,
}: {
  cart: CartItem[];
  orderType: OrderType;
  form: any;
  onFormChange: (f: string, v: any) => void;
  onNext: () => void;
  onBack: () => void;
  vouchers: {
    code: string;
    type: "drink" | "food";
    discount: number;
    itemName: string;
    cartKey: string;
  }[];
  setVouchers: React.Dispatch<
    React.SetStateAction<
      {
        code: string;
        type: "drink" | "food";
        discount: number;
        itemName: string;
        cartKey: string;
      }[]
    >
  >;
}) {
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherResult, setVoucherResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

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
  function isDrinkItem(item: { category: string }) {
    const c = item.category.toLowerCase();
    return DRINK_CATEGORY_KEYWORDS.some((k) => c.includes(k));
  }

  const rawTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const drinkItems = cart.filter((i) => isDrinkItem(i));
  const foodItems = cart.filter((i) => !isDrinkItem(i));
  const deliveryFee =
    orderType === "delivery" ? (form.deliveryAddress?.deliveryFee ?? 0) : 0;
  const totalVoucherDiscount = vouchers.reduce((s, v) => s + v.discount, 0);
  const discountedTotal = Math.max(0, rawTotal - totalVoucherDiscount);
  const total = discountedTotal + deliveryFee;

  // Each new code claims the cheapest eligible item that isn't already
  // claimed by another applied voucher — so a table of 4 review vouchers
  // lands on 4 different cart lines, not the same one four times.
  async function applyVoucher() {
    if (!voucherInput.trim()) return;
    setVoucherChecking(true);
    setVoucherResult(null);
    const codeUpper = voucherInput.trim().toUpperCase();
    if (vouchers.some((v) => v.code === codeUpper)) {
      setVoucherResult({ ok: false, msg: "That code is already applied." });
      setVoucherChecking(false);
      return;
    }
    try {
      const res = await fetch("/api/vouchers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeUpper }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoucherResult({ ok: false, msg: data.error });
        setVoucherChecking(false);
        return;
      }
      const claimedKeys = new Set(vouchers.map((v) => v.cartKey));
      const pool = data.type === "drink" ? drinkItems : foodItems;
      const eligibleItem = pool
        .filter((i) => !claimedKeys.has(i.cartKey))
        .reduce(
          (min: CartItem | null, i) => (!min || i.price < min.price ? i : min),
          null as CartItem | null,
        );
      if (!eligibleItem) {
        setVoucherResult({
          ok: false,
          msg: `This is a ${data.type} voucher — no eligible ${data.type} item left in your cart to apply it to.`,
        });
        setVoucherChecking(false);
        return;
      }
      const pct = data.type === "drink" ? 0.1 : 0.05;
      const disc = parseFloat((eligibleItem.price * pct).toFixed(2));
      setVouchers((prev) => [
        ...prev,
        {
          code: data.code,
          type: data.type,
          discount: disc,
          itemName: eligibleItem.name,
          cartKey: eligibleItem.cartKey,
        },
      ]);
      setVoucherInput("");
      setVoucherResult({
        ok: true,
        msg: `✓ ${data.type === "drink" ? "10% drink" : "5% food"} voucher — saves ₱${disc.toFixed(2)} on ${eligibleItem.name}`,
      });
    } catch {
      setVoucherResult({ ok: false, msg: "Network error." });
    }
    setVoucherChecking(false);
  }

  function removeVoucher(code: string) {
    setVouchers((prev) => prev.filter((v) => v.code !== code));
  }

  const handlePhone = (raw: string) => {
    const digits = normalizePHPhone(raw);
    onFormChange("customerContact", digits);
  };
  const storedPhone = form.customerContact || "";
  const phoneDisplay = formatPHPhoneDisplay(storedPhone);
  const phoneValid = isValidPHPhone(storedPhone);
  const phoneError = phoneTouched && storedPhone.length > 0 && !phoneValid;

  const addrComplete =
    orderType === "delivery"
      ? (form.deliveryAddress?.houseNo || "").trim() &&
        (form.deliveryAddress?.street || "").trim() &&
        (form.deliveryAddress?.barangay || "").trim() &&
        (form.deliveryAddress?.city || "").trim()
      : true;

  const valid =
    orderType === "dine-in"
      ? (form.tableNumber || "").trim() && (form.customerName || "").trim()
      : orderType === "delivery"
        ? (form.customerName || "").trim() && phoneValid && addrComplete
        : (form.customerName || "").trim();

  return (
    <div
      style={{
        height: "100svh",
        background: BG,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <PlainHeader
        label={
          orderType === "dine-in"
            ? "DINE IN"
            : orderType === "delivery"
              ? "DELIVERY"
              : "TAKE OUT"
        }
      />
      <SubBar onClick={onBack} label="Back to Menu" />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `8px clamp(12px,4vw,16px) 32px`,
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
          <SectionTitle>Order Summary</SectionTitle>
          <div
            style={{
              background: CARD,
              border: `1px solid ${BR}`,
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            {cart.map((item) => {
              const hasVoucher = vouchers.some(
                (v) => v.cartKey === item.cartKey,
              );
              return (
                <div
                  key={item.cartKey}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        color: CM,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {item.name}{" "}
                      <span style={{ color: CF, fontSize: 12 }}>
                        ×{item.quantity}
                      </span>
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
                            flexShrink: 0,
                          }}
                        >
                          VOUCHER
                        </span>
                      )}
                    </span>
                    {item.customizations && item.customizations.length > 0 && (
                      <span
                        style={{ color: CF, fontSize: 10, lineHeight: 1.4 }}
                      >
                        {item.customizations.map((c) => c.label).join(" · ")}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      color: hasVoucher ? "#4ade80" : C,
                      fontSize: 13,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              );
            })}
            <div style={{ height: 1, background: BR, margin: "10px 0" }} />
            <>
              {totalVoucherDiscount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: CM, fontSize: 12 }}>Subtotal</span>
                  <span style={{ color: C, fontSize: 12 }}>
                    ₱{rawTotal.toFixed(2)}
                  </span>
                </div>
              )}
              {vouchers.map((v) => (
                <div
                  key={v.code}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "#4ade80", fontSize: 12 }}>
                    Voucher {v.code}
                  </span>
                  <span style={{ color: "#4ade80", fontSize: 12 }}>
                    −₱{v.discount.toFixed(2)}
                  </span>
                </div>
              ))}
              {deliveryFee > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: CM, fontSize: 12 }}>
                    Delivery fee
                    {form.deliveryAddress?.distanceKm != null && (
                      <span style={{ color: CF, fontSize: 11 }}>
                        {" "}
                        (
                        {(form.deliveryAddress.distanceKm as number).toFixed(
                          1,
                        )}{" "}
                        km)
                      </span>
                    )}
                  </span>
                  <span style={{ color: G, fontSize: 12, fontWeight: 600 }}>
                    ₱{deliveryFee}
                  </span>
                </div>
              )}
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
                    color: C,
                    fontSize: 12,
                    letterSpacing: ".08em",
                  }}
                >
                  TOTAL
                </span>
                <span
                  style={{
                    fontFamily: "'Cinzel',serif",
                    color: G,
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  ₱{total.toFixed(2)}
                </span>
              </div>
            </>
          </div>

          <SectionTitle>
            {orderType === "dine-in"
              ? "Table Details"
              : orderType === "delivery"
                ? "Delivery Info"
                : "Pickup Details"}
          </SectionTitle>
          <div
            style={{
              background: CARD,
              border: `1px solid ${BR}`,
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {orderType === "dine-in" && (
              <>
                <TablePicker
                  value={form.tableNumber || ""}
                  onChange={(v: string) => onFormChange("tableNumber", v)}
                />
                <InputField
                  label="First Name"
                  placeholder="e.g. Juan"
                  value={form.customerName || ""}
                  onChange={(v: string) => onFormChange("customerName", v)}
                />
              </>
            )}
            {orderType === "delivery" && (
              <>
                <InputField
                  label="Full Name *"
                  placeholder="Juan dela Cruz"
                  value={form.customerName || ""}
                  onChange={(v: string) => onFormChange("customerName", v)}
                />
                <div>
                  <label
                    style={{
                      display: "block",
                      color: CM,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      marginBottom: 6,
                      fontFamily: "'Cinzel',serif",
                    }}
                  >
                    PHONE NUMBER *
                  </label>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    >
                      <span
                        style={{ fontSize: 11, fontWeight: 700, color: CM }}
                      >
                        PH
                      </span>
                      <span style={{ color: CM, fontSize: 13 }}>+63</span>
                      <div style={{ width: 1, height: 14, background: BR }} />
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phoneDisplay}
                      onChange={(e) => handlePhone(e.target.value)}
                      onBlur={() => setPhoneTouched(true)}
                      placeholder="9XX XXX XXXX"
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,.03)",
                        border: `1px solid ${phoneError ? "rgba(248,113,113,.6)" : phoneValid && phoneTouched ? G : BR}`,
                        borderRadius: 8,
                        padding: "12px 12px 12px 92px",
                        color: C,
                        fontSize: 16,
                        outline: "none",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                        WebkitAppearance: "none" as any,
                        transition: "border-color .18s",
                      }}
                    />
                    {phoneValid && (
                      <div
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                        }}
                      >
                        <Check size={14} color="#4ade80" />
                      </div>
                    )}
                  </div>
                  {phoneError && (
                    <p style={{ color: ERR, fontSize: 11, marginTop: 5 }}>
                      Enter a valid PH mobile number (e.g. 9561234567 or
                      09561234567)
                    </p>
                  )}
                  {!phoneError && !phoneValid && storedPhone.length > 0 && (
                    <p style={{ color: CM, fontSize: 11, marginTop: 5 }}>
                      Enter 10 digits starting with 9, or 11 digits starting
                      with 09
                    </p>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      color: CM,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      marginBottom: 8,
                      fontFamily: "'Cinzel',serif",
                    }}
                  >
                    DELIVERY ADDRESS *
                  </label>
                  <DeliveryAddressPicker
                    value={form.deliveryAddress || {}}
                    onChange={(v) => onFormChange("deliveryAddress", v)}
                  />
                </div>
              </>
            )}
            {orderType === "takeout" && (
              <>
                <InputField
                  label="Name *"
                  placeholder="Juan dela Cruz"
                  value={form.customerName || ""}
                  onChange={(v: string) => onFormChange("customerName", v)}
                />
              </>
            )}

            {orderType === "dine-in" && (
              <div>
                <label
                  style={{
                    display: "block",
                    color: CM,
                    fontSize: 10,
                    letterSpacing: ".1em",
                    marginBottom: 6,
                    fontFamily: "'Cinzel',serif",
                  }}
                >
                  VOUCHER CODE{vouchers.length > 0 ? "S" : ""} (OPTIONAL)
                  {vouchers.length > 0 && (
                    <span style={{ color: CF, fontWeight: 400 }}>
                      {" "}
                      — {vouchers.length} applied
                    </span>
                  )}
                </label>

                {vouchers.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    {vouchers.map((v) => (
                      <div
                        key={v.code}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 14px",
                          background: "rgba(74,222,128,.08)",
                          border: "1px solid rgba(74,222,128,.3)",
                          borderRadius: 8,
                        }}
                      >
                        <span
                          style={{
                            color: "#4ade80",
                            fontSize: 12,
                            fontFamily: "'Cinzel',serif",
                            letterSpacing: ".06em",
                            fontWeight: 700,
                          }}
                        >
                          {v.code}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            color: CM,
                            fontSize: 11,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          −₱{v.discount.toFixed(2)} on {v.itemName}
                        </span>
                        <button
                          onClick={() => removeVoucher(v.code)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: CM,
                            display: "flex",
                            padding: 4,
                            flexShrink: 0,
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <input
                    value={voucherInput}
                    onChange={(e) =>
                      setVoucherInput(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                    placeholder="e.g. DRK-4X9K"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: "rgba(255,255,255,.03)",
                      border: `1px solid ${BR}`,
                      borderRadius: 8,
                      padding: "12px 12px",
                      color: C,
                      fontSize: 16,
                      outline: "none",
                      fontFamily: "'Cinzel',serif",
                      letterSpacing: ".08em",
                      boxSizing: "border-box" as const,
                    }}
                  />
                  <button
                    onClick={applyVoucher}
                    disabled={voucherChecking || !voucherInput.trim()}
                    style={{
                      flexShrink: 0,
                      padding: "10px 14px",
                      background: voucherInput.trim()
                        ? G
                        : "rgba(212,168,67,.2)",
                      border: "none",
                      borderRadius: 8,
                      color: voucherInput.trim() ? BG : CM,
                      fontFamily: "'Cinzel',serif",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".08em",
                      cursor: voucherInput.trim() ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {voucherChecking ? "…" : "APPLY"}
                  </button>
                </div>
                {voucherResult && !voucherResult.ok && (
                  <p style={{ color: ERR, fontSize: 12, marginTop: 6 }}>
                    {voucherResult.msg}
                  </p>
                )}
                <p style={{ color: CF, fontSize: 11, marginTop: 6 }}>
                  Each table member with their own review code can add it here —
                  one code per person, applied to one item each.
                </p>
              </div>
            )}

            <InputField
              label="Special Requests (optional)"
              placeholder="Allergies, preferences, extra instructions…"
              value={form.notes || ""}
              onChange={(v: string) => onFormChange("notes", v)}
            />
          </div>

          <button
            onClick={onNext}
            disabled={!valid}
            style={{
              width: "100%",
              background: valid ? G : "rgba(212,168,67,.25)",
              color: valid ? BG : CM,
              border: "none",
              borderRadius: 14,
              padding: "clamp(14px,4vw,17px) 16px",
              fontFamily: "'Cinzel',serif",
              fontSize: "clamp(13px,3vw,14px)",
              letterSpacing: ".12em",
              fontWeight: 700,
              cursor: valid ? "pointer" : "not-allowed",
              transition: "all .2s",
              WebkitAppearance: "none" as any,
              touchAction: "manipulation",
              minHeight: 52,
            }}
          >
            {valid ? "CHOOSE PAYMENT →" : "FILL IN REQUIRED FIELDS"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PAYMENT SCREEN ──────────────────────────────────────────────────────── */
function PaymentScreen({
  cart,
  orderType,
  paymentMethod,
  onPayMethodChange,
  onReceiptUploaded,
  onConfirm,
  submitting,
  onBack,
  form,
  vouchers = [],
  onGcashRefChange,
}: {
  cart: CartItem[];
  orderType: OrderType;
  paymentMethod: PayMethod;
  onPayMethodChange: (m: PayMethod) => void;
  onReceiptUploaded: (url: string, key: string) => void;
  onConfirm: (split?: { cashAmount: number; gcashAmount: number }) => void;
  submitting: boolean;
  onBack: () => void;
  form: any;
  vouchers?: {
    code: string;
    type: "drink" | "food";
    discount: number;
    itemName: string;
    cartKey: string;
  }[];
  onGcashRefChange?: (name: string, refNo: string) => void;
}) {
  const rawTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee =
    orderType === "delivery" ? (form.deliveryAddress?.deliveryFee ?? 0) : 0;
  const totalVoucherDiscount = vouchers.reduce((s, v) => s + v.discount, 0);
  const total = Math.max(0, rawTotal - totalVoucherDiscount) + deliveryFee;
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // ── GCash-specific state ──────────────────────────────────────────────────
  // copied: user has tapped "Copy Number"
  const [copied, setCopied] = useState(false);
  // hasCopied: latched true once copied, never goes false — used for gate logic
  const [hasCopied, setHasCopied] = useState(false);
  // sentConfirmed: dine-in only — user ticked "I've sent the money"
  const [sentConfirmed, setSentConfirmed] = useState(false);

  // Screenshot is painful on desktop/laptop (no camera roll to pull from),
  // so give an alternative: type the GCash sender name + reference number
  // instead. Either path satisfies proof-of-payment.
  const [verifyMethod, setVerifyMethod] = useState<"screenshot" | "reference">(
    "screenshot",
  );
  const [gcashSenderName, setGcashSenderName] = useState("");
  const [gcashRefNo, setGcashRefNo] = useState("");
  // Not every wallet's reference number follows GCash's own 13-digit
  // format (GoTyme, Maya, etc. differ in length), so we no longer
  // enforce a fixed format here — just require that something was typed.
  const gcashRefValid = gcashRefNo.trim().length > 0;
  const gcashRefTouched = gcashRefNo.trim().length > 0;
  useEffect(() => {
    onGcashRefChange?.(gcashSenderName.trim(), gcashRefNo.trim());
  }, [gcashSenderName, gcashRefNo]);
  const refEntered = gcashSenderName.trim().length > 0 && gcashRefValid;

  // ── SPLIT PAYMENT STATE ───────────────────────────────────────────────────
  const [splitCashInput, setSplitCashInput] = useState("");

  const effectiveMethod: PayMethod =
    orderType === "delivery" ? "gcash" : paymentMethod;

  const cashPortion =
    effectiveMethod === "cash"
      ? total
      : effectiveMethod === "split"
        ? Math.min(Math.max(parseFloat(splitCashInput) || 0, 0), total)
        : 0;
  const gcashPortion =
    effectiveMethod === "gcash"
      ? total
      : effectiveMethod === "split"
        ? Math.max(0, total - cashPortion)
        : 0;
  const showGcashFlow =
    effectiveMethod === "gcash" ||
    (effectiveMethod === "split" && gcashPortion > 0);

  const GCASH_NUMBER =
    orderType === "delivery" ? "0956 627 7949" : "0917 813 7503";
  const GCASH_NAME = "3RD SPACE COFFEE";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploaded(false);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const toSend = file.size > 1_200_000 ? await compressImage(file) : file;
      const fd = new FormData();
      fd.append("file", toSend);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        onReceiptUploaded(d.url, d.key);
        setUploaded(true);
      } else {
        const errText = await res.text().catch(() => "");
        console.error("[Payment] upload failed", res.status, errText);
        setUploadError(
          res.status === 413
            ? "Screenshot is too large — try a smaller screenshot or retake it."
            : "Upload failed — check your connection and try again.",
        );
      }
    } catch (err) {
      console.error("[Payment] upload error", err);
      setUploadError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(GCASH_NUMBER.replace(/\s/g, "")).catch(() => {
      // Fallback for browsers that block clipboard
      const ta = document.createElement("textarea");
      ta.value = GCASH_NUMBER.replace(/\s/g, "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    setCopied(true);
    setHasCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * canConfirm logic:
   *   - cash / pay-later:        always true
   *   - gcash + dine-in/takeout: hasCopied AND sentConfirmed AND uploaded screenshot
   *   - gcash + delivery:        uploaded screenshot
   * Screenshot is now mandatory for every GCash order — staff need proof
   * of payment regardless of order type, not just a self-attested checkbox.
   */
  const proofDone = verifyMethod === "screenshot" ? uploaded : refEntered;

  const canConfirm: boolean =
    effectiveMethod === "cash"
      ? true
      : effectiveMethod === "split" && gcashPortion === 0
        ? true
        : showGcashFlow && orderType !== "delivery"
          ? hasCopied && sentConfirmed && proofDone
          : proofDone; // delivery, or split with a gcash portion

  return (
    <div
      style={{
        height: "100svh",
        background: BG,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <PlainHeader label="PAYMENT" />
      <SubBar onClick={onBack} label="Back to Details" />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `8px clamp(12px,4vw,16px) 32px`,
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          {/* Amount */}
          <div
            style={{
              background: GD,
              border: `2px solid ${G}`,
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={{ color: CM, fontSize: 12, letterSpacing: ".1em" }}>
              AMOUNT DUE
            </span>
            <span
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: "clamp(24px,6vw,28px)",
                fontWeight: 700,
                color: G,
              }}
            >
              ₱{total.toFixed(2)}
            </span>
          </div>

          {/* Dine-in method selector */}
          {orderType !== "delivery" && (
            <>
              <SectionTitle>How will you pay?</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "clamp(6px,2vw,10px)",
                  marginBottom: 18,
                }}
              >
                {[
                  {
                    id: "cash" as PayMethod,
                    icon: <Banknote size={18} />,
                    label: "CASH",
                    sub: "Pay at cashier",
                  },
                  {
                    id: "gcash" as PayMethod,
                    icon: (
                      <img
                        src="/images/gcash.png"
                        alt="GCash"
                        style={{ width: 20, height: 20, objectFit: "contain" }}
                      />
                    ),
                    label: "GCASH",
                    sub: "Pay via app",
                  },
                  {
                    id: "split" as PayMethod,
                    icon: <Receipt size={18} />,
                    label: "SPLIT",
                    sub: "Cash + GCash",
                  },
                ].map((m) => {
                  const a = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onPayMethodChange(m.id);
                        setHasCopied(false);
                        setSentConfirmed(false);
                        setSplitCashInput("");
                        if (m.id !== "gcash" && m.id !== "split") {
                          setUploaded(false);
                          setPreview(null);
                        }
                      }}
                      style={{
                        padding: "clamp(8px,2.5vw,14px) 4px",
                        borderRadius: 14,
                        border: `1.5px solid ${a ? G : BR}`,
                        background: a ? GD : CARD,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all .18s",
                        touchAction: "manipulation",
                        minHeight: "clamp(80px,22vw,90px)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ color: a ? G : CM, marginBottom: 6 }}>
                        {m.icon}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Cinzel',serif",
                          fontSize: "clamp(8px,2.2vw,10px)",
                          fontWeight: 700,
                          letterSpacing: ".06em",
                          color: a ? G : C,
                          marginBottom: 3,
                          lineHeight: 1.3,
                        }}
                      >
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontSize: "clamp(9px,2vw,10px)",
                          color: CM,
                          lineHeight: 1.3,
                        }}
                      >
                        {m.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {orderType === "delivery" && (
            <div
              style={{
                background: "rgba(167,139,250,.07)",
                border: "1px solid rgba(167,139,250,.2)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 12,
                color: "rgba(200,190,230,.8)",
                lineHeight: 1.6,
              }}
            >
              <Bike
                size={13}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: 5,
                }}
              />
              <strong style={{ color: "#c4b5fd" }}>
                Delivery requires GCash payment.
              </strong>{" "}
              No cash-on-delivery.
            </div>
          )}

          {/* ── SPLIT SETUP ── */}
          {effectiveMethod === "split" && (
            <div
              style={{
                background: CARD,
                border: `1px solid ${BR}`,
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  color: CM,
                  fontSize: 12,
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}
              >
                Enter how much you'll pay in{" "}
                <strong style={{ color: C }}>cash</strong> — the rest will be
                charged to GCash.
              </p>
              <label
                style={{
                  display: "block",
                  color: CM,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  marginBottom: 6,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                CASH AMOUNT (OUT OF ₱{total.toFixed(2)})
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={splitCashInput}
                onChange={(e) => setSplitCashInput(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,.04)",
                  border: `1px solid ${G}`,
                  borderRadius: 8,
                  padding: "12px 12px",
                  color: C,
                  fontSize: 16,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  marginBottom: 12,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderTop: `1px solid ${BR}`,
                }}
              >
                <span style={{ color: CM, fontSize: 12 }}>Cash</span>
                <span style={{ color: C, fontSize: 12, fontWeight: 700 }}>
                  ₱{cashPortion.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: CM, fontSize: 12 }}>GCash</span>
                <span style={{ color: G, fontSize: 12, fontWeight: 700 }}>
                  ₱{gcashPortion.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* ── CASH ── */}
          {(effectiveMethod === "cash" ||
            (effectiveMethod === "split" && cashPortion > 0)) && (
            <>
              <SectionTitle>Your Receipt</SectionTitle>
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BR}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    background: "rgba(212,168,67,.08)",
                    borderBottom: `1px solid ${BR}`,
                    padding: "12px 16px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Cinzel',serif",
                      fontSize: 11,
                      letterSpacing: ".2em",
                      color: CM,
                    }}
                  >
                    3RD SPACE COFFEE
                  </p>
                  <p style={{ color: CF, fontSize: 10, marginTop: 3 }}>
                    Submit order → show receipt at cashier to pay
                  </p>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {form.tableNumber && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ color: CM, fontSize: 12 }}>Table</span>
                      <span style={{ color: C, fontSize: 12, fontWeight: 600 }}>
                        {form.tableNumber}
                      </span>
                    </div>
                  )}
                  {form.customerName && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ color: CM, fontSize: 12 }}>Name</span>
                      <span style={{ color: C, fontSize: 12, fontWeight: 600 }}>
                        {form.customerName}
                      </span>
                    </div>
                  )}
                  <div
                    style={{ height: 1, background: BR, margin: "10px 0" }}
                  />
                  {cart.map((item) => {
                    const hasVoucher = vouchers.some(
                      (v) => v.cartKey === item.cartKey,
                    );
                    return (
                      <div
                        key={item.cartKey}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 7,
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            color: hasVoucher ? "#4ade80" : CM,
                            fontSize: 13,
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {item.name} ×{item.quantity}
                          {hasVoucher && (
                            <span
                              style={{
                                color: "#4ade80",
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: ".04em",
                                background: "rgba(74,222,128,.1)",
                                border: "1px solid rgba(74,222,128,.3)",
                                borderRadius: 5,
                                padding: "1px 5px",
                                flexShrink: 0,
                              }}
                            >
                              VOUCHER
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            color: hasVoucher ? "#4ade80" : C,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          ₱{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                  {vouchers.map((v) => (
                    <div
                      key={v.code}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 7,
                      }}
                    >
                      <span style={{ color: "#4ade80", fontSize: 12 }}>
                        Voucher {v.code}
                      </span>
                      <span style={{ color: "#4ade80", fontSize: 12 }}>
                        −₱{v.discount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{ height: 1, background: BR, margin: "10px 0" }}
                  />
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
                        color: C,
                        fontSize: 12,
                        letterSpacing: ".08em",
                      }}
                    >
                      TOTAL
                    </span>
                    <span
                      style={{
                        fontFamily: "'Cinzel',serif",
                        color: G,
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      ₱{total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              {(effectiveMethod === "cash" ||
                (effectiveMethod === "split" && gcashPortion === 0)) && (
                <button
                  onClick={() =>
                    onConfirm(
                      effectiveMethod === "split"
                        ? { cashAmount: cashPortion, gcashAmount: gcashPortion }
                        : undefined,
                    )
                  }
                  disabled={submitting}
                  style={{
                    width: "100%",
                    background: G,
                    color: BG,
                    border: "none",
                    borderRadius: 14,
                    padding: "clamp(14px,4vw,17px) 16px",
                    fontFamily: "'Cinzel',serif",
                    fontSize: "clamp(13px,3vw,14px)",
                    letterSpacing: ".12em",
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: submitting ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    touchAction: "manipulation",
                    minHeight: 52,
                  }}
                >
                  <Receipt size={16} />
                  {submitting ? "PLACING ORDER…" : "SUBMIT ORDER → GET RECEIPT"}
                </button>
              )}
            </>
          )}

          {/* ── GCASH ── */}
          {showGcashFlow && (
            <>
              <SectionTitle>
                {effectiveMethod === "split"
                  ? "GCash Portion"
                  : "GCash Payment"}
              </SectionTitle>

              {/* ── Steps card ── */}
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BR}`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  marginBottom: 16,
                }}
              >
                {(orderType !== "delivery"
                  ? [
                      {
                        n: 1,
                        text: 'Copy the GCash number below by tapping "COPY NUMBER".',
                      },
                      {
                        n: 2,
                        text: "Open GCash on your phone and send the exact amount to that number.",
                      },
                      {
                        n: 3,
                        text: 'Come back here, tick "I\'ve sent the money", then confirm your order.',
                      },
                      {
                        n: 4,
                        text: "The staff will verify on their end before serving your order.",
                      },
                    ]
                  : [
                      {
                        n: 1,
                        text: 'Copy the GCash number below by tapping "COPY NUMBER".',
                      },
                      {
                        n: 2,
                        text: "Open GCash and send the exact amount to that number.",
                      },
                      {
                        n: 3,
                        text: "Take a screenshot of the GCash success screen.",
                      },
                      {
                        n: 4,
                        text: "Come back here and upload the screenshot to confirm your order.",
                      },
                    ]
                ).map((s) => (
                  <div
                    key={s.n}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      marginBottom: s.n < 4 ? 10 : 0,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: G,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <span
                        style={{ color: BG, fontSize: 11, fontWeight: 700 }}
                      >
                        {s.n}
                      </span>
                    </div>
                    <span
                      style={{
                        color: CM,
                        fontSize: "clamp(11px,2.8vw,12px)",
                        lineHeight: 1.5,
                      }}
                    >
                      {s.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* ── GCash number card ── */}
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${hasCopied ? G : BR}`,
                  borderRadius: 16,
                  padding: "clamp(14px,4vw,18px) clamp(14px,4vw,16px)",
                  marginBottom: 16,
                  transition: "border-color .3s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <p
                      style={{
                        color: CM,
                        fontSize: 10,
                        letterSpacing: ".1em",
                        marginBottom: 4,
                      }}
                    >
                      SEND TO
                    </p>
                    <p
                      style={{
                        color: C,
                        fontFamily: "'Cinzel',serif",
                        fontSize: 13,
                        letterSpacing: ".06em",
                        marginBottom: 2,
                      }}
                    >
                      {GCASH_NAME}
                    </p>
                    <p
                      style={{
                        fontFamily: "'Cinzel',serif",
                        fontSize: "clamp(18px,5vw,20px)",
                        fontWeight: 700,
                        color: G,
                        letterSpacing: ".04em",
                      }}
                    >
                      {GCASH_NUMBER}
                    </p>
                  </div>
                  <button
                    onClick={copyNumber}
                    style={{
                      flexShrink: 0,
                      padding: "9px 14px",
                      background: copied
                        ? "rgba(74,222,128,.15)"
                        : hasCopied
                          ? "rgba(212,168,67,.2)"
                          : "rgba(212,168,67,.1)",
                      border: `1px solid ${copied ? "#4ade80" : G}`,
                      borderRadius: 10,
                      color: copied ? "#4ade80" : G,
                      fontSize: 11,
                      letterSpacing: ".08em",
                      fontFamily: "'Cinzel',serif",
                      cursor: "pointer",
                      transition: "all .2s",
                      touchAction: "manipulation",
                      minHeight: 40,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {copied ? (
                      <>
                        <Check size={11} />
                        COPIED
                      </>
                    ) : hasCopied ? (
                      <>
                        <Check size={11} />
                        COPY AGAIN
                      </>
                    ) : (
                      "COPY NUMBER"
                    )}
                  </button>
                </div>

                {/* Amount row */}
                <div
                  style={{
                    background: "rgba(212,168,67,.07)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: CM, fontSize: 12 }}>
                    {effectiveMethod === "split"
                      ? "Amount to send via GCash"
                      : "Amount to send"}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Cinzel',serif",
                      fontSize: "clamp(20px,5vw,22px)",
                      fontWeight: 700,
                      color: G,
                    }}
                  >
                    ₱{gcashPortion.toFixed(2)}
                  </span>
                </div>

                {/* Hint before copy */}
                {!hasCopied && (
                  <p
                    style={{
                      color: CF,
                      fontSize: 11,
                      textAlign: "center",
                      marginTop: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    Tap <strong style={{ color: CM }}>COPY NUMBER</strong>{" "}
                    first, then open GCash and send ₱{gcashPortion.toFixed(2)}{" "}
                    to that number.
                  </p>
                )}

                {/* After copy — open GCash reminder */}
                {hasCopied && (
                  <div
                    style={{
                      marginTop: 12,
                      background: "rgba(212,168,67,.06)",
                      border: `1px solid ${BR}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <img
                      src="/images/gcash.png"
                      alt="GCash"
                      style={{
                        width: 14,
                        height: 14,
                        objectFit: "contain",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    />
                    <p style={{ color: CM, fontSize: 12, lineHeight: 1.5 }}>
                      Number copied! Open your GCash app, go to{" "}
                      <strong style={{ color: C }}>Send Money</strong>, paste
                      the number, and send{" "}
                      <strong style={{ color: G }}>
                        ₱{gcashPortion.toFixed(2)}
                      </strong>
                      .
                    </p>
                  </div>
                )}
              </div>

              {/* ── Non-delivery: "I've sent it" checkbox ── */}
              {orderType !== "delivery" && (
                <button
                  onClick={() => {
                    if (hasCopied) setSentConfirmed((v) => !v);
                  }}
                  disabled={!hasCopied}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    marginBottom: 16,
                    background: sentConfirmed
                      ? "rgba(74,222,128,.08)"
                      : hasCopied
                        ? CARD
                        : "rgba(255,255,255,.02)",
                    border: `1.5px solid ${
                      sentConfirmed
                        ? "rgba(74,222,128,.5)"
                        : hasCopied
                          ? BR
                          : "rgba(232,213,163,.05)"
                    }`,
                    borderRadius: 12,
                    cursor: hasCopied ? "pointer" : "not-allowed",
                    transition: "all .2s",
                    touchAction: "manipulation",
                    textAlign: "left",
                    opacity: hasCopied ? 1 : 0.45,
                  }}
                >
                  {/* Checkbox visual */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `2px solid ${sentConfirmed ? "#4ade80" : hasCopied ? G : CM}`,
                      background: sentConfirmed
                        ? "rgba(74,222,128,.2)"
                        : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all .2s",
                    }}
                  >
                    {sentConfirmed && <Check size={13} color="#4ade80" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        color: sentConfirmed ? "#4ade80" : hasCopied ? C : CM,
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 2,
                        transition: "color .2s",
                      }}
                    >
                      I've sent the money via GCash
                    </p>
                    <p style={{ color: CM, fontSize: 11, lineHeight: 1.4 }}>
                      {hasCopied
                        ? "Staff will verify before serving your order."
                        : "Copy the number first, then come back and tick this."}
                    </p>
                  </div>
                </button>
              )}

              {/* ── Non-delivery: proof-of-payment method toggle ── */}
              {orderType !== "delivery" && hasCopied && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {(["screenshot", "reference"] as const).map((m) => {
                    const a = verifyMethod === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setVerifyMethod(m)}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: 10,
                          border: `1.5px solid ${a ? G : BR}`,
                          background: a ? GD : CARD,
                          color: a ? G : CM,
                          fontFamily: "'Cinzel',serif",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".06em",
                          cursor: "pointer",
                          touchAction: "manipulation",
                        }}
                      >
                        {m === "screenshot"
                          ? "UPLOAD SCREENSHOT"
                          : "ENTER REFERENCE NO."}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Non-delivery: reference-number entry (laptop-friendly alt) ── */}
              {orderType !== "delivery" &&
                hasCopied &&
                verifyMethod === "reference" && (
                  <div
                    style={{
                      background: CARD,
                      border: `1px solid ${refEntered ? "rgba(74,222,128,.35)" : BR}`,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      transition: "border-color .3s",
                    }}
                  >
                    <p
                      style={{
                        color: CM,
                        fontSize: 11,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                      }}
                    >
                      GCASH REFERENCE{" "}
                      <span style={{ color: CF, fontWeight: 400 }}>
                        (found in your GCash sent-money receipt)
                      </span>
                    </p>
                    <InputField
                      label="Name on your GCash account"
                      placeholder="e.g. Juan Dela Cruz"
                      value={gcashSenderName}
                      onChange={setGcashSenderName}
                    />
                    <InputField
                      label="Reference No."
                      placeholder="e.g. 1234567890123"
                      value={gcashRefNo}
                      onChange={setGcashRefNo}
                      inputMode="numeric"
                    />
                  </div>
                )}

              {/* ── Non-delivery: required screenshot upload ── */}
              {orderType !== "delivery" &&
                hasCopied &&
                verifyMethod === "screenshot" && (
                  <div
                    style={{
                      background: CARD,
                      border: `1px solid ${uploaded ? "rgba(74,222,128,.35)" : BR}`,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 16,
                      transition: "border-color .3s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <p
                        style={{
                          color: CM,
                          fontSize: 11,
                          letterSpacing: ".1em",
                          fontFamily: "'Cinzel',serif",
                        }}
                      >
                        GCASH SCREENSHOT{" "}
                        <span style={{ color: CF, fontWeight: 400 }}>
                          (required — staff need this to verify your payment)
                        </span>
                      </p>
                      {uploaded && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#4ade80",
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          <Check size={12} /> Uploaded
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      style={{ display: "none" }}
                    />
                    {preview ? (
                      <div>
                        <div style={{ position: "relative" }}>
                          <img
                            src={preview}
                            alt="Receipt"
                            style={{
                              width: "100%",
                              maxHeight: 180,
                              objectFit: "cover",
                              borderRadius: 10,
                              border: `1px solid ${uploaded ? G : BR}`,
                            }}
                          />
                          {uploaded && (
                            <div
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                background: G,
                                borderRadius: 999,
                                width: 26,
                                height: 26,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Check size={13} color={BG} />
                            </div>
                          )}
                          {uploading && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(14,25,14,.6)",
                                borderRadius: 10,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: G,
                                fontSize: 12,
                                fontFamily: "'Cinzel',serif",
                                letterSpacing: ".1em",
                              }}
                            >
                              UPLOADING…
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => fileRef.current?.click()}
                          style={{
                            marginTop: 8,
                            width: "100%",
                            padding: "9px",
                            background: "transparent",
                            border: `1px dashed ${BR}`,
                            borderRadius: 8,
                            color: CM,
                            fontSize: 11,
                            cursor: "pointer",
                            touchAction: "manipulation",
                          }}
                        >
                          <Edit3
                            size={11}
                            style={{ marginRight: 5, verticalAlign: "middle" }}
                          />
                          Change Screenshot
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        style={{
                          width: "100%",
                          padding: "18px 16px",
                          background: "rgba(212,168,67,.05)",
                          border: `2px dashed ${G}`,
                          borderRadius: 12,
                          color: G,
                          cursor: uploading ? "wait" : "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          boxSizing: "border-box",
                          touchAction: "manipulation",
                          minHeight: 80,
                          transition: "all .2s",
                        }}
                      >
                        <Upload size={18} />
                        <span
                          style={{
                            fontFamily: "'Cinzel',serif",
                            fontSize: 11,
                            letterSpacing: ".1em",
                          }}
                        >
                          {uploading
                            ? "UPLOADING…"
                            : "TAP TO UPLOAD SCREENSHOT"}
                        </span>
                        <span style={{ color: CF, fontSize: 11 }}>
                          JPG, PNG accepted
                        </span>
                      </button>
                    )}
                  </div>
                )}

              {/* ── Delivery: proof-of-payment method toggle ── */}
              {orderType === "delivery" && hasCopied && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {(["screenshot", "reference"] as const).map((m) => {
                    const a = verifyMethod === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setVerifyMethod(m)}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: 10,
                          border: `1.5px solid ${a ? G : BR}`,
                          background: a ? GD : CARD,
                          color: a ? G : CM,
                          fontFamily: "'Cinzel',serif",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".06em",
                          cursor: "pointer",
                          touchAction: "manipulation",
                        }}
                      >
                        {m === "screenshot"
                          ? "UPLOAD SCREENSHOT"
                          : "ENTER REFERENCE NO."}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Delivery: reference-number entry (laptop-friendly alt) ── */}
              {orderType === "delivery" && verifyMethod === "reference" && (
                <div
                  style={{
                    background: CARD,
                    border: `1px solid ${refEntered ? "rgba(74,222,128,.35)" : BR}`,
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    transition: "border-color .3s",
                    opacity: hasCopied ? 1 : 0.5,
                  }}
                >
                  <p
                    style={{
                      color: CM,
                      fontSize: 11,
                      letterSpacing: ".1em",
                      fontFamily: "'Cinzel',serif",
                    }}
                  >
                    GCASH REFERENCE <span style={{ color: ERR }}>*</span>
                  </p>
                  <InputField
                    label="Name on your GCash account"
                    placeholder="e.g. Juan Dela Cruz"
                    value={gcashSenderName}
                    onChange={setGcashSenderName}
                  />
                  <div>
                    <InputField
                      label="Reference No. (13 digits)"
                      placeholder="e.g. 1234567890123"
                      value={gcashRefNo}
                      onChange={(v: string) =>
                        setGcashRefNo(v.replace(/\D/g, "").slice(0, 13))
                      }
                      inputMode="numeric"
                    />
                    {gcashRefTouched && !gcashRefValid && (
                      <p style={{ color: ERR, fontSize: 11, marginTop: 5 }}>
                        Must be exactly 13 digits — check your GCash receipt for
                        the "Ref No."
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Delivery: screenshot upload ── */}
              {orderType === "delivery" && verifyMethod === "screenshot" && (
                <div
                  style={{
                    background: CARD,
                    border: `1px solid ${uploaded ? "rgba(74,222,128,.35)" : BR}`,
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 18,
                    transition: "border-color .3s",
                    opacity: hasCopied ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <p
                      style={{
                        color: CM,
                        fontSize: 11,
                        letterSpacing: ".1em",
                        fontFamily: "'Cinzel',serif",
                      }}
                    >
                      GCASH SCREENSHOT <span style={{ color: ERR }}>*</span>
                    </p>
                    {uploaded && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          color: "#4ade80",
                          fontSize: 11,
                        }}
                      >
                        <Check size={12} /> Uploaded
                      </div>
                    )}
                  </div>
                  <p
                    style={{
                      color: CF,
                      fontSize: 12,
                      marginBottom: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {hasCopied ? (
                      <>
                        After sending in GCash, screenshot the{" "}
                        <strong style={{ color: CM }}>success screen</strong>{" "}
                        and upload it here.
                      </>
                    ) : (
                      "Copy the number and send money in GCash first, then upload your screenshot here."
                    )}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    style={{ display: "none" }}
                    disabled={!hasCopied}
                  />
                  {preview ? (
                    <div>
                      <div style={{ position: "relative" }}>
                        <img
                          src={preview}
                          alt="Receipt"
                          style={{
                            width: "100%",
                            maxHeight: 200,
                            objectFit: "cover",
                            borderRadius: 10,
                            border: `1px solid ${uploaded ? G : BR}`,
                          }}
                        />
                        {uploaded && (
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              background: G,
                              borderRadius: 999,
                              width: 26,
                              height: 26,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={13} color={BG} />
                          </div>
                        )}
                        {uploading && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: "rgba(14,25,14,.6)",
                              borderRadius: 10,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: G,
                              fontSize: 12,
                              fontFamily: "'Cinzel',serif",
                              letterSpacing: ".1em",
                            }}
                          >
                            UPLOADING…
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => hasCopied && fileRef.current?.click()}
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "9px",
                          background: "transparent",
                          border: `1px dashed ${BR}`,
                          borderRadius: 8,
                          color: CM,
                          fontSize: 11,
                          cursor: hasCopied ? "pointer" : "not-allowed",
                          touchAction: "manipulation",
                        }}
                      >
                        <Edit3
                          size={11}
                          style={{ marginRight: 5, verticalAlign: "middle" }}
                        />
                        Change Screenshot
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => hasCopied && fileRef.current?.click()}
                      disabled={uploading || !hasCopied}
                      style={{
                        width: "100%",
                        padding: "22px 16px",
                        background: "rgba(212,168,67,.05)",
                        border: `2px dashed ${hasCopied ? G : BR}`,
                        borderRadius: 12,
                        color: hasCopied ? G : CM,
                        cursor: hasCopied ? "pointer" : "not-allowed",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                        boxSizing: "border-box",
                        touchAction: "manipulation",
                        minHeight: 100,
                        transition: "all .2s",
                      }}
                    >
                      <Upload size={22} />
                      <span
                        style={{
                          fontFamily: "'Cinzel',serif",
                          fontSize: 11,
                          letterSpacing: ".1em",
                        }}
                      >
                        {uploading
                          ? "UPLOADING…"
                          : hasCopied
                            ? "TAP TO UPLOAD GCASH SCREENSHOT"
                            : "COPY NUMBER FIRST"}
                      </span>
                      <span style={{ color: CF, fontSize: 11 }}>
                        {hasCopied
                          ? "JPG, PNG accepted"
                          : "Then come back and upload here"}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {uploadError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(248,113,113,.08)",
                    border: "1px solid rgba(248,113,113,.25)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 12,
                  }}
                >
                  <AlertCircle
                    size={14}
                    color={ERR}
                    style={{ flexShrink: 0 }}
                  />
                  <span style={{ color: ERR, fontSize: 12, lineHeight: 1.5 }}>
                    {uploadError}
                  </span>
                </div>
              )}

              {/* ── Confirm button ── */}
              <button
                onClick={() =>
                  onConfirm(
                    effectiveMethod === "split"
                      ? { cashAmount: cashPortion, gcashAmount: gcashPortion }
                      : undefined,
                  )
                }
                disabled={submitting || !canConfirm}
                style={{
                  width: "100%",
                  background: canConfirm ? G : "rgba(212,168,67,.25)",
                  color: canConfirm ? BG : CM,
                  border: "none",
                  borderRadius: 14,
                  padding: "clamp(14px,4vw,17px) 16px",
                  fontFamily: "'Cinzel',serif",
                  fontSize: "clamp(13px,3vw,14px)",
                  letterSpacing: ".12em",
                  fontWeight: 700,
                  cursor: canConfirm ? "pointer" : "not-allowed",
                  transition: "all .2s",
                  touchAction: "manipulation",
                  minHeight: 52,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <Receipt size={16} />
                {submitting
                  ? "PLACING ORDER…"
                  : !hasCopied
                    ? "COPY GCASH NUMBER TO CONTINUE"
                    : orderType !== "delivery" && !sentConfirmed
                      ? "TICK THE CHECKBOX TO CONTINUE"
                      : !proofDone
                        ? verifyMethod === "screenshot"
                          ? "UPLOAD SCREENSHOT TO CONTINUE"
                          : "ENTER NAME & REFERENCE NO. TO CONTINUE"
                        : "CONFIRM & PLACE ORDER"}
              </button>

              {(orderType === "delivery" || effectiveMethod === "gcash") && (
                <p
                  style={{
                    color: CF,
                    fontSize: 11,
                    textAlign: "center",
                    marginTop: 10,
                    lineHeight: 1.6,
                  }}
                >
                  We verify your payment before{" "}
                  {orderType === "delivery"
                    ? "dispatching your delivery"
                    : "preparing your order"}
                  .
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── CONFIRMATION ────────────────────────────────────────────────────────── */
function ConfirmationScreen({
  orderNumber,
  orderType,
  paymentMethod,
  form,
  onNewOrder,
}: {
  orderNumber: string;
  orderType: OrderType;
  paymentMethod: PayMethod;
  form: any;
  onNewOrder: () => void;
}) {
  const isCash = paymentMethod === "cash" && orderType === "dine-in";
  const isDelivery = orderType === "delivery";
  const isTakeout = orderType === "takeout";

  const addrLine = (addr: any) => {
    if (!addr) return "";
    return [addr.houseNo, addr.street, addr.barangay, addr.city, addr.landmark]
      .filter(Boolean)
      .join(", ");
  };
  const headline = isCash || isTakeout ? "ORDER PLACED!" : "ORDER CONFIRMED!";
  const icon = isCash ? (
    <Receipt size={34} color={BG} strokeWidth={2} />
  ) : (
    <Check size={34} color={BG} strokeWidth={3} />
  );

  const message = () => {
    if (isCash)
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              background: "rgba(212,168,67,0.12)",
              border: "2px solid rgba(212,168,67,0.6)",
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: "clamp(16px,4vw,20px)",
                fontWeight: 700,
                color: G,
                letterSpacing: ".08em",
                marginBottom: 8,
              }}
            >
              PROCEED TO THE COUNTER
            </p>
            <p
              style={{
                color: C,
                fontSize: "clamp(14px,3.5vw,16px)",
                lineHeight: 1.6,
              }}
            >
              Show this order number and pay{" "}
              <strong
                style={{
                  color: G,
                  fontFamily: "'Cinzel',serif",
                  fontSize: "clamp(16px,4vw,18px)",
                }}
              >
                ₱{(form as any)._total}
              </strong>{" "}
              in cash at the cashier.
            </p>
          </div>
          {form.tableNumber && (
            <div
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 13,
                color: "#4ade80",
              }}
            >
              After paying, sit back at{" "}
              <strong>Table {form.tableNumber}</strong> — we'll bring your order
              to you.
            </div>
          )}
        </div>
      );
    if (isTakeout)
      return (
        <p style={{ color: CM, fontSize: 13, lineHeight: 1.7 }}>
          Come to the counter and show order{" "}
          <strong style={{ color: C }}>#{orderNumber}</strong> to pick up your
          items.{form.pickupTime && ` Pickup time: ${form.pickupTime}.`}
        </p>
      );
    if (isDelivery)
      return (
        <p style={{ color: CM, fontSize: 13, lineHeight: 1.7 }}>
          Verifying your GCash payment. Delivery to{" "}
          <strong style={{ color: C }}>{addrLine(form.deliveryAddress)}</strong>
          . We'll call{" "}
          <strong style={{ color: C }}>
            +63 {formatPHPhoneDisplay(form.customerContact)}
          </strong>
          .
        </p>
      );
    return (
      <p style={{ color: CM, fontSize: 13, lineHeight: 1.7 }}>
        GCash payment received — staff will verify shortly.
        {form.tableNumber && (
          <>
            {" "}
            We'll bring your order to{" "}
            <strong style={{ color: C }}>{form.tableNumber}</strong>.
          </>
        )}
      </p>
    );
  };

  return (
    <div
      style={{
        minHeight: "100svh",
        background: `radial-gradient(ellipse at 50% 25%, rgba(212,168,67,.1) 0%, transparent 60%), ${BG}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding:
          "clamp(24px,6vw,48px) clamp(14px,4vw,24px) clamp(32px,6vw,48px)",
        textAlign: "center",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 999,
          background: G,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          boxShadow: "0 0 48px rgba(212,168,67,.4)",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: "'Cinzel',serif",
          fontSize: "clamp(1.4rem,5vw,2.4rem)",
          fontWeight: 700,
          letterSpacing: ".15em",
          color: C,
          marginBottom: 8,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          width: 44,
          height: 1,
          background: `linear-gradient(90deg,transparent,${G},transparent)`,
          margin: "0 auto 24px",
        }}
      />
      {isCash ? (
        <>
          {/* HERO: big instruction first */}
          <div
            style={{
              background: GD,
              border: `2px solid ${G}`,
              borderRadius: 18,
              padding: "clamp(22px,5vw,32px) clamp(20px,6vw,36px)",
              marginBottom: 20,
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: "clamp(1.2rem,5vw,2rem)",
                fontWeight: 700,
                letterSpacing: ".12em",
                color: G,
                marginBottom: 14,
              }}
            >
              PROCEED TO THE COUNTER
            </p>
            <p
              style={{
                color: C,
                fontSize: "clamp(14px,3.5vw,16px)",
                lineHeight: 1.7,
                marginBottom: form.tableNumber ? 14 : 0,
              }}
            >
              Show your order number and pay{" "}
              <strong
                style={{
                  color: G,
                  fontFamily: "'Cinzel',serif",
                  fontSize: "clamp(16px,4vw,20px)",
                }}
              >
                ₱{(form as any)._total}
              </strong>{" "}
              in cash at the cashier.
            </p>
            {form.tableNumber && (
              <div
                style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#4ade80",
                }}
              >
                After paying, sit back at{" "}
                <strong>Table {form.tableNumber}</strong> — we'll bring your
                order to you.
              </div>
            )}
          </div>
          {/* Order number — secondary */}
          <div
            style={{
              background: CARD,
              border: `1px solid ${BR}`,
              borderRadius: 14,
              padding: "12px clamp(20px,6vw,36px)",
              marginBottom: 26,
              minWidth: "min(100%,300px)",
              textAlign: "center",
              opacity: 0.85,
            }}
          >
            <p
              style={{
                color: CM,
                fontSize: 10,
                letterSpacing: ".15em",
                marginBottom: 6,
              }}
            >
              ORDER NUMBER
            </p>
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: "clamp(0.95rem,3.5vw,1.3rem)",
                fontWeight: 700,
                color: C,
                letterSpacing: ".05em",
                wordBreak: "break-all",
              }}
            >
              #{orderNumber}
            </p>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              background: CARD,
              border: `1px solid ${BR}`,
              borderRadius: 18,
              padding: "clamp(18px,5vw,28px) clamp(18px,6vw,32px)",
              marginBottom: 20,
              maxWidth: 420,
              width: "100%",
              textAlign: "left",
            }}
          >
            {message()}
          </div>
          <div
            style={{
              background: CARD,
              border: `1px solid rgba(212,168,67,0.35)`,
              borderRadius: 14,
              padding: "16px clamp(20px,6vw,36px)",
              marginBottom: 26,
              minWidth: "min(100%,300px)",
            }}
          >
            <p
              style={{
                color: CM,
                fontSize: 10,
                letterSpacing: ".15em",
                marginBottom: 8,
              }}
            >
              ORDER NUMBER
            </p>
            <p
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: "clamp(1.1rem,5vw,1.8rem)",
                fontWeight: 700,
                color: G,
                letterSpacing: ".05em",
                wordBreak: "break-all",
              }}
            >
              #{orderNumber}
            </p>
          </div>
        </>
      )}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
          maxWidth: 380,
        }}
      >
        <a
          href={`/track?id=${orderNumber}`}
          style={{
            flex: 1,
            minWidth: 140,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "clamp(12px,3.5vw,14px) 20px",
            background: "transparent",
            color: G,
            border: `1.5px solid ${G}`,
            borderRadius: 12,
            fontFamily: "'Cinzel',serif",
            fontSize: 13,
            letterSpacing: ".1em",
            fontWeight: 700,
            textDecoration: "none",
            touchAction: "manipulation",
            minHeight: 48,
          }}
        >
          <Clock size={14} />
          TRACK ORDER
        </a>
        <button
          onClick={onNewOrder}
          style={{
            flex: 1,
            minWidth: 140,
            background: G,
            color: BG,
            border: "none",
            borderRadius: 12,
            padding: "clamp(12px,3.5vw,14px) 20px",
            fontFamily: "'Cinzel',serif",
            fontSize: 13,
            letterSpacing: ".1em",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            touchAction: "manipulation",
            minHeight: 48,
          }}
        >
          NEW ORDER <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── ROOT ────────────────────────────────────────────────────────────────── */
export default function OrderPage() {
  const [step, setStep] = useState<Step>("mode-select");
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("cash");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptKey, setReceiptKey] = useState("");
  const [gcashRefName, setGcashRefName] = useState("");
  const [gcashRefNumber, setGcashRefNumber] = useState("");
  const [vouchers, setVouchers] = useState<
    {
      code: string;
      type: "drink" | "food";
      discount: number;
      itemName: string;
      cartKey: string;
    }[]
  >([]);
  const [shopOpen, setShopOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [confirmed, setConfirmed] = useState<Order | null>(null);
  const [form, setForm] = useState<any>({
    customerName: "",
    customerContact: "",
    deliveryAddress: {},
    tableNumber: "",
    notes: "",
    pickupTime: "",
  });

  useEffect(() => {
    fetchMenu();
    fetch("/api/shop-status")
      .then((r) => r.json())
      .then((d) => setShopOpen(d.open))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch("/api/shop-status")
        .then((r) => r.json())
        .then((d) => setShopOpen(d.open))
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  async function fetchMenu() {
    try {
      const r = await fetch("/api/menu");
      setMenuItems(await r.json());
    } catch (e) {
      console.error(e);
    }
  }

  function addToCart(
    item: MenuItem,
    customizations: SelectedCustomization[] = [],
  ) {
    const cartKey = item._id + JSON.stringify(customizations);
    const extraPrice = customizations.reduce((s, c) => s + c.price, 0);
    setCart((p) => {
      const ex = p.find((c) => c.cartKey === cartKey);
      if (ex)
        return p.map((c) =>
          c.cartKey === cartKey ? { ...c, quantity: c.quantity + 1 } : c,
        );
      return [
        ...p,
        {
          ...item,
          price: item.price + extraPrice,
          quantity: 1,
          cartKey,
          customizations,
        },
      ];
    });
  }
  function updateCart(id: string, qty: number) {
    if (qty <= 0) setCart((p) => p.filter((c) => c.cartKey !== id));
    else
      setCart((p) =>
        p.map((c) => (c.cartKey !== id ? c : { ...c, quantity: qty })),
      );
  }
  function changeForm(f: string, v: any) {
    setForm((p: any) => ({ ...p, [f]: v }));
  }

  async function submitOrder(split?: {
    cashAmount: number;
    gcashAmount: number;
  }) {
    try {
      setSubmitting(true);
      const statusCheck = await fetch("/api/shop-status")
        .then((r) => r.json())
        .catch(() => ({ open: true }));
      if (!statusCheck.open) {
        setShopOpen(false);
        setOrderError(
          "Store is currently closed — ordering is paused. Please try again later.",
        );
        setTimeout(() => setOrderError(""), 6000);
        setSubmitting(false);
        return;
      }
      const rawTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
      const deliveryFee =
        orderType === "delivery" ? (form.deliveryAddress?.deliveryFee ?? 0) : 0;
      const totalVoucherDiscount = vouchers.reduce((s, v) => s + v.discount, 0);
      const total = Math.max(0, rawTotal - totalVoucherDiscount) + deliveryFee;
      const eff: PayMethod = orderType === "delivery" ? "gcash" : paymentMethod;
      const splitAmounts =
        eff === "split"
          ? {
              cashAmount: split?.cashAmount ?? 0,
              gcashAmount: split?.gcashAmount ?? total,
            }
          : null;
      const addr = form.deliveryAddress || {};
      const addrStr = [
        addr.houseNo,
        addr.street,
        addr.barangay,
        addr.city,
        addr.landmark,
      ]
        .filter(Boolean)
        .join(", ");
      const payload: any = {
        type: orderType,
        items: cart.map((i) => ({
          id: i._id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          customizations: i.customizations?.length
            ? i.customizations
            : undefined,
        })),
        total,
        notes: form.notes || undefined,
        paymentMethod: eff,
        ...(splitAmounts
          ? {
              cashAmount: splitAmounts.cashAmount,
              gcashAmount: splitAmounts.gcashAmount,
            }
          : {}),
        // Present when the customer used "Enter Reference No." instead of
        // uploading a screenshot — staff can verify against the GCash
        // business inbox using these instead of an image.
        ...(gcashRefName.trim() && gcashRefNumber.trim()
          ? {
              gcashSenderName: gcashRefName.trim(),
              gcashReferenceNo: gcashRefNumber.trim(),
            }
          : {}),
      };
      if (orderType === "delivery") {
        Object.assign(payload, {
          customerName: form.customerName,
          customerContact: form.customerContact,
          deliveryAddress: addrStr,
          deliveryAddressDetails: form.deliveryAddress,
          receiptUrl,
          receiptKey,
          deliveryFee,
        });
      } else if (orderType === "takeout") {
        payload.customerName = form.customerName;
        if (form.pickupTime)
          payload.notes = `Pickup: ${form.pickupTime}${form.notes ? ` | ${form.notes}` : ""}`;
        if (eff === "gcash" || eff === "split") {
          payload.receiptUrl = receiptUrl;
          payload.receiptKey = receiptKey;
        }
      } else {
        payload.tableNumber = form.tableNumber;
        if (form.customerName) payload.customerName = form.customerName;
        if (eff === "gcash" || eff === "split") {
          payload.receiptUrl = receiptUrl;
          payload.receiptKey = receiptKey;
        }
      }
      if (vouchers.length > 0) {
        payload.voucherCodes = vouchers.map((v) => v.code);
      }
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: any = new Error(errBody.error || "Order failed");
        err.status = res.status;
        err.unavailableNames = errBody.unavailableNames || [];
        throw err;
      }
      const data = await res.json();
      setForm((p: any) => ({
        ...p,
        _total: total.toFixed(2),
        _rawTotal: rawTotal.toFixed(2),
        _voucherDiscount: totalVoucherDiscount,
      }));
      setConfirmed({ orderNumber: data.orderNumber, type: orderType });
      setStep("confirmed");
      setCart([]);
      setReceiptUrl("");
      setReceiptKey("");
    } catch (e: any) {
      const msg = e.message || "Something went wrong. Try again.";
      const isClosedError =
        msg.toLowerCase().includes("closed") ||
        msg.toLowerCase().includes("paused");

      if (e.status === 409 && e.unavailableNames?.length > 0) {
        // Auto-remove the sold-out item(s) from the cart so the customer
        // doesn't have to go hunt for it themselves, then send them back
        // to the menu to see the change and continue.
        setCart((prev) =>
          prev.filter(
            (c) =>
              !e.unavailableNames.some((n: string) => c.name.startsWith(n)),
          ),
        );
        setOrderError(msg);
        setStep("menu");
      } else {
        setOrderError(
          isClosedError
            ? "Store is currently closed — please contact us directly to process your order."
            : msg,
        );
      }
      setTimeout(() => setOrderError(""), 6000);
    } finally {
      setSubmitting(false);
    }
  }

  function back() {
    const map: Record<Step, Step> = {
      payment: "checkout",
      checkout: "menu",
      menu: "mode-select",
      "mode-select": "mode-select",
      confirmed: "mode-select",
    };
    setStep(map[step]);
  }

  function reset() {
    setStep("mode-select");
    setOrderType("dine-in");
    setCart([]);
    setReceiptUrl("");
    setReceiptKey("");
    setPaymentMethod("cash");
    setForm({
      customerName: "",
      customerContact: "",
      deliveryAddress: {},
      tableNumber: "",
      notes: "",
      eventDate: "",
      eventTime: "",
      guestCount: "",
      pickupTime: "",
    });
    setConfirmed(null);
    setVouchers([]);
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; overflow-y: auto; overflow-x: hidden; background: ${BG}; -webkit-text-size-adjust: 100%; }
        input::placeholder, textarea::placeholder { color: ${CF}; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BR}; border-radius: 99px; }
        /* Prevent iOS zoom on focus */
        input[type="text"], input[type="tel"], input[type="search"], textarea { -webkit-appearance: none; font-size: 16px !important; }
        /* Remove tap highlight on mobile */
        button, a { -webkit-tap-highlight-color: transparent; }
        /* Safe area insets for notched devices */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .safe-bottom { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Hide number input spinner arrows */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        .menu-card { transition: border-color .2s, transform .2s, box-shadow .2s; }
        .menu-card:hover { border-color: ${BRH} !important; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,.35); }
        .menu-card-img { transition: transform .4s; }
        .menu-card:hover .menu-card-img { transform: scale(1.05); }
        .mode-card { transition: background .22s, border-color .22s, transform .22s, box-shadow .22s; }
        .mode-card:hover { background: ${GD} !important; border-color: ${G} !important; transform: translateY(-3px); box-shadow: 0 12px 40px rgba(212,168,67,.12); }
        .mode-card:hover .mode-card-title { color: ${G}; }
        .mode-card-title { transition: color .22s; }
      `}</style>
      {orderError && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "#1a0a0a",
            border: "1px solid rgba(239,68,68,0.6)",
            color: "#f87171",
            borderRadius: 12,
            padding: "14px 24px",
            fontSize: 13,
            fontWeight: 600,
            backdropFilter: "blur(12px)",
            maxWidth: "calc(100vw - 32px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "normal",
            textAlign: "center",
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} /> {orderError}
        </div>
      )}
      {step === "mode-select" && (
        <ModeSelectScreen
          shopOpen={shopOpen}
          onSelect={(m) => {
            setOrderType(m);
            setPaymentMethod(m === "delivery" ? "gcash" : "cash");
            setStep("menu");
          }}
        />
      )}
      {step === "menu" && (
        <MenuScreen
          menuItems={menuItems}
          cart={cart}
          shopOpen={shopOpen}
          onAddToCart={(
            item: MenuItem,
            customizations: SelectedCustomization[],
          ) => addToCart(item, customizations)}
          onUpdateCart={(id: string, qty: number) => updateCart(id, qty)}
          onRemoveFromCart={(id: string) => updateCart(id, 0)}
          onCheckout={() => setStep("checkout")}
          onBack={back}
        />
      )}
      {step === "checkout" && (
        <CheckoutScreen
          cart={cart}
          orderType={orderType}
          form={form}
          onFormChange={changeForm}
          onNext={async () => {
            const statusCheck = await fetch("/api/shop-status")
              .then((r) => r.json())
              .catch(() => ({ open: true }));
            if (!statusCheck.open) {
              setShopOpen(false);
              setOrderError(
                "Store is currently closed — ordering is paused. Please try again later.",
              );
              setTimeout(() => setOrderError(""), 6000);
              return;
            }
            setStep("payment");
          }}
          onBack={back}
          vouchers={vouchers}
          setVouchers={setVouchers}
        />
      )}
      {step === "payment" && (
        <PaymentScreen
          cart={cart}
          orderType={orderType}
          paymentMethod={paymentMethod}
          onPayMethodChange={setPaymentMethod}
          onReceiptUploaded={(url, key) => {
            setReceiptUrl(url);
            setReceiptKey(key);
          }}
          onConfirm={(split) => submitOrder(split)}
          submitting={submitting}
          onBack={back}
          form={form}
          vouchers={vouchers}
          onGcashRefChange={(name, ref) => {
            setGcashRefName(name);
            setGcashRefNumber(ref);
          }}
        />
      )}
      {step === "confirmed" && confirmed && (
        <ConfirmationScreen
          orderNumber={confirmed.orderNumber}
          orderType={confirmed.type}
          paymentMethod={orderType === "delivery" ? "gcash" : paymentMethod}
          form={form}
          onNewOrder={reset}
        />
      )}
    </>
  );
}
