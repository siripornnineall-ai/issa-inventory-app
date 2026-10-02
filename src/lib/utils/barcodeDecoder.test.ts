// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { decodeBarcodeFrame, setBarcodeDecoderOverridesForTests } from "./barcodeDecoder";
import { CODE128_QUIET_MODULES, encodeCode128 } from "./code128";

// วาดบาร์โค้ดจริงของเรา (บิตจาก encodeCode128) เป็นภาพขาวดำ แล้วให้ตัวถอดรหัสของกล้องในแอปอ่านกลับ
// moduleWide/height เป็นพิกเซล โซนเงียบเว้นตามที่ป้ายพิมพ์จริงใช้
function renderBarcode(text: string, moduleWide: number, height: number, margin = 24): ImageData {
  const bits = encodeCode128(text)!;
  const quiet = CODE128_QUIET_MODULES * moduleWide;
  const width = bits.length * moduleWide + quiet * 2 + margin * 2;
  const h = height + margin * 2;
  const data = new Uint8ClampedArray(width * h * 4).fill(255);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue;
    for (let x = margin + quiet + i * moduleWide; x < margin + quiet + (i + 1) * moduleWide; x++) {
      for (let y = margin; y < margin + height; y++) {
        const o = (y * width + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = 0;
      }
    }
  }
  return { data, width, height: h, colorSpace: "srgb" } as ImageData;
}

describe("กล้องในแอปอ่านบาร์โค้ด Code 128 ของป้าย", () => {
  beforeAll(() => {
    const wasm = readFileSync(path.resolve(__dirname, "../../../public/zxing/zxing_reader.wasm"));
    setBarcodeDecoderOverridesForTests({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer });
  });

  it("reads the SKUs printed on our labels, short and long", async () => {
    for (const sku of ["IS-BS-CRM-S", "IS-BS-BLK-2XL", "IA-SZHJ-BLK-2XL", "IS-BRU-OVT-2XL"]) {
      expect(await decodeBarcodeFrame(renderBarcode(sku, 3, 120))).toBe(sku);
    }
  }, 60000);

  it("still reads a thin barcode like a phone camera far from the label (2 px per module)", async () => {
    expect(await decodeBarcodeFrame(renderBarcode("IA-SZHJ-BLK-2XL", 2, 80))).toBe("IA-SZHJ-BLK-2XL");
  }, 60000);

  it("returns null for an image with no barcode", async () => {
    const blank = { data: new Uint8ClampedArray(400 * 300 * 4).fill(255), width: 400, height: 300, colorSpace: "srgb" } as ImageData;
    expect(await decodeBarcodeFrame(blank)).toBeNull();
  }, 60000);

  it("ships the wasm file the browser will load from /zxing/", () => {
    const wasm = readFileSync(path.resolve(__dirname, "../../../public/zxing/zxing_reader.wasm"));
    expect(wasm.byteLength).toBeGreaterThan(500_000);
    expect(wasm.subarray(0, 4).toString("hex")).toBe("0061736d"); // "\0asm" magic ของไฟล์ WebAssembly
  });
});
