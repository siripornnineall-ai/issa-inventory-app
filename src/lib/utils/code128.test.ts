import { describe, it, expect } from "vitest";
import { CODE128_QUIET_MODULES, code128Bars, code128TotalModules, encodeCode128 } from "./code128";

describe("Code 128 encoder", () => {
  it("encodes a SKU into start + data + checksum + stop modules (11 per symbol, 13 for stop)", () => {
    const bits = encodeCode128("IS-BS-BLK-S");
    // 11 ตัวอักษร: start 11 + 11x11 + checksum 11 + stop 13 = 156 โมดูล
    expect(bits).not.toBeNull();
    expect(bits!.length).toBe(11 * 11 + 35);
    expect(bits).toMatch(/^[01]+$/);
    expect(bits!.startsWith("11010010000")).toBe(true); // Start Code B
    expect(bits!.endsWith("1100011101011")).toBe(true); // Stop + termination bar
  });

  it("is deterministic and differs for different SKUs", () => {
    expect(encodeCode128("IS-BS-BLK-S")).toBe(encodeCode128("IS-BS-BLK-S"));
    expect(encodeCode128("IS-BS-BLK-S")).not.toBe(encodeCode128("IS-BS-BLK-M"));
  });

  it("refuses text Code 128 cannot hold (Thai in old SKUs, empty), so callers can fall back", () => {
    expect(encodeCode128("ISSA-BILSLI-ดำ-2XL-006")).toBeNull();
    expect(encodeCode128("")).toBeNull();
  });

  it("counts total modules including the quiet zones", () => {
    expect(code128TotalModules("IS-BS-BLK-S")).toBe(156 + CODE128_QUIET_MODULES * 2);
    expect(code128TotalModules("ดำ")).toBeNull();
  });

  it("merges runs of 1s into bars that reproduce the original bit string exactly", () => {
    const bits = encodeCode128("IA-SZHJ-BLK-2XL")!;
    const rebuilt = Array.from({ length: bits.length }, () => "0");
    for (const b of code128Bars(bits)) for (let i = b.x; i < b.x + b.w; i++) rebuilt[i] = "1";
    expect(rebuilt.join("")).toBe(bits);
    expect(code128Bars(bits).every((b) => b.w >= 1 && b.w <= 4)).toBe(true); // Code 128: แท่งกว้าง 1-4 โมดูล
  });
});
