import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import type {
  MovementType,
  OrderStatus,
  ProductStatus,
  RequisitionStatus,
  TransferStatus,
} from "@/lib/types";
import { isOutMovementType } from "@/lib/utils/movementTabs";
import {
  MOVEMENT_TYPE_LABEL_TH,
  ORDER_STATUS_LABEL_TH,
  PRODUCT_STATUS_LABEL_TH,
  REQUISITION_STATUS_LABEL_TH,
  TRANSFER_STATUS_LABEL_TH,
} from "@/lib/types";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary" | "purple" | "yellow";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-[var(--color-success-container)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-container)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-container)] text-[var(--color-danger)]",
  info: "bg-[var(--color-info-container)] text-[var(--color-info)]",
  purple: "bg-[var(--color-purple-container)] text-[var(--color-purple)]",
  yellow: "bg-[var(--color-yellow-container)] text-[var(--color-yellow)]",
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
  // รับสินค้าเข้า = เขียว, สินค้าออกทุกรูปแบบ (ขาย โอนออก เสียหาย ใช้ภายใน ฯลฯ ตามแท็บสินค้าออก) = เหลือง, ปรับยอด/นับสต็อก = ม่วง
  // (เจ้าของงานเลือกสี 11 พ.ย. 2026) ส่วนของคืน/ตีกลับ/เปลี่ยนยังเป็นสีส้มเดิม
  const tone: BadgeTone = inbound
    ? "success"
    : isOutMovementType(type)
      ? "yellow"
      : type === "adjustment"
        ? "purple"
        : type === "return_rts" || type === "return_customer" || type === "return_exchange" || type === "return_defective"
          ? "warning"
          : "info";
  return <Badge tone={tone}>{MOVEMENT_TYPE_LABEL_TH[type]}</Badge>;
}
