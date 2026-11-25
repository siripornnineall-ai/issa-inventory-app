import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PrintableQrLabels, type PrintLabelItem } from "./PrintableQrLabels";
import { DEFAULT_LABEL_CALIBRATION } from "@/lib/utils/labelCalibration";
import type { Product, ProductVariant } from "@/lib/types";

const product = { id: "p1", sellingName: "Billie Slim" } as unknown as Product;
const variant = { id: "v1", color: "ดำ", size: "S", sku: "IS-BS-BLK-S" } as unknown as ProductVariant;

describe("ป้าย Sale", () => {
  it("มีราคา = แสดง SALE ฿ราคา แทนสี/ไซซ์ และบาร์โค้ดยังอยู่", () => {
    const item: PrintLabelItem = { product, variant, salePrice: 1090 };
    const { container } = render(<PrintableQrLabels items={[item]} calibration={DEFAULT_LABEL_CALIBRATION} />);
    const text = container.querySelector(".bc-variant")?.textContent;
    expect(text).toBe("SALE ฿1,090");
    expect(text).not.toContain("ดำ");
    expect(container.querySelectorAll("svg.barcode-svg rect").length).toBeGreaterThan(20);
  });

  it("ไม่มีราคา = สี/ไซซ์เหมือนเดิม", () => {
    const { container } = render(<PrintableQrLabels items={[{ product, variant }]} calibration={DEFAULT_LABEL_CALIBRATION} />);
    expect(container.querySelector(".bc-variant")?.textContent).toBe("ดำ / S");
  });
});

describe("ป้าย Sale แบบ QR", () => {
  it("QR ที่มีราคา = แสดง SALE ฿ราคา แทนสี/ไซซ์ และยังมี QR", () => {
    const token = { id: "7b1f3c2e-9a4d-4e8b-8c55-100000000001", variantId: "v1", createdAt: "2026-10-01T00:00:00Z" };
    const item: PrintLabelItem = { product, variant, token, salePrice: 750 };
    const { container } = render(<PrintableQrLabels items={[item]} calibration={{ ...DEFAULT_LABEL_CALIBRATION, codeType: "qr" }} />);
    expect(container.querySelector(".qr-label-variant")?.textContent).toBe("SALE ฿750");
    expect(container.querySelector(".qr-label-name")?.textContent).toBe("Billie Slim");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
