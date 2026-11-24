import type { OrderStatus } from "./types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PLACED: "Placed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-sand text-muted",
  PLACED: "bg-sand text-brand",
  PACKED: "bg-sand text-brand",
  SHIPPED: "bg-brand-soft text-brand",
  OUT_FOR_DELIVERY: "bg-brand-soft text-brand",
  DELIVERED: "bg-accent-soft text-brand",
  CANCELLED: "bg-red-50 text-red-600",
  RETURNED: "bg-red-50 text-red-600",
};
