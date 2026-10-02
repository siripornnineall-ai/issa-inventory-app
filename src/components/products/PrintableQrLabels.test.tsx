import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PrintableQrLabels, type PrintLabelItem } from "./PrintableQrLabels";
import { DEFAULT_LABEL_CALIBRATION } from "@/lib/utils/labelCalibration";
import type { Product, ProductVariant, UnitToken } from "@/lib/types";

const product = { id: "p1", sellingName: "Billie Slim", shape: "ทรงกระบอกเล็ก" } as unknown as Product;
const variant = (sku: string) => ({ id: "v-" + sku, color: "ดำ", size: "S", sku }) as unknown as ProductVariant;
const token: UnitToken = { id: "7b1f3c2e-9a4d-4e8b-8c55-100000000001", variantId: "v1", createdAt: "2026-10-01T00:00:00Z" };

const barcodeItem: PrintLabelItem = { product, variant: variant("IS-BS-BLK-S") };
const thaiItem: PrintLabelItem = { product, variant: variant("ISSA-BILSLI-ดำ-S-004"), token };

describe("PrintableQrLabels", () => {
  beforeEach(() => cleanup());

  it("prints a Code 128 barcode with the SKU text under it by default", () => {
    const { container } = render(<PrintableQrLabels items={[barcodeItem]} calibration={DEFAULT_LABEL_CALIBRATION} />);
    expect(container.querySelectorAll(".barcode-card").length).toBe(1);
    expect(container.querySelectorAll("svg.barcode-svg rect").length).toBeGreaterThan(20);
    expect(container.querySelector(".bc-sku")?.textContent).toBe("IS-BS-BLK-S");
    expect(container.querySelector(".bc-variant")?.textContent).toBe("ดำ / S");
    expect(container.querySelector(".bc-name")?.textContent).toBe("Billie Slim");
  });

  it("prints one barcode label per item, so quantity 3 makes 3 labels", () => {
    const { container } = render(<PrintableQrLabels items={[barcodeItem, barcodeItem, barcodeItem]} calibration={{ ...DEFAULT_LABEL_CALIBRATION, paper: "roll" }} />);
    expect(container.querySelectorAll(".barcode-card").length).toBe(3);
  });

  it("falls back to the QR label for a Thai SKU that has a token", () => {
    const { container } = render(<PrintableQrLabels items={[thaiItem]} calibration={DEFAULT_LABEL_CALIBRATION} />);
    expect(container.querySelectorAll(".barcode-card").length).toBe(0);
    expect(container.querySelectorAll(".qr-label-card").length).toBe(1);
    expect(container.querySelector(".qr-label-sku")?.textContent).toBe("ISSA-BILSLI-ดำ-S-004");
  });

  it("in QR mode prints QR labels and no barcode styles, exactly like before", () => {
    const { container } = render(<PrintableQrLabels items={[{ ...barcodeItem, token }]} calibration={{ ...DEFAULT_LABEL_CALIBRATION, codeType: "qr" }} />);
    expect(container.querySelectorAll(".barcode-card").length).toBe(0);
    expect(container.querySelector(".qr-label-text")).not.toBeNull();
    expect(container.querySelector("style")?.textContent).not.toContain("barcode-card");
  });

  it("skips an item that has neither an encodable SKU nor a token instead of printing a blank label", () => {
    const { container } = render(<PrintableQrLabels items={[{ product, variant: variant("ดำ-S") }]} calibration={DEFAULT_LABEL_CALIBRATION} />);
    expect(container.querySelectorAll(".qr-label-card").length).toBe(0);
  });
});
