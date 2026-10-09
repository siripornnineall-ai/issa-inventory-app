import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { decodeBarcodeNative, nativeBarcodeSupported, resetNativeDetectorForTests } from "./barcodeDecoder";

type G = { BarcodeDetector?: unknown };
const g = globalThis as unknown as G;

describe("ตัวอ่านบาร์โค้ดของเบราว์เซอร์ (Android)", () => {
  beforeEach(() => resetNativeDetectorForTests());
  afterEach(() => {
    delete g.BarcodeDetector;
    resetNativeDetectorForTests();
  });

  it("เครื่องไม่มี BarcodeDetector (เช่น iPhone) → ไม่รองรับ คืน null ให้ตกไปใช้ ZXing", async () => {
    expect(await nativeBarcodeSupported()).toBe(false);
    expect(await decodeBarcodeNative({} as CanvasImageSource)).toBeNull();
  });

  it("มีตัวอ่านและรองรับ code_128 → อ่านค่าจากภาพได้", async () => {
    let used: string[] | undefined;
    g.BarcodeDetector = class {
      static getSupportedFormats = async () => ["qr_code", "code_128"];
      constructor(opts?: { formats?: string[] }) {
        used = opts?.formats;
      }
      async detect() {
        return [{ rawValue: "K7PX2MQ9" }];
      }
    };
    expect(await nativeBarcodeSupported()).toBe(true);
    expect(await decodeBarcodeNative({} as CanvasImageSource)).toBe("K7PX2MQ9");
    expect(used).toEqual(["code_128"]);
  });

  it("เครื่องมีตัวอ่านแต่ไม่รองรับ code_128 → ไม่ใช้ ตกไป ZXing", async () => {
    g.BarcodeDetector = class {
      static getSupportedFormats = async () => ["qr_code"];
      async detect() {
        return [];
      }
    };
    expect(await nativeBarcodeSupported()).toBe(false);
  });

  it("อ่านไม่เจอหรือ detect พัง → คืน null ไม่โยน error", async () => {
    g.BarcodeDetector = class {
      static getSupportedFormats = async () => ["code_128"];
      async detect() {
        throw new Error("boom");
      }
    };
    expect(await decodeBarcodeNative({} as CanvasImageSource)).toBeNull();
  });
});
