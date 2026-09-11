import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import type {
  MovementType,
  OrderStatus,
  ProductStatus,
  RequisitionStatus,
  TransferStatus,
} from "@/lib/types";
import {
  MOVEMENT_TYPE_LABEL_TH,
  ORDER_STATUS_LABEL_TH,
  PRODUCT_STATUS_LABEL_TH,
  REQUISITION_STATUS_LABEL_TH,
  TRANSFER_STATUS_LABEL_TH,
} from "@/lib/types";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-[var(--color-success-container)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-container)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-container)] text-[var(--color-danger)]",
  info: "bg-[var(--color-info-container)] text-[var(--color-info)]",
  neutral: "bg-[var(--color-secondary-container)] text-[var(--color-on-surface-variant)]",
  primary: "bg-[var(--color-primary-container)] text-white",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const tone: BadgeTone = status === "active" ? "success" : status === "inactive" ? "warning" : "danger";
  return <Badge tone={tone}>{PRODUCT_STATUS_LABEL_TH[status]}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone: BadgeTone =
    status === "completed" || status === "paid"
      ? "success"
      : status === "cancelled" || status === "returned"
        ? "danger"
        : "info";
  return <Badge tone={tone}>{ORDER_STATUS_LABEL_TH[status]}</Badge>;
}

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const tone: BadgeTone = status === "received" ? "success" : status === "cancelled" ? "danger" : "info";
  return <Badge tone={tone}>{TRANSFER_STATUS_LABEL_TH[status]}</Badge>;
}

export function RequisitionStatusBadge({ status }: { status: RequisitionStatus }) {
  const tone: BadgeTone =
    status === "approved" || status === "fulfilled" ? "success" : status === "rejected" || status === "cancelled" ? "danger" : "warning";
  return <Badge tone={tone}>{REQUISITION_STATUS_LABEL_TH[status]}</Badge>;
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const inbound = type === "stock_in" || type === "transfer_in" || type === "cancel_restock";
  const tone: BadgeTone = inbound ? "success" : type === "sale" ? "warning" : type === "damaged" || type === "lost" ? "danger" : "info";
  return <Badge tone={tone}>{MOVEMENT_TYPE_LABEL_TH[type]}</Badge>;
}
