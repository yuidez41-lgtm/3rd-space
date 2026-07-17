import mongoose, { Schema, model, models } from "mongoose";

// Note: the field is literally named "type" (e.g. "sauce", "milk", "variant"),
// so it must be declared as { type: { type: String } } to disambiguate from
// Mongoose's SchemaType shorthand.
const OrderItemCustomizationSchema = new Schema(
  {
    type: { type: String, default: "" },
    label: { type: String, required: true },
    price: { type: Number, default: 0 },
  },
  { _id: false },
);

const OrderItemSchema = new Schema({
  menuItemId: { type: String, default: "" },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  customizations: { type: [OrderItemCustomizationSchema], default: [] },
  discountName: { type: String },
  discountPct: { type: Number },
  discountAmount: { type: Number },
});

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["delivery", "dine-in", "takeout"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    items: [OrderItemSchema],
    total: { type: Number, required: true },

    // delivery only
    customerName: { type: String },
    customerContact: { type: String },
    deliveryAddress: { type: String },
    deliveryAddressDetails: {
      lat: { type: Number },
      lng: { type: Number },
      houseNo: { type: String },
      street: { type: String },
      barangay: { type: String },
      city: { type: String },
      landmark: { type: String },
      fullAddress: { type: String },
      distanceKm: { type: Number },
    },
    receiptUrl: { type: String },
    receiptKey: { type: String },
    gcashRef: { type: String },
    gcashSenderName: { type: String },
    deliveryFee: { type: Number, default: 0 },

    // dine-in only
    tableNumber: { type: String },

    // payment
    paymentMethod: {
      type: String,
      enum: ["gcash", "cash", "pending", "split"], // "pending" = customer chose Pay Later
      default: "pending",
    },
    cashAmount: { type: Number },
    gcashAmount: { type: Number },
    paymentStatus: {
      type: String,
      enum: ["pending", "confirmed"],
      default: "pending",
    },
    isTab: { type: Boolean, default: false },

    notes: { type: String, default: "" },
    waiterName: { type: String, default: "" },
    shiftDate: { type: String, default: null },
    shiftLabel: { type: String, default: null },

    // status timestamps
    confirmedAt: { type: Date },
    preparingAt: { type: Date },
    readyAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    paidAt: { type: Date },
    cancelReason: { type: String },
    cashReceived: { type: Number },
    changeGiven: { type: Number },

    // discount
    discountName: { type: String },
    discountPct: { type: Number },
    discountAmount: { type: Number },
    originalTotal: { type: Number },

    // voucher (customer-applied, separate from admin discountName/Pct/Amount above)
    voucherCode: { type: String },
    voucherDiscount: { type: Number },
    voucherItemName: { type: String },

    // Marks which ShiftReport already counted this order, so it can
    // never be double-counted by a later report covering an overlapping
    // createdAt window.
    shiftReportId: {
      type: Schema.Types.ObjectId,
      ref: "ShiftReport",
      default: null,
    },
  },
  { timestamps: true },
);

export const Order = models.Order || model("Order", OrderSchema);
